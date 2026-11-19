import { DashboardOperations } from "./dashboard-operations";
import { Inquiries } from "./inquiries";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Boxes, Layers, Wrench, Store } from "lucide-react";
import { overviewSchema, type Overview } from "@rentaldesk/shared";
import "./style.css";
import "@tenant/theme.css";
import { Customers } from "./customers";
import { InventoryScreen, Pages } from "./inventory";
declare const __BRAND__: { label: string; accent: string };
document.documentElement.style.setProperty("--brand-accent", __BRAND__.accent);
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
      <main className="dashboard">
        <section className="dashboard-banner" aria-labelledby="dashboard-title">
          <h1 id="dashboard-title">Dashboard</h1>
        </section>
        <nav aria-label="Shop workflows">
          <a href="#/customers">Customers</a>
          <a href="#/inquiries">Rental inquiries</a>
          <a href="#/rental-drafts">Rentals</a>
        </nav>
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
            <DashboardOperations />
            <section className="stock">
              <h2>Stock overview</h2>
              <nav>
                <a href="#/inventory">Manage inventory</a>
              </nav>
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
                <Pages
                  resetKey={JSON.stringify([category, query])}
                  rows={matches}
                  render={(page) =>
                    page.length ? (
                      <ul>
                        {page.map((i) => (
                          <li className="stock-row" key={i.id}>
                            <div>
                              <a
                                href={
                                  "#/inventory/items/" +
                                  encodeURIComponent(i.id)
                                }
                              >
                                {i.name}
                              </a>
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
                    ) : (
                      <p>No matching items.</p>
                    )
                  }
                />
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
function App() {
  const [path, setPath] = useState(location.hash.slice(1));
  useEffect(() => {
    const change = () => {
      setPath(location.hash.slice(1));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  if (path.startsWith("/inquiries") || path.startsWith("/rental-drafts"))
    return <Inquiries key={path} path={path} />;
  if (path.startsWith("/customers"))
    return <Customers key={path} path={path} />;
  return path.startsWith("/inventory") ? (
    <InventoryScreen key={path} path={path} />
  ) : (
    <Dashboard />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
