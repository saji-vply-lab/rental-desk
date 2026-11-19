import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Boxes, Layers, Wrench, Store } from "lucide-react";
import { overviewSchema, type Overview } from "@rentaldesk/shared";
import "./style.css";
declare const __BRAND__: { label: string; accent: string };
document.documentElement.style.setProperty("--accent", __BRAND__.accent);
function Dashboard() {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<Overview>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch("/api/overview", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return overviewSchema.parse(await r.json());
      })
      .then(setOverview)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  const rows = overview?.items || [];
  const query = search.trim().toLowerCase();
  const categories = [...new Set(rows.map((item) => item.category))].sort();
  const matches = rows.filter(
    (item) =>
      (!category || item.category === category) &&
      [item.id, item.name, item.category].some((field) =>
        field.toLowerCase().includes(query),
      ),
  );
  return (
    <>
      <header>
        <div className="brand">
          <Store aria-hidden="true" />
          {__BRAND__.label}
        </div>
        <span>{overview?.shop}</span>
      </header>
      <main>
        <h1>Dashboard</h1>
        {error ? (
          <p role="alert">
            Couldn’t load inventory.{" "}
            <button onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </p>
        ) : !overview ? (
          <p role="status">Loading inventory…</p>
        ) : (
          <>
            <section className="metrics" aria-label="Inventory totals">
              {[
                [Boxes, "Catalog items", rows.length],
                [Layers, "Owned units", rows.reduce((n, i) => n + i.owned, 0)],
                [
                  Wrench,
                  "Unusable units",
                  rows.reduce((n, i) => n + i.unusable, 0),
                ],
              ].map(([icon, label, value]) => {
                const Icon = icon as typeof Boxes;
                return (
                  <article key={String(label)}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{String(label)}</span>
                    <strong>{String(value)}</strong>
                  </article>
                );
              })}
            </section>
            <section className="stock">
              <h2>Stock overview</h2>
              {rows.length > 0 && (
                <div className="inventory-filters">
                  <label className="inventory-search">
                    Search inventory
                    <input
                      type="search"
                      value={search}
                      placeholder="Item ID, name or category"
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <label className="inventory-search">
                    Category
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="">All categories</option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {(query || category) && (
                <p role="status">
                  {matches.length} of {rows.length} items
                  {query && (
                    <button onClick={() => setSearch("")}>Clear search</button>
                  )}
                </p>
              )}
              {rows.length === 0 ? (
                <p>No inventory items yet.</p>
              ) : (
                <ul>
                  {matches.map((i) => (
                    <li key={i.id}>
                      <div>
                        <b>{i.name}</b>
                        <small>
                          {i.id} · {i.category}
                        </small>
                      </div>
                      <div>
                        {i.zone} · {i.subzone}
                        <small>
                          {i.owned} owned · {i.unusable} unusable
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Dashboard />);
