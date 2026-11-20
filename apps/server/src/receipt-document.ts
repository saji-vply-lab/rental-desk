import type { Transaction } from "@libsql/client";
import type { Bill, ReceiptDocument } from "@rentaldesk/shared";
const money = (p: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    p / 100,
  );
const date = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
function missing(): never {
  throw Object.assign(new Error("Receipt not found."), { statusCode: 404 });
}
export async function buildReceipt(
  tx: Transaction,
  b: Bill,
  key: string,
): Promise<ReceiptDocument> {
  const shop = (
    await tx.execute("SELECT name,receipt_footer FROM tenants WHERE id=1")
  ).rows[0];
  const doc: ReceiptDocument = {
    shop: String(shop.name),
    footer: String(shop.receipt_footer),
    customer: b.customer,
    rental: "RNT-" + b.id,
    reference: "RNT-" + b.id,
    date: date(b.today),
    title: "Rental estimate",
    lines: [],
  };
  const [kind, ref] = key.split("-");
  if (kind === "payment") {
    const e = b.entries.find((x) => x.id === Number(ref) && x.method);
    if (!e) missing();
    doc.title = e.reversedId
      ? "Payment correction"
      : e.kind === "Refund"
        ? "Refund receipt"
        : "Payment receipt";
    doc.reference = "PAY-" + e.id;
    doc.date = date(e.date);
    doc.lines = [
      e.reversedId ? "Reversal of PAY-" + e.reversedId : e.kind,
      money(e.amount) + " · " + e.method,
      e.reference ? "Reference: " + e.reference : "",
      e.note,
    ].filter(Boolean);
    return doc;
  }
  if (kind === "return") {
    const event = (
      await tx.execute({
        sql: "SELECT *,date(created,'localtime') AS day FROM rental_events WHERE rental_id=? AND id=? AND action='Return'",
        args: [b.id, Number(ref)],
      })
    ).rows[0];
    if (!event) missing();
    const l = b.lines[Number(event.position)];
    doc.title = "Return receipt";
    doc.reference = "RET-" + event.id;
    doc.date = date(String(event.day));
    doc.lines = [
      l.itemId + " · " + l.name,
      "Returned: " + event.quantity + " · " + event.condition,
      "Remaining on this line: " + event.remaining,
    ];
    if (event.billing_snapshot) {
      const snap = JSON.parse(String(event.billing_snapshot));
      if (snap.discount)
        doc.lines.push("Checkout discount: " + money(snap.discount));
      if (snap.collected)
        doc.lines.push("Collected on return: " + money(snap.collected));
      doc.lines.push(
        "Rental charge for this batch: " + money(snap.base),
        "Late fee for this batch: " + money(snap.late),
        "Net paid at return: " + money(snap.paid),
        "Estimated balance at return: " + money(snap.balance),
      );
    }
    return doc;
  }
  let total = b.total;
  if (kind === "final") {
    if (!b.finalized) missing();
    doc.title = "Final bill";
    doc.reference = "BILL-" + b.id;
    doc.date = date(b.finalized);
  } else if (kind === "issue" || kind === "booking") {
    const event = (
      await tx.execute({
        sql: "SELECT date(created,'localtime') AS day FROM rental_events WHERE rental_id=? AND action=? ORDER BY id LIMIT 1",
        args: [b.id, kind === "issue" ? "Issue" : "Book"],
      })
    ).rows[0];
    if (!event) missing();
    doc.title = kind === "issue" ? "Rental issue slip" : "Booking confirmation";
    doc.reference = (kind === "issue" ? "ISS-" : "BKG-") + b.id;
    doc.date = date(String(event.day));
  } else if (key !== "estimate") missing();
  let planned = 0;
  for (const l of b.lines) {
    const periods = Math.ceil(
      Math.max(1, 1 + (Date.parse(l.due) - Date.parse(l.start)) / 86400000) /
        l.period,
    );
    const charge =
      kind === "booking" || kind === "issue"
        ? periods * l.rate * l.quantity
        : l.base;
    planned += charge;
    doc.lines.push(
      l.itemId + " · " + l.name,
      "  " +
        date(l.start) +
        " – " +
        date(l.due) +
        " · " +
        l.quantity +
        " × " +
        money(l.rate) +
        (l.period === 1 ? " / day" : " / " + l.period + " days") +
        " · " +
        money(charge),
    );
  }
  if (kind === "booking" || kind === "issue") {
    total = planned;
    doc.lines.push("Estimated rental charges: " + money(total));
    if (kind === "issue" && b.status === "Issued") {
      for (const e of b.entries.filter((e) => !e.method && e.amount))
        doc.lines.push(e.kind + ": " + money(e.amount));
      doc.lines.push(
        "Agreed issue total: " + money(b.total),
        "Net paid: " + money(b.paid),
        "Balance at issue: " + money(b.balance),
      );
    }
  } else {
    doc.lines.push(
      "Rental charges: " + money(b.base),
      "Late fees: " + money(b.late),
    );
    const adjustments = b.entries.filter((e) => !e.method && e.amount);
    for (const e of adjustments)
      doc.lines.push(
        (e.reversedId ? "Reversal · " : "") + e.kind + ": " + money(e.amount),
      );
    doc.lines.push(
      (kind === "final" ? "Final total: " : "Estimated total: ") + money(total),
    );
    const cutoff =
      kind === "final"
        ? b.entries.find((e) => e.kind === "Finalize")?.id
        : undefined;
    const paid = b.entries
      .filter((e) => e.method && (cutoff === undefined || e.id <= cutoff))
      .reduce((n, e) => n + e.amount, 0);
    doc.lines.push(
      "Net paid: " + money(paid),
      (paid > total ? "Customer credit: " : "Balance due: ") +
        money(Math.abs(total - paid)),
    );
  }
  return doc;
}
export async function saveReceipt(tx: Transaction, bill: Bill, key: string) {
  const doc = await buildReceipt(tx, bill, key);
  await tx.execute({
    sql: "INSERT INTO receipt_documents VALUES(?,?,?)",
    args: [bill.id, key, JSON.stringify(doc)],
  });
}
