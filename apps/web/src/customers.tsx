import { headers, setOwnerKey } from "./owner-access";
import { useState, useEffect, type FormEvent } from "react";
import { normalizePhone, type Customer } from "@rentaldesk/shared";
import { Pages } from "./inventory";
const base = "#/customers";
function Directory({ customers }: { customers: Customer[] }) {
  const [search, S] = useState(""),
    [order, O] = useState("name");
  const query = search.trim().toLowerCase(),
    digits = normalizePhone(query);
  const rows = customers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (digits && c.phones.some((p) => normalizePhone(p).includes(digits))),
    )
    .sort((a, b) =>
      order === "recent"
        ? b.id - a.id
        : a.name.localeCompare(b.name) || a.id - b.id,
    );
  return (
    <>
      <h1>Customers</h1>
      <nav>
        <a href={base + "/new"}>Add customer</a>
      </nav>
      <div className="fields">
        <label>
          Search customers
          <input
            type="search"
            placeholder="Name or phone number"
            value={search}
            onChange={(e) => S(e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select value={order} onChange={(e) => O(e.target.value)}>
            <option value="name">Name</option>
            <option value="recent">Newest first</option>
          </select>
        </label>
      </div>
      <Pages
        key={JSON.stringify([query, order])}
        rows={rows}
        render={(page) =>
          page.length ? (
            <ul>
              {page.map((c) => (
                <li key={c.id}>
                  <div>
                    <a href={base + "/" + c.id}>{c.name}</a>
                    <small>{c.phones.join(" · ")}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>{query ? "No matching customers." : "No customers yet."}</p>
          )
        }
      />
    </>
  );
}
function Editor({ customer }: { customer?: Customer }) {
  const [phones, P] = useState(customer?.phones || [""]),
    [error, E] = useState(""),
    [duplicates, D] = useState<Pick<Customer, "id" | "name">[]>([]),
    [busy, B] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    B(true);
    E("");
    try {
      const r = await fetch(
        "/api/customers" + (customer ? "/" + customer.id : ""),
        {
          method: customer ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify({
            name: form.get("name"),
            address: form.get("address"),
            phones,
            revision: customer?.revision,
            allowSharedPhone: form.get("shared") === "on",
          }),
        },
      );
      const data = await r.json();
      if (!r.ok) {
        D(data.duplicates || []);
        throw Error(data.message);
      }
      location.hash = base + "/" + data.id;
    } catch (err) {
      E(err instanceof Error ? err.message : "Could not save customer.");
    } finally {
      B(false);
    }
  }
  return (
    <>
      <h1>{customer ? "Edit customer" : "Add customer"}</h1>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Customer name
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={customer?.name}
            />
          </label>
          <label>
            Address
            <textarea
              name="address"
              required
              maxLength={1000}
              defaultValue={customer?.address}
            />
          </label>
          {phones.map((p, i) => (
            <div key={i}>
              <label>
                Phone {i + 1}
                <input
                  type="tel"
                  value={p}
                  required
                  onChange={(e) => {
                    D([]);
                    P(phones.map((v, j) => (i === j ? e.target.value : v)));
                  }}
                />
              </label>
              {phones.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    D([]);
                    P(phones.filter((_, j) => j !== i));
                  }}
                >
                  Remove phone {i + 1}
                </button>
              )}
            </div>
          ))}
          {phones.length < 10 && (
            <button
              type="button"
              onClick={() => {
                D([]);
                P([...phones, ""]);
              }}
            >
              Add phone number
            </button>
          )}
          {error && <p role="alert">{error}</p>}
          {duplicates.length > 0 && (
            <>
              <ul>
                {duplicates.map((c) => (
                  <li key={c.id}>
                    <a href={base + "/" + c.id}>{c.name}</a>
                  </li>
                ))}
              </ul>
              <label>
                <input type="checkbox" name="shared" />
                Save with shared phone number
              </label>
            </>
          )}
          <nav>
            <button>Save customer</button>
            <a href={customer ? base + "/" + customer.id : base}>Cancel</a>
          </nav>
        </fieldset>
      </form>
    </>
  );
}
export function Customers({ path }: { path: string }) {
  const [customers, C] = useState<Customer[]>(),
    [error, E] = useState(""),
    [locked, L] = useState(false),
    [attempt, A] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/customers", { headers: headers() })
      .then(async (r) => {
        const data = await r.json();
        if (!active) return;
        L(r.status === 403);
        if (!r.ok) throw Error(data.message);
        C(data);
        E("");
      })
      .catch((err) => {
        if (active) E(err.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const [, , id, action] = path.split("/");
  const c = customers?.find((c) => String(c.id) === id);
  return (
    <main className="management">
      <nav>
        <a href="#/">Dashboard</a>
        <a href={base}>Customers</a>
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
            <input type="password" required name="key" />
          </label>
          <button>Open customers</button>
        </form>
      ) : !customers ? (
        error ? (
          <button onClick={() => A(attempt + 1)}>Retry</button>
        ) : (
          <p>Loading customers…</p>
        )
      ) : !id ? (
        <Directory customers={customers} />
      ) : id === "new" ? (
        <Editor />
      ) : !c ? (
        <p>Customer not found.</p>
      ) : action === "edit" ? (
        <Editor customer={c} />
      ) : (
        <>
          <h1>{c.name}</h1>
          <nav>
            <a href={base + "/" + id + "/edit"}>Edit customer</a>
          </nav>
          <h2>Address</h2>
          <p>{c.address}</p>
          <h2>Phone numbers</h2>
          <ul>
            {c.phones.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
