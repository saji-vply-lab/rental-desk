import { rupees } from "./billing";
function returnAmounts(snapshot: string) {
  const b = JSON.parse(snapshot);
  return [
    "Rental charges for this return: " + rupees(b.base),
    "Late fees for this return: " + rupees(b.late),
    "Net paid at return: " + rupees(b.paid),
    "Estimated balance at return: " + rupees(b.balance),
  ];
}
import { useState } from "react";
import type { InquiryDetails } from "@rentaldesk/shared";
import { headers } from "./owner-access";
export function RentalActions({
  record,
  inquiry,
  refresh,
}: {
  record: InquiryDetails;
  inquiry: boolean;
  refresh: () => void;
}) {
  const [busy, B] = useState(false),
    [risk, R] = useState(false),
    [receipt, setReceipt] = useState(""),
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
      {receipt && (
        <div className="return-slip">
          <h2>Return receipt</h2>
          <p style={{ whiteSpace: "pre-line" }}>{receipt}</p>
          <button onClick={() => window.print()}>
            Print receipt / Save PDF
          </button>
          {typeof navigator.share === "function" && (
            <button
              onClick={() =>
                navigator.share({ text: receipt }).catch((err) => {
                  if (err.name !== "AbortError") E("Sharing unavailable.");
                })
              }
            >
              Share receipt
            </button>
          )}
          <button onClick={() => setReceipt("")}>Close receipt</button>
        </div>
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
              <button
                onClick={() => {
                  setReceipt("");
                  requestAnimationFrame(() => window.print());
                }}
              >
                Print / Save PDF
              </button>
              {typeof navigator.share === "function" && (
                <button
                  onClick={() =>
                    navigator
                      .share({
                        title: "Rental RNT-" + record.id,
                        text: [
                          "Rental RNT-" + record.id,
                          record.customer,
                          record.status,
                          ...record.lines.map(
                            (l) =>
                              l.itemId +
                              " · " +
                              l.name +
                              " × " +
                              l.quantity +
                              " · " +
                              (l.startOverride ?? record.start) +
                              " to " +
                              (l.dueOverride ?? record.due),
                          ),
                        ].join("\n"),
                      })
                      .catch((err) => {
                        if (err.name !== "AbortError")
                          E("Sharing unavailable.");
                      })
                  }
                >
                  Share rental
                </button>
              )}
            </nav>
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
                    <button
                      onClick={() =>
                        setReceipt(
                          [
                            "Return #" +
                              event.id +
                              " · Rental RNT-" +
                              record.id,
                            record.customer,
                            new Date(
                              event.created.replace(" ", "T") + "Z",
                            ).toLocaleString("en-GB"),
                            record.lines[event.position!].itemId +
                              " · " +
                              record.lines[event.position!].name,
                            "Returned: " +
                              event.quantity +
                              " (" +
                              event.condition +
                              ")",
                            "Remaining after this return: " + event.remaining,
                            ...(event.billing_snapshot
                              ? returnAmounts(event.billing_snapshot)
                              : []),
                          ].join("\n"),
                        )
                      }
                    >
                      View receipt
                    </button>
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
