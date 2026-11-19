import type { FastifyInstance } from "fastify";
import type { Client, Transaction } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { rentalAction } from "@rentaldesk/shared";
import { ownerAccess } from "./owner-access";

function conflict(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 409 });
}
// On each start date check concurrent demand, including repeated lines of the same item.
// Check today separately for issues: expected returns cannot be handed to a customer.
const shortages = `WITH proposed AS (
 SELECT l.item_id,l.quantity AS units,
 CASE WHEN ?='Issue' THEN date('now') ELSE COALESCE(l.start_override,i.start) END AS start,
 MAX(date('now'),COALESCE(l.due_override,i.due)) AS due
 FROM inquiry_lines l JOIN inquiries i ON i.id=l.inquiry_id WHERE i.id=?
), demand AS (
 SELECT item_id,units,start,due FROM proposed
 UNION ALL SELECT item_id,units,start,due FROM stock_commitments WHERE rental_id<>?
), dates AS (SELECT item_id,start AS day FROM demand UNION SELECT item_id,date('now') FROM proposed)
SELECT DISTINCT it.name FROM dates d JOIN items it ON it.id=d.item_id
WHERE EXISTS(SELECT 1 FROM proposed p WHERE p.item_id=d.item_id AND d.day BETWEEN p.start AND p.due)
AND (it.active=0 OR it.owned-it.unusable < (SELECT SUM(units) FROM demand x WHERE x.item_id=d.item_id AND d.day BETWEEN x.start AND x.due))`;
export async function commitmentFloor(tx: Transaction, id: string) {
  const result = await tx.execute({
    sql: `SELECT COALESCE(MAX((SELECT SUM(units) FROM stock_commitments s WHERE s.item_id=? AND d.day BETWEEN s.start AND s.due)),0) AS needed FROM (SELECT MAX(start,date('now')) AS day FROM stock_commitments WHERE item_id=? AND due>=date('now')) d`,
    args: [id, id],
  });
  return Number(result.rows[0].needed);
}
export function rentalRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  const options = { preHandler: ownerAccess(demo) };
  app.post<{ Params: { id: string } }>(
    "/api/inquiries/:id/rental",
    options,
    async (req, reply) => {
      const tx = await client.transaction("write");
      try {
        const source = req.params.id;
        const previous = (
          await tx.execute({
            sql: "SELECT id FROM inquiries WHERE source_inquiry=?",
            args: [source],
          })
        ).rows[0];
        if (previous) return previous;
        const created = await tx.execute({
          sql: "INSERT INTO inquiries(request_id,customer_id,start,due,kind,source_inquiry) SELECT ?,customer_id,start,due,'rental-draft',id FROM inquiries WHERE id=? AND kind='inquiry'",
          args: [randomUUID(), source],
        });
        if (!created.rowsAffected)
          return reply.code(404).send({ message: "Inquiry not found." });
        const id = Number(created.lastInsertRowid);
        await tx.execute({
          sql: "INSERT INTO inquiry_lines(inquiry_id,position,item_id,item_name,quantity,start_override,due_override) SELECT ?,position,item_id,item_name,quantity,start_override,due_override FROM inquiry_lines WHERE inquiry_id=?",
          args: [id, source],
        });
        await tx.commit();
        return { id };
      } finally {
        tx.close();
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/rental-drafts/:id/actions",
    options,
    async (req, reply) => {
      const parsed = rentalAction.safeParse(req.body);
      if (!parsed.success)
        return reply
          .code(400)
          .send({ message: "Check the rental action and quantity." });
      const { action, revision, position, quantity, condition } = parsed.data,
        id = req.params.id;
      const tx = await client.transaction("write");
      try {
        const rental = (
          await tx.execute({
            sql: "SELECT status,revision FROM inquiries WHERE id=? AND kind='rental-draft'",
            args: [id],
          })
        ).rows[0];
        if (!rental)
          return reply.code(404).send({ message: "Rental not found." });
        if (rental.revision !== revision)
          conflict("This rental changed. Refresh before continuing.");
        let status: string;
        let remaining: number | null = null;
        if (action === "Return") {
          if (!["Issued", "Partially returned"].includes(String(rental.status)))
            conflict("Only outstanding rentals can be returned.");
          if (position === undefined || !quantity || !condition)
            return reply
              .code(400)
              .send({ message: "Choose a line, quantity and condition." });
          const line = (
            await tx.execute({
              sql: "SELECT item_id,quantity-returned AS pending FROM inquiry_lines WHERE inquiry_id=? AND position=?",
              args: [id, position],
            })
          ).rows[0];
          if (!line || quantity > Number(line.pending))
            conflict("Return exceeds the outstanding quantity.");
          remaining = Number(line.pending) - quantity;
          await tx.execute({
            sql: "UPDATE inquiry_lines SET returned=returned+? WHERE inquiry_id=? AND position=?",
            args: [quantity, id, position],
          });
          await tx.execute({
            sql: "UPDATE items SET owned=owned-?,unusable=unusable+?,revision=revision+1 WHERE id=?",
            args: [
              condition === "Missing" ? quantity : 0,
              condition === "Damaged" ? quantity : 0,
              line.item_id,
            ],
          });
          await tx.execute({
            sql: "INSERT INTO movements(item,kind,quantity,owned,unusable,reason,actor) SELECT id,?,?,owned,unusable,?,'Rental desk' FROM items WHERE id=?",
            args: [
              "Return: " + condition,
              quantity,
              "Rental " + id,
              line.item_id,
            ],
          });
          status = (
            await tx.execute({
              sql: "SELECT 1 FROM inquiry_lines WHERE inquiry_id=? AND returned<quantity LIMIT 1",
              args: [id],
            })
          ).rows.length
            ? "Partially returned"
            : "Completed";
        } else {
          if (
            rental.status !== "Draft" &&
            !(rental.status === "Booked" && action !== "Book")
          )
            conflict("This action is unavailable for the current status.");
          if (action !== "Cancel") {
            if (
              (
                await tx.execute({
                  sql: "SELECT 1 FROM inquiry_lines l JOIN inquiries i ON i.id=l.inquiry_id WHERE i.id=? AND COALESCE(l.due_override,i.due)<date('now') LIMIT 1",
                  args: [id],
                })
              ).rows.length
            )
              conflict(
                "A return date has passed. Update draft dates before booking or issuing.",
              );
            const conflicts = await tx.execute({
              sql: shortages,
              args: [action, id, id],
            });
            if (conflicts.rows.length)
              conflict(
                "Stock unavailable: " +
                  conflicts.rows.map((r) => r.name).join(", "),
              );
            if (rental.status === "Draft")
              await tx.execute({
                sql: "UPDATE inquiry_lines SET (agreed_rate,agreed_model,agreed_period)=(SELECT rate,model,period FROM items WHERE id=item_id) WHERE inquiry_id=?",
                args: [id],
              });
          }
          status =
            action === "Cancel"
              ? "Cancelled"
              : action === "Book"
                ? "Booked"
                : "Issued";
          if (action === "Issue") {
            await tx.execute({
              sql: "UPDATE inquiries SET issued_at=CURRENT_TIMESTAMP WHERE id=?",
              args: [id],
            });
            await tx.execute({
              sql: "INSERT INTO movements(item,kind,quantity,owned,unusable,reason,actor) SELECT it.id,'Issue',l.quantity,it.owned,it.unusable,?,'Rental desk' FROM inquiry_lines l JOIN items it ON it.id=l.item_id WHERE l.inquiry_id=?",
              args: ["Rental " + id, id],
            });
          }
        }
        await tx.execute({
          sql: "UPDATE inquiries SET status=?,customer_snapshot=COALESCE(customer_snapshot,(SELECT name FROM customers WHERE id=customer_id)),revision=revision+1 WHERE id=?",
          args: [status, id],
        });
        if (
          action === "Book" &&
          !parsed.data.acceptRisk &&
          (
            await tx.execute({
              sql: "SELECT 1 FROM rental_risk WHERE rental_id=? LIMIT 1",
              args: [id],
            })
          ).rows.length
        ) {
          return reply.code(409).send({
            atRisk: true,
            message:
              "This booking depends on outstanding items being returned. Confirm to mark the booking At risk.",
          });
        }
        await tx.execute({
          sql: "INSERT INTO rental_events(rental_id,action,position,quantity,condition,remaining) VALUES(?,?,?,?,?,?)",
          args: [
            id,
            action,
            position ?? null,
            quantity ?? null,
            condition ?? null,
            remaining,
          ],
        });
        await tx.commit();
        return { status };
      } finally {
        tx.close();
      }
    },
  );
}
