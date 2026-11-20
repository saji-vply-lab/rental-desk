import { CheckoutPanel } from "./checkout";
import { ReceiptButton } from "./receipt";
import { useState } from "react";
import type { InquiryDetails } from "@rentaldesk/shared";
import { headers } from "./owner-access";
export function RentalActions({
  record,
  inquiry,
  refresh,
  checkoutOpen = false,
}: {
  record: InquiryDetails;
  inquiry: boolean;
  refresh: () => void;
  checkoutOpen?: boolean;
}) {
  const [busy, B] = useState(false),
    [risk, R] = useState(false),
    [error, E] = useState("");
  async function perform(action: string, payload: object = {}) {
    B(true);
    E("");
    try {
      const r = await fetch(
        inquiry
          ? "/api/inquiries/" + record.id + "/rental"
          : "/api/rental-drafts/" + record.id + "/actions",
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            revision: record.revision,
            action,
            ...payload,
          }),
        },
      );
      const data = await r.json();
      R(!!data.atRisk);
      if (!r.ok) throw Error(data.message);
      if (inquiry) location.hash = "#/rental-drafts/" + data.id;
      else refresh();
    } catch (err) {
      E(err instanceof Error ? err.message : "Could not update rental.");
    } finally {
      B(false);
    }
  }
  const open = record.status === "Draft" || record.status === "Booked";
  return (
    <section className="rental-actions">
      {error && <p role="alert">{error}</p>}
      {risk && (
        <button
          disabled={busy}
          onClick={() => perform("Book", { acceptRisk: true })}
        >
          Confirm at-risk booking
        </button>
      )}
      <fieldset disabled={busy}>
        {inquiry ? (
          <button onClick={() => perform("Convert")}>
            Open as rental draft
          </button>
        ) : (
          <>
            <nav aria-label="Rental actions">
              {record.status === "Draft" && (
                <button onClick={() => perform("Book")}>Confirm booking</button>
              )}
              {open && (
                <>
                  <button onClick={() => perform("Issue")}>Issue rental</button>
                  <button onClick={() => perform("Cancel")}>
                    Cancel {record.status === "Draft" ? "draft" : "booking"}
                  </button>
                </>
              )}
              {record.events.some((e) => e.action === "Book") && (
                <ReceiptButton
                  rental={record.id}
                  documentKey="booking"
                  label="Booking confirmation"
                />
              )}
              {record.issuedAt && (
                <ReceiptButton
                  rental={record.id}
                  documentKey="issue"
                  label="Rental issue slip"
                />
              )}
            </nav>
            {(open ||
              ["Issued", "Partially returned"].includes(record.status)) && (
              <details open={checkoutOpen || undefined}>
                <summary>
                  {open
                    ? "Issue with discount or payment"
                    : "Return with discount or payment"}
                </summary>
                <CheckoutPanel
                  key={record.revision}
                  record={record}
                  mode={open ? "Issue" : "Return"}
                  refresh={refresh}
                />
              </details>
            )}
            {["Issued", "Partially returned"].includes(record.status) && (
              <form
                key={record.revision}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void perform("Return", {
                    position: Number(f.get("line")),
                    quantity: Number(f.get("qty")),
                    condition: f.get("condition"),
                  });
                }}
              >
                <h2>Record a return</h2>
                <div className="fields">
                  <label>
                    Return item
                    <select name="line">
                      {record.lines.map(
                        (l, i) =>
                          l.returned < l.quantity && (
                            <option key={i} value={i}>
                              {l.name} · {l.quantity - l.returned} outstanding ·
                              line {i + 1}
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                  <label>
                    Return quantity
                    <input
                      type="number"
                      name="qty"
                      min="1"
                      required
                      defaultValue="1"
                    />
                  </label>
                  <label>
                    Condition
                    <select name="condition">
                      <option>Good</option>
                      <option>Damaged</option>
                      <option>Missing</option>
                    </select>
                  </label>
                </div>
                <button>Save return</button>
              </form>
            )}
          </>
        )}
      </fieldset>
      {!inquiry && record.events.length > 0 && (
        <>
          <h2>Rental history</h2>
          <ul>
            {record.events.map((event) => (
              <li key={event.id}>
                <div>
                  {event.action === "Return"
                    ? "Return #" + event.id
                    : event.action}
                  <small>
                    {new Date(
                      event.created.replace(" ", "T") + "Z",
                    ).toLocaleString("en-GB")}
                  </small>
                </div>
                {event.position !== null && (
                  <span>
                    {record.lines[event.position]?.name} · {event.quantity}{" "}
                    {event.condition} · {event.remaining} remaining
                    <ReceiptButton
                      rental={record.id}
                      documentKey={"return-" + event.id}
                      label={"View return receipt #" + event.id}
                    />
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
