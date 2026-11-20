import type { Client } from "@libsql/client";
import type { FastifyInstance } from "fastify";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import type { ReceiptDocument } from "@rentaldesk/shared";
import { ownerAccess } from "./owner-access";
import { readBill } from "./billing";
import { buildReceipt } from "./receipt-document";
const require = createRequire(import.meta.url);
function pdf(doc: ReceiptDocument): Promise<Buffer> {
  const font = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
  const file = new PDFDocument({
    size: "A4",
    margin: 48,
    font,
    info: { Title: doc.title + " " + doc.reference, Author: doc.shop },
  });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    file.on("data", (c) => chunks.push(c));
    file.on("error", reject);
    file.on("end", () => resolve(Buffer.concat(chunks)));
    file
      .fillColor("#275543")
      .fontSize(14)
      .text(doc.shop)
      .moveDown(0.5)
      .fontSize(22)
      .text(doc.title);
    file
      .fillColor("#28342e")
      .fontSize(11)
      .moveDown()
      .text(
        [doc.reference, doc.rental, doc.date]
          .filter((v, i, a) => a.indexOf(v) === i)
          .join("   ·   "),
      )
      .text(doc.customer)
      .moveDown();
    for (const line of doc.lines) file.text(line, { paragraphGap: 5 });
    if (doc.footer) file.moveDown().text(doc.footer);
    file.end();
  });
}
export function receiptRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  app.get<{
    Params: { id: string; key: string };
    Querystring: { format?: string };
  }>(
    "/api/rental-drafts/:id/receipts/:key",
    { preHandler: ownerAccess(demo) },
    async (req, reply) => {
      const id = Number(req.params.id),
        key = req.params.key;
      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !/^(estimate|issue|booking|final|return-[1-9]\d*|payment-[1-9]\d*)$/.test(
          key,
        )
      )
        return reply.code(404).send({ message: "Receipt not found." });
      const tx = await client.transaction("read");
      let doc: ReceiptDocument;
      let phones: string[];
      try {
        const stored = (
          await tx.execute({
            sql: "SELECT content FROM receipt_documents WHERE rental_id=? AND document_key=?",
            args: [id, key],
          })
        ).rows[0];
        doc = stored
          ? JSON.parse(String(stored.content))
          : await buildReceipt(tx, await readBill(tx, id), key);
        phones = (
          await tx.execute({
            sql: "SELECT p.phone FROM customer_phones p JOIN inquiries i ON i.customer_id=p.customer_id WHERE i.id=? ORDER BY p.position",
            args: [id],
          })
        ).rows.map((r) => String(r.phone));
      } finally {
        tx.close();
      }
      reply.header("Cache-Control", "private, no-store");
      if (req.query.format === "pdf")
        return reply
          .type("application/pdf")
          .header(
            "Content-Disposition",
            'attachment; filename="' + doc.reference + '.pdf"',
          )
          .send(await pdf(doc));
      return {
        doc,
        phones,
        pdf:
          req.query.format === "preview"
            ? (await pdf(doc)).toString("base64")
            : undefined,
      };
    },
  );
}
