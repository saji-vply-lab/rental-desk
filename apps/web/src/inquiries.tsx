import { RentalActions } from "./rental-actions";
import { ItemPicker } from "./item-picker";
import { useEffect, useState, type FormEvent } from "react";
import type {
  Customer,
  Inventory,
  InquiryLine,
  InquirySummary,
  InquiryDetails,
} from "@rentaldesk/shared";
import { Pages } from "./inventory";
import { headers, setOwnerKey } from "./owner-access";
const inquiries = {
  base: "#/inquiries",
  api: "/api/inquiries",
  title: "Rental inquiries",
  noun: "inquiry",
  prefix: "INQ",
};
const drafts = {
  base: "#/rental-drafts",
  api: "/api/rental-drafts",
  title: "Rentals",
  noun: "rental draft",
  prefix: "RNT",
};
type Config = typeof inquiries;
const dateLabel = (date: string) => date.split("-").reverse().join("/");
function Directory({
  rows,
  config,
}: {
  rows: InquirySummary[];
  config: Config;
}) {
  const { base, title, noun, prefix } = config;
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [order, setOrder] = useState("recent");
  const matches = rows
    .filter(
      (r) => !status || (status === "At risk" ? r.atRisk : r.status === status),
    )
    .filter((r) =>
      (r.customer + " " + prefix + "-" + r.id)
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
    )
    .sort((a, b) =>
      order === "start"
        ? a.start.localeCompare(b.start) || a.id - b.id
        : b.id - a.id,
    );
  return (
    <>
      <h1>{title}</h1>
      <nav>
        <a href={base + "/new"}>New {noun}</a>
      </nav>
      <label>
        Search by customer or reference
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Customer or reference"
        />
      </label>
      <label>
        Sort by
        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="recent">Newest first</option>
          <option value="start">Start date</option>
        </select>
      </label>
      {config === drafts && (
        <label>
          Rental status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {[
              "Draft",
              "Booked",
              "At risk",
              "Issued",
              "Partially returned",
              "Completed",
              "Cancelled",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <Pages
        key={query + order + status}
        rows={matches}
        render={(page) =>
          page.length ? (
            <ul>
              {page.map((r) => (
                <li key={r.id}>
                  <a href={base + "/" + r.id}>
                    {prefix}-{r.id} · {r.customer}
                  </a>
                  <span>
                    {dateLabel(r.start)}
                    {config === drafts && (
                      <small>
                        {r.status}
                        {r.atRisk ? " · At risk" : ""}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No matching records.</p>
          )
        }
      />
    </>
  );
}
function Editor({
  customers,
  inventory,
  config,
  existing,
}: {
  customers: Customer[];
  inventory: Inventory;
  config: Config;
  existing?: InquiryDetails;
}) {
  const { base, api, noun } = config;
  const [lines, setLines] = useState<(InquiryLine & { key: string })[]>(
      () =>
        existing?.lines.map((l) => ({ ...l, key: crypto.randomUUID() })) ?? [],
    ),
    [start, S] = useState(existing?.start ?? ""),
    [due, D] = useState(existing?.due ?? ""),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [requestId] = useState(() => crypto.randomUUID());
  const active = inventory.items.filter((i) => i.active);
  function update(key: string, patch: Partial<InquiryLine>) {
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) {
      E("Add at least one item.");
      return;
    }
    const customerId = Number(new FormData(e.currentTarget).get("customer"));
    B(true);
    E("");
    try {
      const r = await fetch(existing ? api + "/" + existing.id : api, {
        method: existing ? "PUT" : "POST",
        headers: headers(),
        body: JSON.stringify({
          customerId,
          start,
          due,
          lines,
          requestId,
          revision: existing?.revision,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message);
      location.hash = base + "/" + data.id;
    } catch (err) {
      E(err instanceof Error ? err.message : "Save failed.");
    } finally {
      B(false);
    }
  }
  return (
    <>
      <h1>
        {existing ? "Edit" : "New"} {noun}
      </h1>
      {!customers.length ? (
        <p>
          <a href="#/customers/new">Add a customer</a> to start a {noun}.
        </p>
      ) : !active.length ? (
        <p>
          <a href="#/inventory/new">Add an active item</a> to start a {noun}.
        </p>
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <label>
              Customer
              <select
                required
                name="customer"
                defaultValue={existing?.customerId ?? ""}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phones[0]}
                  </option>
                ))}
              </select>
            </label>
            <div className="fields">
              <label>
                Common start date
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => S(e.target.value)}
                />
              </label>
              <label>
                Common return date
                <input
                  type="date"
                  required
                  min={start}
                  value={due}
                  onChange={(e) => D(e.target.value)}
                />
              </label>
            </div>
            <ItemPicker
              items={active}
              disabled={!start || !due || start > due}
              onAdd={(item, quantity) =>
                setLines((previous) => [
                  ...previous,
                  {
                    key: crypto.randomUUID(),
                    itemId: item.id,
                    quantity,
                    startOverride: null,
                    dueOverride: null,
                  },
                ])
              }
            />
            {lines.map((l, index) => (
              <fieldset key={l.key} className="editable-line">
                <legend className="sr-only">Item {index + 1}</legend>
                <div className="line-title">
                  <b>{inventory.items.find((i) => i.id === l.itemId)?.name}</b>
                  <small>{l.itemId}</small>
                </div>
                <label className="line-quantity">
                  Quantity
                  <input
                    type="number"
                    required
                    min="1"
                    value={l.quantity || ""}
                    onChange={(e) =>
                      update(l.key, { quantity: Number(e.target.value) })
                    }
                  />
                </label>
                <details className="line-dates">
                  <summary>
                    <span>
                      {dateLabel(l.startOverride ?? start)} –{" "}
                      {dateLabel(l.dueOverride ?? due)}
                    </span>
                    <small>
                      {l.startOverride !== null || l.dueOverride !== null
                        ? "Custom dates"
                        : "Common dates"}{" "}
                      · Edit
                    </small>
                  </summary>
                  <div className="date-options">
                    {(["startOverride", "dueOverride"] as const).map((k) => {
                      const title = k === "startOverride" ? "start" : "return",
                        common = k === "startOverride" ? start : due;
                      return (
                        <div key={k}>
                          <label>
                            <input
                              type="checkbox"
                              checked={l[k] !== null}
                              onChange={(e) =>
                                update(l.key, {
                                  [k]: e.target.checked ? common : null,
                                })
                              }
                            />
                            Override {title} date
                          </label>
                          {l[k] !== null ? (
                            <label>
                              Item {title} date
                              <input
                                type="date"
                                required
                                min={
                                  k === "dueOverride"
                                    ? (l.startOverride ?? start)
                                    : undefined
                                }
                                value={l[k]}
                                onChange={(e) =>
                                  update(l.key, { [k]: e.target.value })
                                }
                              />
                            </label>
                          ) : (
                            <small>
                              {title === "start" ? "Starts" : "Due"}{" "}
                              {dateLabel(common)}
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
                <button
                  className="line-remove"
                  type="button"
                  onClick={() =>
                    setLines(lines.filter((row) => row.key !== l.key))
                  }
                >
                  Remove item
                </button>
              </fieldset>
            ))}
            <p>Saving this {noun} does not reserve stock.</p>
            {error && <p role="alert">{error}</p>}
            <button>Save {noun}</button> <a href={base}>Cancel</a>
          </fieldset>
        </form>
      )}
    </>
  );
}
export function Inquiries({ path }: { path: string }) {
  const config = path.startsWith("/rental-drafts") ? drafts : inquiries;
  const { base, api, title, noun, prefix } = config;
  const [, , id, action] = path.split("/");
  const [rows, R] = useState<InquirySummary[]>(),
    [details, T] = useState<InquiryDetails>(),
    [form, F] = useState<{ customers: Customer[]; inventory: Inventory }>(),
    [error, E] = useState(""),
    [locked, L] = useState(false),
    [attempt, A] = useState(0);
  useEffect(() => {
    let alive = true;
    async function get(url: string) {
      const r = await fetch(url, { headers: headers() });
      const data = await r.json();
      if (!r.ok) {
        if (alive) L(r.status === 403);
        throw Error(data.message || "Load failed.");
      }
      return data;
    }
    async function load() {
      if (id === "new" || action === "edit") {
        const [customers, inventory, record] = await Promise.all([
          get("/api/customers"),
          get("/api/inventory"),
          action === "edit"
            ? get(api + "/" + encodeURIComponent(id))
            : undefined,
        ]);
        if (alive) {
          T(record);
          if (!record || record.status === "Draft") F({ customers, inventory });
        }
      } else if (id) {
        const d = await get(api + "/" + encodeURIComponent(id));
        if (alive) T(d);
      } else {
        const list = await get(api);
        if (alive) R(list);
      }
      if (alive) {
        L(false);
        E("");
      }
    }
    load().catch((err) => {
      if (alive) E(err.message);
    });
    return () => {
      alive = false;
    };
  }, [id, action, api, attempt]);
  return (
    <main className="management">
      <nav>
        <a href="#/">Dashboard</a>
        <a href={base}>{title}</a>
      </nav>
      {error && <p role="alert">{error}</p>}
      {locked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOwnerKey(String(new FormData(e.currentTarget).get("key")));
            A(attempt + 1);
          }}
        >
          <label>
            Owner access key
            <input name="key" type="password" required />
          </label>
          <button>Open records</button>
        </form>
      ) : form ? (
        <Editor {...form} config={config} existing={details} />
      ) : rows ? (
        <Directory rows={rows} config={config} />
      ) : details ? (
        <>
          <h1>
            {prefix}-{details.id}
          </h1>
          {details.status === "Draft" && (
            <a href={base + "/" + details.id + "/edit"}>Edit {noun}</a>
          )}
          <p>
            {details.customer} ·{" "}
            {config === drafts ? details.status : "Unreserved"}
            {details.atRisk ? " · At risk: awaiting returns" : ""}
          </p>
          <p>
            {dateLabel(details.start)} – {dateLabel(details.due)}
          </p>
          <ul>
            {details.lines.map((l, i) => (
              <li className="saved-line" key={i}>
                <div>
                  <b>{l.name}</b>
                  <small>{l.itemId}</small>
                </div>
                <span className="saved-dates">
                  {dateLabel(l.startOverride ?? details.start)} –{" "}
                  {dateLabel(l.dueOverride ?? details.due)}
                </span>
                <span className="saved-quantity">
                  Quantity {l.quantity}
                  {details.issuedAt && (
                    <small>{l.quantity - l.returned} outstanding</small>
                  )}
                  {l.rate !== null && (
                    <small>
                      ₹{(l.rate / 100).toFixed(2)} /{" "}
                      {l.model === "Daily" ? "day" : l.period + " days"}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <RentalActions
            record={details}
            inquiry={config === inquiries}
            refresh={() => A(attempt + 1)}
          />
        </>
      ) : error ? (
        <button onClick={() => A(attempt + 1)}>Retry</button>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}
