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
        const net = (
          await tx.execute({
            sql: "SELECT COALESCE(SUM(CASE WHEN effective_date=? THEN amount ELSE 0 END),0) AS dayNet,COALESCE(SUM(amount),0) AS monthNet FROM billing_entries WHERE method<>'' AND effective_date BETWEEN date(?,'start of month') AND ?",
            args: [today, today, today],
          })
        ).rows[0];
        const customers = (
          await tx.execute(`WITH balances AS (SELECT i.customer_id,b.total-COALESCE((SELECT SUM(amount) FROM billing_entries e WHERE e.rental_id=i.id AND e.method<>''),0) AS balance FROM bills b JOIN inquiries i ON b.rental_id=i.id)
          SELECT c.id,c.name,SUM(b.balance) AS balance FROM balances b JOIN customers c ON c.id=b.customer_id GROUP BY c.id HAVING SUM(b.balance)>0 ORDER BY balance DESC,c.id`)
        ).rows;
        return {
          today,
          pending,
          bookings,
          available,
          activity,
          finance: {
            ...net,
            customers,
            outstanding: customers.reduce((n, c) => n + Number(c.balance), 0),
          },
        };
      } finally {
        tx.close();
      }
    },
  );
}
