import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  adjustmentKinds,
  type CatalogItem,
  type Inventory,
  type Movement,
} from "@rentaldesk/shared";
type Save = (
  path: string,
  data: object,
  destination: (result: { id: string }) => string,
) => Promise<void>;
const base = "#/inventory";
const itemLink = (id: string) => base + "/items/" + encodeURIComponent(id);
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    n / 100,
  );
function Field({
  name,
  title,
  value,
  number = false,
  moneyField = false,
  required = true,
}: {
  name: string;
  title: string;
  value?: string | number;
  number?: boolean;
  moneyField?: boolean;
  required?: boolean;
}) {
  return (
    <label>
      {title}
      <input
        name={name}
        defaultValue={value}
        required={required}
        type={number ? "number" : "text"}
        min={number ? 0 : undefined}
        step={number ? (moneyField ? "0.01" : "1") : undefined}
      />
    </label>
  );
}
export function Pages<T>({
  resetKey,
  rows,
  render,
}: {
  resetKey?: string;
  rows: T[];
  render: (page: T[]) => ReactNode;
}) {
  const [offset, setOffset] = useState(0),
    [size, setSize] = useState(10);
  const [previousKey, setPreviousKey] = useState(resetKey);
  if (previousKey !== resetKey) {
    setPreviousKey(resetKey);
    setOffset(0);
  }
  const last = Math.max(0, Math.ceil(rows.length / size) - 1),
    page = Math.min(last, offset);
  return (
    <>
      {render(rows.slice(page * size, (page + 1) * size))}
      <div className="pager">
        <span>{rows.length} results</span>
        <label>
          Per page{" "}
          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setOffset(0);
            }}
          >
            {[10, 25, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button disabled={!page} onClick={() => setOffset(page - 1)}>
          Previous
        </button>
        <span>
          {page + 1} / {last + 1}
        </span>
        <button disabled={page === last} onClick={() => setOffset(page + 1)}>
          Next
        </button>
      </div>
    </>
  );
}
function Catalog({ data }: { data: Inventory }) {
  const [q, Q] = useState(""),
    [category, C] = useState(""),
    [status, S] = useState(""),
    [sort, T] = useState("category");
  const rows = data.items
    .filter(
      (i) =>
        (!category || category === i.category) &&
        (!status || status === String(i.active)) &&
        [i.id, i.name, i.category].some((v) =>
          v.toLowerCase().includes(q.trim().toLowerCase()),
        ),
    )
    .sort(
      (a, b) =>
        (sort === "category" ? a.category.localeCompare(b.category) : 0) ||
        (sort === "id"
          ? a.id.localeCompare(b.id)
          : a.name.localeCompare(b.name)),
    );
  return (
    <>
      <h1>Inventory</h1>
      <nav>
        <a href={base + "/new"}>Add item</a>
        <a href={base + "/categories"}>Manage categories</a>
      </nav>
      <div className="fields">
        <label>
          Search inventory
          <input
            type="search"
            value={q}
            placeholder="Scan or enter item ID, name or category"
            onChange={(e) => Q(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const i = rows.find(
                  (i) => i.id.toLowerCase() === q.trim().toLowerCase(),
                );
                if (i) location.hash = itemLink(i.id);
              }
            }}
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => C(e.target.value)}>
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => S(e.target.value)}>
            <option value="">All statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => T(e.target.value)}>
            <option value="category">Category and name</option>
            <option value="name">Name</option>
            <option value="id">Item ID</option>
          </select>
        </label>
      </div>
      <Pages
        key={JSON.stringify([q, category, status, sort])}
        rows={rows}
        render={(page) => (
          <ul>
            {page.map((i) => (
              <li key={i.id}>
                <div>
                  <a href={itemLink(i.id)}>{i.name}</a>
                  <small>
                    {i.id} · {i.category} · {i.active ? "Active" : "Inactive"}
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
      />
    </>
  );
}
function ItemForm({
  item,
  data,
  save,
}: {
  item?: CatalogItem;
  data: Inventory;
  save: Save;
}) {
  const [model, setModel] = useState(item?.model || "Daily");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      v = Object.fromEntries(f);
    void save(
      "items",
      {
        ...v,
        id: item?.id,
        revision: item?.revision,
        active: Number(v.active),
        period: Number(v.period || 1),
        opening: Number(v.opening || 0),
        rate: Math.round(Number(v.rate) * 100),
        cost: Math.round(Number(v.cost) * 100),
        replacement: Math.round(Number(v.replacement) * 100),
      },
      (r) => itemLink(r.id),
    );
  }
  return (
    <>
      <h1>{item ? "Edit item" : "Add item"}</h1>
      <form onSubmit={submit}>
        <div className="fields">
          <Field name="name" title="Item name" value={item?.name} />
          <label>
            Category
            <select
              aria-label="Category"
              name="category"
              required
              defaultValue={item?.category || ""}
            >
              <option value="">Select category</option>
              {data.categories
                .filter((c) => c.active || c.name === item?.category)
                .map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
            </select>
          </label>
          <Field name="zone" title="Zone (room)" value={item?.zone} />
          <Field name="subzone" title="Subzone (rack)" value={item?.subzone} />
          <label>
            Description
            <textarea name="description" defaultValue={item?.description} />
          </label>
          <label>
            Status
            <select name="active" defaultValue={item?.active ?? 1}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </label>
          <label>
            Pricing model
            <select
              name="model"
              value={model}
              onChange={(e) => setModel(e.target.value as CatalogItem["model"])}
            >
              <option>Daily</option>
              <option>Fixed period</option>
            </select>
          </label>
          {model === "Fixed period" && (
            <label>
              Period (days)
              <input
                type="number"
                min="1"
                max="3650"
                required
                name="period"
                defaultValue={item?.period || 1}
              />
            </label>
          )}
          {(["rate", "cost", "replacement"] as const).map((key, i) => (
            <Field
              key={key}
              name={key}
              title={
                [
                  "Rental rate (₹)",
                  "Purchase cost (₹)",
                  "Replacement cost (₹)",
                ][i]
              }
              value={(item?.[key] || 0) / 100}
              number
              moneyField
            />
          ))}
          {!item && (
            <Field name="opening" title="Opening quantity" value={0} number />
          )}
        </div>
        <button>Save item</button>
        <a href={item ? itemLink(item.id) : base}>Cancel</a>
      </form>
    </>
  );
}
function Categories({
  data,
  save,
  edit,
}: {
  data: Inventory;
  save: Save;
  edit: string | undefined;
}) {
  const [q, Q] = useState("");
  if (edit !== undefined) {
    const original = data.categories.find((c) => c.name === edit);
    if (edit && !original) return <p>Category not found.</p>;
    return (
      <>
        <h1>{original ? "Edit category" : "Add category"}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void save(
              "categories",
              {
                original: original?.name,
                name: f.get("name"),
                active: Number(f.get("active")),
              },
              () => base + "/categories",
            );
          }}
        >
          <Field name="name" title="Category name" value={original?.name} />
          <label>
            Status
            <select name="active" defaultValue={original?.active ?? 1}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </label>
          <button>Save category</button>
          <a href={base + "/categories"}>Cancel</a>
        </form>
      </>
    );
  }
  return (
    <>
      <h1>Categories</h1>
      <nav>
        <a href={base + "/categories/new"}>Add category</a>
      </nav>
      <label>
        Search categories
        <input type="search" value={q} onChange={(e) => Q(e.target.value)} />
      </label>
      <Pages
        key={q}
        rows={data.categories.filter((c) =>
          c.name.toLowerCase().includes(q.trim().toLowerCase()),
        )}
        render={(page) => (
          <ul>
            {page.map((c) => (
              <li key={c.name}>
                <a
                  href={base + "/categories/edit/" + encodeURIComponent(c.name)}
                >
                  {c.name}
                </a>
                {c.active ? "Active" : "Inactive"}
              </li>
            ))}
          </ul>
        )}
      />
    </>
  );
}
function ItemScreen({
  item,
  mode,
  save,
}: {
  item: CatalogItem;
  mode?: string;
  save: Save;
}) {
  const link = itemLink(item.id);
  const [history, H] = useState<Movement[]>(),
    [error, E] = useState("");
  useEffect(() => {
    if (mode !== "history") return;
    let alive = true;
    fetch("/api/inventory/" + encodeURIComponent(item.id) + "/history")
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((h) => {
        if (alive) H(h);
      })
      .catch(() => {
        if (alive) E("Could not load history. Reload to retry.");
      });
    return () => {
      alive = false;
    };
  }, [item.id, mode]);
  if (mode === "adjust")
    return (
      <>
        <h1>Adjust stock</h1>
        <p>
          {item.name} · {item.owned} owned · {item.unusable} unusable
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void save(
              "adjustments",
              {
                id: item.id,
                revision: item.revision,
                kind: f.get("kind"),
                quantity: Number(f.get("quantity")),
                reason: f.get("reason"),
              },
              () => link + "/history",
            );
          }}
        >
          <label>
            Movement
            <select name="kind">
              {adjustmentKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input name="quantity" type="number" min="1" required />
          </label>
          <Field name="reason" title="Reason" />
          <button>Record adjustment</button>
          <a href={link}>Cancel</a>
        </form>
      </>
    );
  if (mode === "history")
    return (
      <>
        <h1>Stock history</h1>
        <a href={link}>{item.name}</a>
        {history ? (
          <Pages
            rows={history}
            render={(page) => (
              <ul>
                {page.map((m) => (
                  <li key={m.id}>
                    <div>
                      <b>
                        {m.kind} · {m.quantity}
                      </b>
                      <small>
                        {m.reason} · {m.actor}
                      </small>
                    </div>
                    <div>
                      {m.owned} owned · {m.unusable} unusable
                      <small>
                        {new Date(
                          m.created.replace(" ", "T") + "Z",
                        ).toLocaleString("en-GB")}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        ) : (
          <p>{error || "Loading history…"}</p>
        )}
      </>
    );
  return (
    <>
      <h1>{item.name}</h1>
      <p>
        {item.id} · {item.category} · {item.active ? "Active" : "Inactive"}
      </p>
      <nav>
        <a href={link + "/edit"}>Edit item</a>
        <a href={link + "/adjust"}>Adjust stock</a>
        <a href={link + "/history"}>Stock history</a>
      </nav>
      <dl>
        {Object.entries({
          "Barcode / QR value": item.id,
          Location: item.zone + " · " + item.subzone,
          Description: item.description || "—",
          "Owned units": item.owned,
          "Unusable units": item.unusable,
          "Rental rate":
            money(item.rate) +
            (item.model === "Daily"
              ? " per day"
              : " per " + item.period + " days"),
          "Purchase cost": money(item.cost),
          "Replacement cost": money(item.replacement),
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
export function InventoryScreen({ path }: { path: string }) {
  const [data, D] = useState<Inventory>(),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [key, K] = useState("");
  useEffect(() => {
    fetch("/api/inventory")
      .then(async (r) => {
        if (!r.ok) throw Error();
        D(await r.json());
      })
      .catch(() => E("Could not load inventory. Reload to retry."));
  }, []);
  const save: Save = async (endpoint, payload, destination) => {
    if (busy) return;
    B(true);
    E("");
    try {
      const r = await fetch("/api/inventory/" + endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify(payload),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.message || "Save failed.");
      location.hash = destination(result);
    } catch (err) {
      E(err instanceof Error ? err.message : "Save failed.");
    } finally {
      B(false);
    }
  };
  const [, section, id, mode] = path
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const item = data?.items.find((i) => i.id === id);
  const editing =
    section === "new" ||
    mode === "edit" ||
    mode === "adjust" ||
    (section === "categories" && !!id);
  return (
    <main className="management">
      <nav>
        <a href="#/">Dashboard</a>
        <a href={base}>Inventory</a>
      </nav>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>Loading inventory…</p>
      ) : (
        <fieldset disabled={busy}>
          {editing && !data.demoAccess && (
            <label>
              Inventory access key
              <input
                type="password"
                value={key}
                onChange={(e) => K(e.target.value)}
              />
            </label>
          )}
          {section === "new" ? (
            <ItemForm data={data} save={save} />
          ) : section === "categories" ? (
            <Categories
              data={data}
              save={save}
              edit={id === "new" ? "" : id === "edit" ? mode : undefined}
            />
          ) : section === "items" ? (
            item ? (
              mode === "edit" ? (
                <ItemForm data={data} save={save} item={item} />
              ) : (
                <ItemScreen item={item} mode={mode} save={save} />
              )
            ) : (
              <p>Item not found.</p>
            )
          ) : (
            <Catalog data={data} />
          )}
        </fieldset>
      )}
    </main>
  );
}
