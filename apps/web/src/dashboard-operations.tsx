import { rupees } from "./billing";
import { useEffect, useState } from "react";
import type { OperationsDashboard, PendingReturn } from "@rentaldesk/shared";
import { Pages } from "./inventory";
import { headers, setOwnerKey } from "./owner-access";
const formatDate = (s: string) => s.split("-").reverse().join("/");
const rentalLink = (id: number) => "#/rental-drafts/" + id;
const sum = (lines: PendingReturn[]) =>
  lines.reduce((n, l) => n + l.outstanding, 0);
const filters = [
  "All outstanding",
  "Overdue",
  "Due today",
  "Upcoming",
] as const;
function Operations({ data }: { data: OperationsDashboard }) {
  const [filter, setFilter] =
    useState<(typeof filters)[number]>("All outstanding");
  const { pending, today, bookings, activity } = data;
  const overdue = pending.filter((l) => l.due < today),
    due = pending.filter((l) => l.due === today);
  const visible =
    filter === "Overdue"
      ? overdue
      : filter === "Due today"
        ? due
        : filter === "Upcoming"
          ? pending.filter((l) => l.due > today)
          : pending;
  const critical = bookings.filter((b) => b.atRisk && b.due >= today);
  return (
    <>
      <div className="operations-metrics">
        {[
          [
            "Active rentals",
            new Set(pending.map((l) => l.rentalId)).size,
            "Issued or partially returned",
          ],
          ["Due today", sum(due), due.length + " return lines"],
          ["Overdue units", sum(overdue), overdue.length + " return lines"],
          ["Available units", data.available, "Usable and uncommitted today"],
        ].map(([label, value, detail]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>
      {data.finance && (
        <section className="ops-section">
          <h3>Collections and balances</h3>
          <dl className="bill-totals">
            {[
              ["Net collected today", data.finance.dayNet],
              ["Net collected this month", data.finance.monthNet],
              ["Outstanding finalized bills", data.finance.outstanding],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{rupees(Number(value))}</dd>
              </div>
            ))}
          </dl>
          {data.finance.customers.length > 0 && (
            <details>
              <summary>Customer balances</summary>
              <Pages
                rows={data.finance.customers}
                render={(page) => (
                  <ul>
                    {page.map((c) => (
                      <li key={c.id}>
                        <a href={"#/customers/" + c.id}>{c.name}</a>
                        <span>{rupees(c.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              />
            </details>
          )}
        </section>
      )}
      <section className="ops-section" aria-labelledby="critical">
        <h3 id="critical">Critical returns</h3>
        {critical.length ? (
          <Pages
            rows={critical}
            render={(page) => (
              <ul>
                {page.map((b) => (
                  <li key={b.rentalId + "-" + b.position}>
                    <div>
                      <b>{b.name}</b> · {b.quantity} booked
                      <small>
                        Needed {formatDate(b.start)} ·{" "}
                        <a href={rentalLink(b.rentalId)}>
                          RNT-{b.rentalId} · {b.customer}
                        </a>
                      </small>
                      <details>
                        <summary>Outstanding stock for this item</summary>
                        {pending
                          .filter((l) => l.itemId === b.itemId)
                          .map((l) => (
                            <p key={l.rentalId + "-" + l.position}>
                              <a href={rentalLink(l.rentalId)}>
                                RNT-{l.rentalId} · {l.customer}
                              </a>{" "}
                              · {l.outstanding} due {formatDate(l.due)}
                            </p>
                          ))}
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        ) : (
          <p>No current bookings depend on outstanding returns.</p>
        )}
      </section>
      <section className="ops-section" aria-labelledby="returns">
        <div className="ops-heading">
          <h3 id="returns">Outstanding returns</h3>
          <label>
            Show{" "}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              {filters.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length ? (
          <Pages
            resetKey={filter}
            rows={visible}
            render={(page) => (
              <ul>
                {page.map((l) => (
                  <li key={l.rentalId + "-" + l.position}>
                    <div>
                      <b>{l.name}</b>
                      <small>
                        <a href={rentalLink(l.rentalId)}>
                          RNT-{l.rentalId} · {l.customer}
                        </a>
                      </small>
                    </div>
                    <div>
                      {l.outstanding} outstanding
                      <small>
                        {l.due < today
                          ? "Overdue"
                          : l.due === today
                            ? "Due today"
                            : "Due"}{" "}
                        · {formatDate(l.due)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        ) : (
          <p>No returns in this view.</p>
        )}
      </section>
      <section className="ops-section">
        <h3>Confirmed bookings</h3>
        {bookings.length ? (
          <Pages
            rows={bookings}
            render={(page) => (
              <ul>
                {page.map((b) => (
                  <li key={b.rentalId + "-" + b.position}>
                    <div>
                      <b>{b.name}</b> · {b.quantity} units
                      <small>
                        <a href={rentalLink(b.rentalId)}>
                          RNT-{b.rentalId} · {b.customer}
                        </a>
                      </small>
                    </div>
                    <div>
                      {formatDate(b.start)} – {formatDate(b.due)}
                      {b.atRisk ? <small>At risk</small> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        ) : (
          <p>No confirmed bookings awaiting issue.</p>
        )}
      </section>
      <section className="ops-section">
        <h3>Counter activity</h3>
        <table>
          <thead>
            <tr>
              <th>Activity</th>
              <th>Today</th>
              <th>This month</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Book", "Bookings confirmed"],
              ["Issue", "Rentals issued"],
              ["Return", "Units returned"],
              ["Cancel", "Cancellations"],
            ].map(([action, label]) => {
              const row = activity.find((r) => r.action === action);
              return (
                <tr key={action}>
                  <th>{label}</th>
                  <td>
                    {(action === "Return" ? row?.dayUnits : row?.dayCount) ?? 0}
                  </td>
                  <td>
                    {(action === "Return"
                      ? row?.monthUnits
                      : row?.monthCount) ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
export function DashboardOperations() {
  const [data, D] = useState<OperationsDashboard>(),
    [locked, L] = useState(false),
    [error, E] = useState(""),
    [attempt, A] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const r = await fetch("/api/dashboard/operations", {
        headers: headers(),
        signal: controller.signal,
      });
      if (r.status === 403) {
        D(undefined);
        L(true);
        E("Owner access is required.");
        return;
      }
      if (!r.ok) throw Error();
      D(await r.json());
      L(false);
      E("");
    }
    load().catch(() => {
      if (!controller.signal.aborted) E("Could not load rental activity.");
    });
    return () => controller.abort();
  }, [attempt]);
  return (
    <section className="stock operations" aria-labelledby="operations-title">
      <div className="ops-heading">
        <h2 id="operations-title">Rental operations</h2>
        {data && (
          <small>
            {formatDate(data.today)} ·{" "}
            <button onClick={() => A(attempt + 1)}>Refresh</button>
          </small>
        )}
      </div>
      {locked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOwnerKey(String(new FormData(e.currentTarget).get("key")));
            A(attempt + 1);
          }}
        >
          <label>
            Owner access key <input name="key" type="password" required />
          </label>
          <button>Open rental activity</button>
          {error && <p>{error}</p>}
        </form>
      ) : (
        <>
          {error && (
            <p role="alert">
              {error} <button onClick={() => A(attempt + 1)}>Retry</button>
            </p>
          )}
          {data ? (
            <Operations data={data} />
          ) : (
            !error && <p>Loading rental activity…</p>
          )}
        </>
      )}
    </section>
  );
}
