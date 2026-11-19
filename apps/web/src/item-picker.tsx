import { useRef, useState } from "react";
import type { CatalogItem } from "@rentaldesk/shared";

export function ItemPicker({
  items,
  onAdd,
  disabled,
}: {
  items: CatalogItem[];
  onAdd: (item: CatalogItem, quantity: number) => void;
  disabled: boolean;
}) {
  const [category, setCategory] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [size, setSize] = useState(10),
    [selected, select] = useState<CatalogItem>(),
    [quantity, setQuantity] = useState("1"),
    [notice, setNotice] = useState("");
  const search = useRef<HTMLInputElement>(null),
    amount = useRef<HTMLInputElement>(null);
  const categories = [
    ...new Set(items.filter((i) => i.active).map((i) => i.category)),
  ].sort();
  const matches = items
    .filter(
      (i) =>
        i.active &&
        (!category || i.category === category) &&
        [i.id, i.name].some((s) =>
          s.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(matches.length / size)),
    current = Math.min(page, pages - 1);
  function choose(item: CatalogItem) {
    select(item);
    setQuantity("1");
    setNotice("");
    requestAnimationFrame(() => {
      amount.current?.focus();
      amount.current?.select();
    });
  }
  function add() {
    const count = Number(quantity);
    if (!selected || !Number.isInteger(count) || count < 1 || count > 1e9)
      return;
    onAdd(selected, count);
    setNotice("Added " + count + " × " + selected.name);
    select(undefined);
    search.current?.focus();
  }
  return (
    <fieldset disabled={disabled}>
      <legend>Add rental items</legend>
      <div className="fields">
        <label>
          Category
          <select
            aria-label="Picker category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setQuery("");
              setPage(0);
              select(undefined);
              setNotice("");
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Find an item
          <input
            ref={search}
            type="search"
            placeholder="Item name or scanned ID"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
              select(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const item =
                  matches.find(
                    (i) => i.id.toLowerCase() === query.trim().toLowerCase(),
                  ) || (matches.length === 1 ? matches[0] : undefined);
                if (item) choose(item);
              }
            }}
          />
        </label>
      </div>
      <ul>
        {matches.slice(current * size, (current + 1) * size).map((i) => (
          <li key={i.id} className="picker-row">
            <div>
              <b>{i.name}</b>
              <small>{i.id}</small>
            </div>
            <div className="picker-stock">
              <span>
                {i.zone} / {i.subzone}
              </span>
              <small>
                {i.owned} owned · {i.unusable} unusable
              </small>
            </div>
            <button
              type="button"
              aria-label={"Choose " + i.name}
              onClick={() => choose(i)}
            >
              Choose
            </button>
          </li>
        ))}
      </ul>
      {!matches.length && <p>No matching items.</p>}
      <div className="pager">
        <span>{matches.length} results</span>
        <label>
          Items per page
          <select
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!current}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </button>
        <span>
          {current + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </button>
      </div>
      {selected && (
        <div>
          <label>
            Quantity for {selected.name}
            <input
              ref={amount}
              type="number"
              min="1"
              max="1000000000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </label>
          <button
            type="button"
            disabled={
              !Number.isInteger(Number(quantity)) ||
              Number(quantity) < 1 ||
              Number(quantity) > 1e9
            }
            onClick={add}
          >
            Add to lines
          </button>
        </div>
      )}
      <p role="status">{notice}</p>
    </fieldset>
  );
}
