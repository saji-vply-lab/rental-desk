import { ReceiptButton } from "./receipt";
import { useEffect, useState, type FormEvent } from "react";
import {
  adjustmentTypes,
  type Bill,
  type BillingCommand,
} from "@rentaldesk/shared";
import { headers } from "./owner-access";
export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );
const displayDate = (s: string) => s.split("-").reverse().join("/");
export function Billing({
  id,
  revision,
  refresh,
}: {
  id: number;
  revision: number;
  refresh: () => void;
}) {
  const [bill, B] = useState<Bill>(),
    [error, E] = useState(""),
    [busy, S] = useState(false),
    [retry, T] = useState(0),
    [action, A] = useState("Payment"),
    [kind, K] = useState("Delivery"),
    [token, U] = useState(() => crypto.randomUUID());
  const url = "/api/rental-drafts/" + id + "/billing";
  useEffect(() => {
    const c = new AbortController();
    fetch(url, { headers: headers(), signal: c.signal })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw Error(result.message);
        B(result);
        E("");
      })
      .catch((e) => {
        if (!c.signal.aborted) E(e.message);
      });
    return () => c.abort();
  }, [url, revision, retry]);
  async function post(command: BillingCommand, form?: HTMLFormElement) {
    if (!bill || busy) return;
    S(true);
    E("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          requestId: token,
          revision: bill.revision,
          command,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.message);
      B(result);
      U(crypto.randomUUID());
      form?.reset();
      refresh();
    } catch (e) {
      E(e instanceof Error ? e.message : "Could not save.");
    } finally {
      S(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const str = (key: string) => String(f.get(key) ?? "");
    const amount = Math.round(Number(str("amount")) * 100),
      note = str("note");
    if (action === "Payment" || action === "Refund")
      void post(
        {
          action: "Payment",
          kind: action,
          amount,
          method: str("method") as "Cash",
          date: str("date"),
          reference: str("reference"),
          note,
        },
        form,
      );
    else if (action === "Adjustment")
      void post(
        {
          action,
          kind: kind as (typeof adjustmentTypes)[number],
          amount,
          note,
          percent: str("unit") === "percent",
        },
        form,
      );
    else if (action === "Policy")
      void post(
        { action, rate: amount, grace: Number(str("grace")), note },
        form,
      );
    else if (action === "Reverse")
      void post({ action, entryId: Number(str("entry")), note }, form);
  }
  if (!bill)
    return (
      <section>
        <h2>Billing</h2>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button onClick={() => T(retry + 1)}>Refresh billing</button>
          </p>
        ) : (
          <p>Loading bill…</p>
        )}
      </section>
    );
  const open =
    !bill.finalized &&
    ["Issued", "Partially returned", "Completed"].includes(bill.status);
  const reversible = bill.entries.filter(
    (e) =>
      e.amount !== 0 &&
      !e.reversedId &&
      !bill.entries.some((x) => x.reversedId === e.id) &&
      (e.method || !bill.finalized),
  );
  const actions = [
    ...(bill.status !== "Draft" && bill.status !== "Cancelled"
      ? ["Payment"]
      : []),
    ...(bill.paid > 0 ? ["Refund"] : []),
    ...(open ? ["Adjustment", "Policy"] : []),
    ...(reversible.length ? ["Reverse"] : []),
  ];
  return (
    <section className="billing stock">
      <div className="ops-heading">
        <h2>{bill.finalized ? "Final bill" : "Rental estimate"}</h2>
        <small>
          RNT-{id}
          {bill.finalized
            ? " · Finalized " + displayDate(bill.finalized.slice(0, 10))
            : ""}
        </small>
      </div>
      <p>
        {bill.finalized
          ? "Charges are fixed."
          : "Outstanding units are estimated through their due date or today, whichever is later once issued."}{" "}
        Returned quantities are billed through the return day.
      </p>
      <ul>
        {bill.lines.map((l) => (
          <li key={l.position}>
            <div>
              <b>{l.name}</b>
              <small>
                {l.quantity} × {rupees(l.rate)} /{" "}
                {l.period === 1 ? "day" : l.period + " days"}
              </small>
            </div>
            <div>
              {rupees(l.base)}
              {l.late > 0 && <small>Late fee {rupees(l.late)}</small>}
            </div>
          </li>
        ))}
      </ul>
      <dl className="bill-totals">
        {[
          ["Rental charges", bill.base],
          ["Late fees", bill.late],
          ["Adjustments", bill.total - bill.base - bill.late],
          ["Bill total", bill.total],
          ["Net paid", bill.paid],
          [
            bill.balance < 0 ? "Customer credit" : "Balance due",
            Math.abs(bill.balance),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{rupees(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {error && (
        <p role="alert">
          {error} <button onClick={() => T(retry + 1)}>Refresh billing</button>
        </p>
      )}
      {actions.length > 0 && (
        <details className="bill-controls">
          <summary>Payments and billing adjustments</summary>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Transaction
                <select
                  value={actions.includes(action) ? action : ""}
                  onChange={(e) => {
                    A(e.target.value);
                    U(crypto.randomUUID());
                  }}
                >
                  <option value="" disabled>
                    Select transaction
                  </option>
                  {actions.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              {actions.includes(action) && (
                <div key={action}>
                  {action === "Adjustment" && (
                    <>
                      <label>
                        Charge type
                        <select
                          value={kind}
                          onChange={(e) => K(e.target.value)}
                        >
                          {adjustmentTypes.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      {kind === "Discount" && (
                        <label>
                          Discount unit
                          <select name="unit">
                            <option value="rupee">Rupees</option>
                            <option value="percent">
                              Percent of base rental charges
                            </option>
                          </select>
                        </label>
                      )}
                    </>
                  )}
                  {action === "Reverse" ? (
                    <label>
                      Entry to reverse
                      <select name="entry">
                        {reversible.map((e) => (
                          <option key={e.id} value={e.id}>
                            #{e.id} {e.kind} · {rupees(e.amount)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label>
                      {action === "Policy"
                        ? "Late fee per unit per day (₹)"
                        : action === "Adjustment" && kind === "Discount"
                          ? "Discount amount"
                          : "Amount (₹)"}
                      <input
                        type="number"
                        name="amount"
                        min={action === "Policy" ? "0" : "0.01"}
                        step="0.01"
                        required
                        defaultValue={
                          action === "Policy" ? bill.rate / 100 : undefined
                        }
                      />
                    </label>
                  )}
                  {action === "Policy" && (
                    <label>
                      Grace days
                      <input
                        name="grace"
                        type="number"
                        min="0"
                        max="365"
                        defaultValue={bill.grace}
                        required
                      />
                    </label>
                  )}
                  {["Payment", "Refund"].includes(action) && (
                    <div className="fields">
                      <label>
                        Payment method
                        <select name="method">
                          <option>Cash</option>
                          <option>UPI</option>
                          <option>Bank transfer</option>
                        </select>
                      </label>
                      <label>
                        Payment date
                        <input
                          name="date"
                          type="date"
                          required
                          defaultValue={bill.today}
                          max={bill.today}
                        />
                      </label>
                      <label>
                        Payment reference
                        <input name="reference" maxLength={160} />
                      </label>
                    </div>
                  )}
                  <label>
                    {action === "Payment" || action === "Refund"
                      ? "Note"
                      : "Reason"}
                    <input
                      name="note"
                      maxLength={500}
                      required={!["Payment", "Refund"].includes(action)}
                    />
                  </label>
                  <button>Record {action.toLowerCase()}</button>
                </div>
              )}
            </fieldset>
          </form>
        </details>
      )}
      {bill.status === "Completed" && !bill.finalized && (
        <button disabled={busy} onClick={() => post({ action: "Finalize" })}>
          Finalize bill
        </button>
      )}
      {bill.finalized && (
        <p>
          <b>
            {bill.balance > 0
              ? "Payment outstanding"
              : bill.balance === 0
                ? "Paid in full"
                : "Credit due to customer"}
          </b>
        </p>
      )}
      <ReceiptButton
        rental={id}
        documentKey={bill.finalized ? "final" : "estimate"}
        label={bill.finalized ? "View final bill" : "View rental estimate"}
      />
      {bill.entries.length > 0 && (
        <>
          <h3>Billing history</h3>
          <ul>
            {bill.entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <div>
                    <b>
                      #{e.id} ·{" "}
                      {e.reversedId ? "Reversal of #" + e.reversedId : e.kind}
                    </b>
                    <small>
                      {displayDate(e.date)} · {e.method} {e.reference}{" "}
                      {e.percent !== null ? " · " + e.percent / 100 + "%" : ""}
                    </small>
                    {e.note && <small>{e.note}</small>}
                  </div>
                  {e.amount !== 0 && (
                    <span>
                      {rupees(e.amount)}
                      {e.method && (
                        <ReceiptButton
                          rental={id}
                          documentKey={"payment-" + e.id}
                          label={"Payment receipt #" + e.id}
                        />
                      )}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
