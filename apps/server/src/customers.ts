import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Client } from "@libsql/client";
import {
  customerWrite,
  normalizePhone,
  type Customer,
} from "@rentaldesk/shared";
export function customerRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  const openDemo =
    demo &&
    !process.env.RENTALDESK_OWNER_KEY &&
    !process.env.RENTALDESK_INVENTORY_STAFF_KEY;
  async function authorize(req: FastifyRequest, reply: FastifyReply) {
    const owner = process.env.RENTALDESK_OWNER_KEY;
    if (
      !openDemo &&
      (!owner || req.headers.authorization !== "Bearer " + owner)
    )
      return reply.code(403).send({
        message: "Enter the owner access key to open customer records.",
      });
  }
  app.get("/api/customers", { preHandler: authorize }, async () => {
    const rows = (
      await client.execute(
        "SELECT c.id,c.name,c.address,c.revision,p.phone FROM customers c LEFT JOIN customer_phones p ON c.id=p.customer_id ORDER BY c.name COLLATE NOCASE,c.id,p.position",
      )
    ).rows;
    const customers = new Map<number, Customer>();
    for (const row of rows) {
      const id = Number(row.id);
      const c = customers.get(id) || {
        id,
        name: String(row.name),
        address: String(row.address),
        revision: Number(row.revision),
        phones: [],
      };
      if (row.phone) c.phones.push(String(row.phone));
      customers.set(id, c);
    }
    return Array.from(customers.values());
  });
  async function save(req: FastifyRequest, reply: FastifyReply, id?: number) {
    const parsed = customerWrite.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({
        message:
          "Enter a name, address and 1–10 valid phone numbers (7–15 digits each).",
      });
    const { name, address, phones, revision, allowSharedPhone } = parsed.data;
    const numbers = phones.map(normalizePhone);
    if (new Set(numbers).size !== numbers.length)
      return reply
        .code(400)
        .send({ message: "Enter each phone number only once." });
    const tx = await client.transaction("write");
    try {
      const duplicates = (
        await tx.execute({
          sql:
            "SELECT DISTINCT c.id,c.name FROM customers c JOIN customer_phones p ON c.id=p.customer_id WHERE c.id<>? AND p.normalized IN (" +
            numbers.map(() => "?").join(",") +
            ")",
          args: [id ?? 0, ...numbers],
        })
      ).rows;
      if (duplicates.length && !allowSharedPhone)
        return reply.code(409).send({
          message: "An existing customer uses this phone number.",
          duplicates,
        });
      if (id !== undefined) {
        const changed = await tx.execute({
          sql: "UPDATE customers SET name=?,address=?,revision=revision+1 WHERE id=? AND revision=?",
          args: [name, address, id, revision ?? 0],
        });
        if (!changed.rowsAffected)
          return reply
            .code(409)
            .send({ message: "Customer changed. Reload before editing." });
        await tx.execute({
          sql: "DELETE FROM customer_phones WHERE customer_id=?",
          args: [id],
        });
      } else
        id = Number(
          (
            await tx.execute({
              sql: "INSERT INTO customers(name,address) VALUES(?,?)",
              args: [name, address],
            })
          ).lastInsertRowid,
        );
      for (const [position, phone] of phones.entries())
        await tx.execute({
          sql: "INSERT INTO customer_phones VALUES(?,?,?,?)",
          args: [id, position, phone, numbers[position]],
        });
      await tx.commit();
      return { id };
    } finally {
      tx.close();
    }
  }
  app.post("/api/customers", { preHandler: authorize }, (req, reply) =>
    save(req, reply),
  );
  app.put<{ Params: { id: string } }>(
    "/api/customers/:id",
    { preHandler: authorize },
    (req, reply) => save(req, reply, Number(req.params.id)),
  );
}
