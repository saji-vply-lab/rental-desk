import { saveReceipt } from "./receipt-document";
import type { Client, Transaction } from "@libsql/client";
import type { FastifyInstance } from "fastify";
import {
  billingRequest,
  type Bill,
  type BillingEntry,
  type BillingCommand,
} from "@rentaldesk/shared";
import { ownerAccess } from "./owner-access";
function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
function safe(n: number) {
  if (!Number.isSafeInteger(n)) fail("Amount exceeds supported precision.");
  return n;
}
function days(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function unitCharges(
  start: string,
  due: string,
  end: string,
  quantity: number,
  rate: number,
  period: number,
  lateRate: number,
  grace: number,
) {
  const duration = Math.max(1, days(start, end) + 1);
  return {
    base: safe(Math.ceil(duration / period) * quantity * rate),
    late: safe(Math.max(0, days(due, end) - grace) * quantity * lateRate),
  };
}
export async function readBill(tx: Transaction, id: number): Promise<Bill> {
  const r = (
    await tx.execute({
      sql: "SELECT i.*,COALESCE(i.customer_snapshot,(SELECT name FROM customers WHERE id=i.customer_id)) AS customer,date(i.issued_at,'localtime') AS issued_day,date('now','localtime') AS today,b.snapshot,b.created AS finalized FROM inquiries i LEFT JOIN bills b ON b.rental_id=i.id WHERE i.kind='rental-draft' AND i.id=?",
      args: [id],
    })
  ).rows[0];
  if (!r) fail("Rental not found.", 404);
  const today = String(r.today),
    status = String(r.status);
  const entries = (
    await tx.execute({
      sql: "SELECT id,kind,amount,method,reference,note,effective_date AS date,reversed_id AS reversedId,percent_bps AS percent FROM billing_entries WHERE rental_id=? ORDER BY id",
      args: [id],
    })
  ).rows as unknown as BillingEntry[];
  const paid = entries
    .filter((e) => e.method)
    .reduce((n, e) => safe(n + e.amount), 0);
  const common = {
    id,
    customer: String(r.customer),
    revision: Number(r.revision),
    today,
    status,
    paid,
    entries,
    rate: Number(r.late_rate),
    grace: Number(r.grace_days),
  };
  if (r.snapshot) {
    const frozen = JSON.parse(String(r.snapshot));
    return {
      ...common,
      ...frozen,
      finalized: String(r.finalized),
      balance: safe(frozen.total - paid),
    };
  }
  const items = (
    await tx.execute({
      sql: `SELECT l.*,COALESCE(l.agreed_rate,it.rate) AS price,COALESCE(l.agreed_model,it.model) AS model,COALESCE(l.agreed_period,it.period) AS period FROM inquiry_lines l JOIN items it ON it.id=l.item_id WHERE l.inquiry_id=? ORDER BY position`,
      args: [id],
    })
  ).rows;
  const returns = (
    await tx.execute({
      sql: "SELECT position,quantity,date(created,'localtime') AS day FROM rental_events WHERE rental_id=? AND action='Return' ORDER BY id",
      args: [id],
    })
  ).rows;
  const lines = items.map((l) => {
    const start = String(l.start_override ?? r.start),
      due = String(l.due_override ?? r.due),
      rate = Number(l.price),
      period = l.model === "Daily" ? 1 : Number(l.period);
    let base = 0,
      late = 0;
    function add(end: string, qty: number) {
      const c = unitCharges(
        start,
        due,
        end,
        qty,
        rate,
        period,
        common.rate,
        common.grace,
      );
      base = safe(base + c.base);
      late = safe(late + c.late);
    }
    if (status !== "Cancelled") {
      for (const event of returns.filter((e) => e.position === l.position))
        add(String(event.day), Number(event.quantity));
      const remaining = Number(l.quantity) - Number(l.returned);
      if (remaining)
        add(r.issued_day ? (today > due ? today : due) : due, remaining);
    }
    return {
      position: Number(l.position),
      itemId: String(l.item_id),
      name: String(l.item_name),
      start,
      due,
      quantity: Number(l.quantity),
      rate,
      period,
      model: String(l.model),
      base,
      late,
    };
  });
  const base = lines.reduce((n, l) => safe(n + l.base), 0),
    late = lines.reduce((n, l) => safe(n + l.late), 0);
  const total = Math.max(
    0,
    entries
      .filter((e) => !e.method)
      .reduce((n, e) => safe(n + e.amount), safe(base + late)),
  );
  return {
    ...common,
    lines,
    base,
    late,
    total,
    balance: safe(total - paid),
    finalized: null,
  };
}
export function billingRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  const opts = { preHandler: ownerAccess(demo) };
  app.get<{ Params: { id: string } }>(
    "/api/rental-drafts/:id/billing",
    opts,
    async (req) => {
      const tx = await client.transaction("read");
      try {
        return await readBill(tx, Number(req.params.id));
      } finally {
        tx.close();
      }
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/rental-drafts/:id/billing",
    opts,
    async (req) => {
      const parsed = billingRequest.safeParse(req.body);
      if (!parsed.success)
        fail("Check the billing amount, date and required fields.", 400);
      const { requestId, revision, command } = parsed.data,
        id = Number(req.params.id);
      const tx = await client.transaction("write");
      try {
        const result = await applyBilling(
          tx,
          id,
          requestId,
          revision,
          command,
          demo,
        );
        await tx.commit();
        return result;
      } finally {
        tx.close();
      }
    },
  );
}

export async function applyBilling(
  tx: Transaction,
  id: number,
  requestId: string,
  revision: number,
  command: BillingCommand,
  demo: boolean,
) {
  const bill = await readBill(tx, id);
  if (
    (
      await tx.execute({
        sql: "SELECT 1 FROM billing_entries WHERE rental_id=? AND request_id=?",
        args: [id, requestId],
      })
    ).rows.length
  )
    return bill;
  if (bill.revision !== revision)
    fail("The rental changed. Refresh billing before saving.");
  let kind: string = command.action,
    amount = 0,
    method = "",
    reference = "",
    note = "",
    date = bill.today,
    reversedId: number | null = null,
    percent: number | null = null;
  switch (command.action) {
    case "Payment":
      if (
        bill.status === "Draft" ||
        (bill.status === "Cancelled" && command.kind !== "Refund")
      )
        fail("Payments require a confirmed booking or issued rental.");
      if (command.date > bill.today)
        fail("Payment date cannot be in the future.");
      kind = command.kind;
      amount = kind === "Refund" ? -command.amount : command.amount;
      method = command.method;
      reference = command.reference;
      note = command.note;
      date = command.date;
      break;
    case "Adjustment": {
      if (
        bill.finalized ||
        !["Issued", "Partially returned", "Completed"].includes(bill.status)
      )
        fail("Adjustments require an issued rental with an open bill.");
      kind = command.kind;
      note = command.note;
      amount = command.amount;
      if (command.percent) {
        if (kind !== "Discount" || amount > 10000)
          fail("Percentage must be a discount between 0 and 100%.");
        percent = amount;
        amount = Math.round(safe(bill.base * percent) / 10000);
      }
      if (
        ["Discount", "Late fee waiver", "Negotiated adjustment"].includes(kind)
      )
        amount = -amount;
      if (
        kind === "Late fee waiver" &&
        -amount >
          bill.late +
            bill.entries
              .filter((e) => e.kind === "Late fee waiver")
              .reduce((n, e) => n + e.amount, 0)
      )
        fail("Waiver exceeds the remaining late fee.");
      if (bill.total + amount < 0) fail("Discount exceeds the bill.");
      break;
    }
    case "Reverse": {
      const original = bill.entries.find((e) => e.id === command.entryId);
      if (
        !original ||
        original.reversedId !== null ||
        bill.entries.some((e) => e.reversedId === original.id) ||
        (!original.method && (!original.amount || bill.finalized))
      )
        fail("This entry cannot be reversed.");
      kind = original.kind;
      amount = -original.amount;
      method = original.method;
      reference = original.reference;
      reversedId = original.id;
      note = command.note;
      if (!method && bill.total + amount < 0)
        fail("Reverse related discounts first.");
      break;
    }
    case "Policy":
      if (bill.finalized || bill.status === "Cancelled")
        fail("Cannot change this bill.");
      note =
        command.note +
        " · " +
        bill.rate +
        " → " +
        command.rate +
        " paise per unit/day, grace " +
        bill.grace +
        " → " +
        command.grace +
        " days";
      await tx.execute({
        sql: "UPDATE inquiries SET late_rate=?,grace_days=? WHERE id=?",
        args: [command.rate, command.grace, id],
      });
      break;
    case "Finalize":
      if (bill.finalized || bill.status !== "Completed")
        fail("Return all items before finalizing.");
      await tx.execute({
        sql: "INSERT INTO bills(rental_id,total,snapshot) VALUES(?,?,?)",
        args: [
          id,
          bill.total,
          JSON.stringify({
            lines: bill.lines,
            base: bill.base,
            late: bill.late,
            total: bill.total,
          }),
        ],
      });
      break;
  }
  if (method && bill.paid + amount < 0)
    fail("Refund or reversal exceeds net payments received.");
  const inserted = await tx.execute({
    sql: "INSERT INTO billing_entries(rental_id,request_id,kind,amount,method,reference,note,effective_date,reversed_id,percent_bps,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    args: [
      id,
      requestId,
      kind,
      amount,
      method,
      reference,
      note,
      date,
      reversedId,
      percent,
      demo ? "Demo owner" : "Owner",
    ],
  });
  await tx.execute({
    sql: "UPDATE inquiries SET revision=revision+1 WHERE id=?",
    args: [id],
  });
  const result = await readBill(tx, id);
  if (method || command.action === "Finalize")
    await saveReceipt(
      tx,
      result,
      method ? "payment-" + inserted.lastInsertRowid : "final",
    );

  return result;
}
