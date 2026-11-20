import { useState } from "react";
import { headers } from "./owner-access";
import { rupees } from "./billing";
import type { Checkout, InquiryDetails } from "@rentaldesk/shared";
export function CheckoutPanel({
  record,
  mode,
  refresh,
}: {
  record: InquiryDetails;
  mode: "Issue" | "Return";
  refresh: () => void;
}) {
  const pending = record.lines
    .map((l, i) => ({ ...l, i, left: l.quantity - l.returned }))
    .filter((l) => l.left > 0);
  const [position, P] = useState(pending[0]?.i ?? 0),
    [qty, Q] = useState("1"),
    [condition, C] = useState("Good"),
    [discount, D] = useState(""),
    [percent, U] = useState(false),
    [reason, N] = useState(""),
    [amount, M] = useState(""),
    [method, H] = useState<Checkout["method"]>("Cash"),
    [reference, F] = useState(""),
    [finalize, Z] = useState(true),
    [review, R] = useState<{ total: number; paid: number; balance: number }>(),
    [busy, B] = useState(false),
    [error, E] = useState("");
  const last =
    mode === "Return" &&
    pending.length === 1 &&
    Number(qty) === pending[0].left;
  async function submit(preview: boolean) {
    B(true);
    E("");
    try {
      const r = await fetch("/api/rental-drafts/" + record.id + "/actions", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action: mode,
          revision: record.revision,
          ...(mode === "Return"
            ? { position, quantity: Number(qty), condition }
            : {}),
          checkout: {
            discount: Math.round(Number(discount) * 100),
            percent,
            reason,
            payment: preview ? 0 : Math.round(Number(amount) * 100),
            method,
            reference,
            finalize: last && finalize,
            preview,
            expectedTotal: preview ? undefined : review?.total,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      if (preview) {
        R(data);
        M(String(Math.max(0, data.balance) / 100));
      } else refresh();
    } catch (e) {
      E(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      B(false);
    }
  }
  return (
    <form
      className="checkout"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(!review);
      }}
    >
      <fieldset disabled={busy}>
        <h2>{mode === "Issue" ? "Issue checkout" : "Return checkout"}</h2>
        <div onChange={() => R(undefined)}>
          {mode === "Return" && (
            <div className="fields">
              <label>
                Checkout item
                <select
                  value={position}
                  onChange={(e) => P(Number(e.target.value))}
                >
                  {pending.map((l) => (
                    <option key={l.i} value={l.i}>
                      {l.name} · {l.left} outstanding · line {l.i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity returning
                <input
                  type="number"
                  min="1"
                  max={
                    record.lines[position].quantity -
                    record.lines[position].returned
                  }
                  required
                  value={qty}
                  onChange={(e) => Q(e.target.value)}
                />
              </label>
              <label>
                Returned condition
                <select value={condition} onChange={(e) => C(e.target.value)}>
                  <option>Good</option>
                  <option>Damaged</option>
                  <option>Missing</option>
                </select>
              </label>
            </div>
          )}
          <div className="fields">
            <label>
              Discount
              <input
                type="number"
                min="0"
                max={percent ? 100 : undefined}
                step=".01"
                placeholder="0"
                value={discount}
                onChange={(e) => D(e.target.value)}
              />
            </label>
            <label>
              Discount type
              <select
                value={percent ? "pct" : "fixed"}
                onChange={(e) => U(e.target.value === "pct")}
              >
                <option value="fixed">Rupees</option>
                <option value="pct">Percent of rental charges</option>
              </select>
            </label>
            {Number(discount) > 0 && (
              <label>
                Discount reason
                <input
                  required
                  value={reason}
                  onChange={(e) => N(e.target.value)}
                />
              </label>
            )}
          </div>
          {last && (
            <label>
              <input
                type="checkbox"
                checked={finalize}
                onChange={(e) => Z(e.target.checked)}
              />
              Finalize bill with this return
            </label>
          )}
        </div>
        {review && (
          <>
            <p>
              <b>
                {mode === "Issue" ? "Issue total" : "Bill total"}{" "}
                {rupees(review.total)}
              </b>{" "}
              · Previously paid {rupees(review.paid)} · Balance{" "}
              {rupees(review.balance)}
            </p>
            <div className="fields">
              <label>
                Collect now (₹)
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, review.balance) / 100}
                  step=".01"
                  required
                  value={amount}
                  onChange={(e) => M(e.target.value)}
                />
              </label>
              <label>
                Collection method
                <select
                  value={method}
                  onChange={(e) => H(e.target.value as Checkout["method"])}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank transfer</option>
                </select>
              </label>
              <label>
                Reference
                <input value={reference} onChange={(e) => F(e.target.value)} />
              </label>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button>
          {review
            ? mode === "Issue"
              ? "Confirm issue and collection"
              : "Confirm return and collection"
            : "Review amount to collect"}
        </button>
      </fieldset>
    </form>
  );
}
