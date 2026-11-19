import type { FastifyInstance } from "fastify";
import type { Client } from "@libsql/client";
import { ownerAccess } from "./owner-access";
export function dashboardRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  app.get(
    "/api/dashboard/operations",
    { preHandler: ownerAccess(demo) },
    async () => {
      const tx = await client.transaction("read");
      try {
        const today = String(
          (await tx.execute("SELECT date('now','localtime') AS day")).rows[0]
            .day,
        );
        const pending = (
          await tx.execute(`SELECT i.id AS rentalId,l.position,l.item_id AS itemId,
 l.item_name AS name,i.customer_snapshot AS customer,COALESCE(l.due_override,i.due) AS due,
 l.quantity-l.returned AS outstanding FROM inquiry_lines l JOIN inquiries i ON i.id=l.inquiry_id
 WHERE i.status IN ('Issued','Partially returned') AND l.quantity>l.returned
 ORDER BY due,i.id,l.position`)
        ).rows;
        const bookings = (
          await tx.execute({
            sql: `SELECT i.id AS rentalId,i.customer_snapshot AS customer,l.item_id AS itemId,l.item_name AS name,l.position,
 COALESCE(l.start_override,i.start) AS start,COALESCE(l.due_override,i.due) AS due,l.quantity,
 EXISTS(SELECT 1 FROM rental_risk risk WHERE risk.rental_id=i.id AND risk.item_id=l.item_id) AS atRisk
 FROM inquiry_lines l JOIN inquiries i ON i.id=l.inquiry_id WHERE i.status='Booked'
 ORDER BY start,i.id,l.position`,
            args: [],
          })
        ).rows;
        const available = Number(
          (
            await tx.execute({
              sql: `SELECT COALESCE(SUM(MAX(0,it.owned-it.unusable-COALESCE((SELECT SUM(s.units) FROM stock_commitments s WHERE s.item_id=it.id AND (s.status<>'Booked' OR ? BETWEEN s.start AND s.due)),0))),0) AS units FROM items it WHERE it.active=1`,
              args: [today],
            })
          ).rows[0].units,
        );
        const activity = (
          await tx.execute({
            sql: `SELECT action,COUNT(*) AS monthCount,SUM(CASE WHEN date(created,'localtime')=? THEN 1 ELSE 0 END) AS dayCount,
 SUM(COALESCE(quantity,0)) AS monthUnits,SUM(CASE WHEN date(created,'localtime')=? THEN COALESCE(quantity,0) ELSE 0 END) AS dayUnits
 FROM rental_events WHERE date(created,'localtime') BETWEEN date(?,'start of month') AND ? GROUP BY action`,
            args: [today, today, today, today],
          })
        ).rows;
        return { today, pending, bookings, available, activity };
      } finally {
        tx.close();
      }
    },
  );
}
