import type { FastifyInstance } from "fastify";
import type { Client } from "@libsql/client";
import { inquiryWrite } from "@rentaldesk/shared";
import { ownerAccess } from "./owner-access";
export function inquiryRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  const options = { preHandler: ownerAccess(demo) };
  const summary =
    "SELECT i.id,i.start,i.due,c.name AS customer FROM inquiries i JOIN customers c ON c.id=i.customer_id";
  app.get(
    "/api/inquiries",
    options,
    async () => (await client.execute(summary + " ORDER BY i.id DESC")).rows,
  );
  app.get<{ Params: { id: string } }>(
    "/api/inquiries/:id",
    options,
    async (req, reply) => {
      const args = [req.params.id];
      const row = (
        await client.execute({ sql: summary + " WHERE i.id=?", args })
      ).rows[0];
      if (!row) return reply.code(404).send({ message: "Inquiry not found." });
      return {
        ...row,
        lines: (
          await client.execute({
            sql: "SELECT item_id AS itemId,item_name AS name,quantity,start_override AS startOverride,due_override AS dueOverride FROM inquiry_lines WHERE inquiry_id=? ORDER BY position",
            args,
          })
        ).rows,
      };
    },
  );
  app.post("/api/inquiries", options, async (req, reply) => {
    const parsed = inquiryWrite.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({
        message:
          "Select a customer, positive quantities and valid date ranges for all items.",
      });
    const { requestId, customerId, start, due, lines } = parsed.data;
    const tx = await client.transaction("write");
    try {
      const previous = (
        await tx.execute({
          sql: "SELECT id FROM inquiries WHERE request_id=?",
          args: [requestId],
        })
      ).rows[0];
      if (previous) return { id: previous.id };
      if (
        !(
          await tx.execute({
            sql: "SELECT id FROM customers WHERE id=?",
            args: [customerId],
          })
        ).rows.length
      )
        return reply
          .code(400)
          .send({ message: "Choose an existing customer." });
      const id = Number(
        (
          await tx.execute({
            sql: "INSERT INTO inquiries(request_id,customer_id,start,due) VALUES(?,?,?,?)",
            args: [requestId, customerId, start, due],
          })
        ).lastInsertRowid,
      );
      for (const [position, l] of lines.entries()) {
        const item = (
          await tx.execute({
            sql: "SELECT name FROM items WHERE id=? AND active=1",
            args: [l.itemId],
          })
        ).rows[0];
        if (!item)
          return reply
            .code(400)
            .send({ message: "Choose an active inventory item." });
        await tx.execute({
          sql: "INSERT INTO inquiry_lines VALUES(?,?,?,?,?,?,?)",
          args: [
            id,
            position,
            l.itemId,
            item.name,
            l.quantity,
            l.startOverride,
            l.dueOverride,
          ],
        });
      }
      await tx.commit();
      return { id };
    } finally {
      tx.close();
    }
  });
}
