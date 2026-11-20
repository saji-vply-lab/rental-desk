import { useState } from "react";
import { normalizePhone, type Customer } from "@rentaldesk/shared";
import { headers } from "./owner-access";
export function CounterCustomer({
  customers,
  initial,
}: {
  customers: Customer[];
  initial?: number;
}) {
  const [list, L] = useState(customers),
    [id, I] = useState(initial ? String(initial) : ""),
    [q, Q] = useState(""),
    [adding, A] = useState(false),
    [name, N] = useState(""),
    [phone, P] = useState(""),
    [address, D] = useState(""),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [duplicates, U] = useState<Customer[]>([]);
  const results = list.filter(
    (c) =>
      String(c.id) === id ||
      c.name.toLowerCase().includes(q.trim().toLowerCase()) ||
      (normalizePhone(q) &&
        c.phones.some((p) => normalizePhone(p).includes(normalizePhone(q)))),
  );
  async function create() {
    B(true);
    E("");
    try {
      const r = await fetch("/api/customers", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name, address, phones: [phone] }),
      });
      const d = await r.json();
      if (!r.ok) {
        U(d.duplicates || []);
        throw Error(d.message);
      }
      L([...list, { id: d.id, name, address, phones: [phone], revision: 1 }]);
      I(String(d.id));
      Q("");
      A(false);
    } catch (err) {
      E(err instanceof Error ? err.message : "Customer save failed.");
    } finally {
      B(false);
    }
  }
  return (
    <section>
      <h2>Customer</h2>
      {!adding ? (
        <>
          <label>
            Find customer
            <input
              type="search"
              value={q}
              onChange={(e) => {
                Q(e.target.value);
                I("");
              }}
              placeholder="Name or phone"
            />
          </label>
          <label>
            Customer
            <select
              required
              aria-label="Customer"
              name="customer"
              value={id}
              onChange={(e) => I(e.target.value)}
            >
              <option value="">Select customer</option>
              {results.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phones[0]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              N(q);
              A(true);
              E("");
              U([]);
            }}
          >
            Add new customer
          </button>
        </>
      ) : (
        <fieldset disabled={busy}>
          <label>
            New customer name
            <input value={name} onChange={(e) => N(e.target.value)} />
          </label>
          <label>
            Phone
            <input
              type="tel"
              value={phone}
              onChange={(e) => P(e.target.value)}
            />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => D(e.target.value)} />
          </label>
          <button type="button" onClick={create}>
            Save and select customer
          </button>
          <button type="button" onClick={() => A(false)}>
            Cancel customer entry
          </button>
          {error && <p role="alert">{error}</p>}
          {duplicates.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                I(String(c.id));
                Q("");
                A(false);
              }}
            >
              Use {c.name}
            </button>
          ))}
        </fieldset>
      )}
    </section>
  );
}
