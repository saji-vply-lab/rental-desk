import { useEffect, useState } from "react";
import { Pages } from "./inventory";
import { headers } from "./owner-access";
import type { OperationsDashboard } from "@rentaldesk/shared";
import { rupees } from "./billing";
type Returned = {
  id: number;
  rentalId: number;
  customer: string;
  item: string;
  quantity: number;
  condition: string;
  remaining: number;
  created: string;
};
export function CounterHistory() {
  const [rows, R] = useState<Returned[]>(),
    [stats, S] = useState<OperationsDashboard>(),
    [error, E] = useState(""),
    [attempt, A] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function get(path: string) {
      const r = await fetch("/api/dashboard/" + path, {
        headers: headers(),
        signal: abort.signal,
      });
      if (!r.ok) throw Error();
      return r.json();
    }
    Promise.all([get("history"), get("operations")])
      .then(([h, s]) => {
        R(h.returns);
        S(s);
        E("");
      })
      .catch(() => {
        if (!abort.signal.aborted) E("Could not load counter history.");
      });
    return () => abort.abort();
  }, [attempt]);
  if (error)
    return (
      <p role="alert">
        {error} <button onClick={() => A(attempt + 1)}>Retry</button>
      </p>
    );
  return (
    <>
      <h2>Returned items</h2>
      {rows ? (
        rows.length ? (
          <Pages
            rows={rows}
            render={(page) => (
              <ul>
                {page.map((r) => (
                  <li key={r.id}>
                    <div>
                      <a href={"#/rental-drafts/" + r.rentalId}>
                        RNT-{r.rentalId} · {r.customer}
                      </a>
                      <small>
                        {r.item} · {r.quantity} {r.condition} · {r.remaining}{" "}
                        remaining
                      </small>
                    </div>
                    <span>
                      {new Date(
                        r.created.replace(" ", "T") + "Z",
                      ).toLocaleDateString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          />
        ) : (
          <p>No returns recorded.</p>
        )
      ) : (
        <p>Loading history…</p>
      )}
      {stats && (
        <details>
          <summary>Counter activity and collections</summary>
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Today</th>
                <th>This month</th>
              </tr>
            </thead>
            <tbody>
              {stats.activity.map((r) => (
                <tr key={r.action}>
                  <th>{r.action === "Return" ? "Units returned" : r.action}</th>
                  <td>{r.action === "Return" ? r.dayUnits : r.dayCount}</td>
                  <td>{r.action === "Return" ? r.monthUnits : r.monthCount}</td>
                </tr>
              ))}
              {stats.finance && (
                <tr>
                  <th>Net collections</th>
                  <td>{rupees(stats.finance.dayNet)}</td>
                  <td>{rupees(stats.finance.monthNet)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
