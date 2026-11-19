import type { FastifyInstance } from "fastify";
import type { Client, Transaction } from "@libsql/client";
import { itemWrite, categoryWrite, adjustment } from "@rentaldesk/shared";
function reject(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
export function inventoryRoutes(
  app: FastifyInstance,
  client: Client,
  demo: boolean,
) {
  const demoAccess =
    demo &&
    !process.env.RENTALDESK_OWNER_KEY &&
    !process.env.RENTALDESK_INVENTORY_STAFF_KEY;
  app.get("/api/inventory", async () => ({
    items: (
      await client.execute(
        "SELECT * FROM items ORDER BY category COLLATE NOCASE,name COLLATE NOCASE,id",
      )
    ).rows,
    categories: (
      await client.execute(
        "SELECT * FROM categories ORDER BY name COLLATE NOCASE",
      )
    ).rows,
    demoAccess,
  }));
  app.get<{ Params: { id: string } }>(
    "/api/inventory/:id/history",
    async (req) =>
      (
        await client.execute({
          sql: "SELECT * FROM movements WHERE item=? ORDER BY id DESC",
          args: [req.params.id],
        })
      ).rows,
  );
  async function write(
    key: string | undefined,
    operation: (tx: Transaction, actor: string) => Promise<unknown>,
  ) {
    let actor = "Demo owner";
    if (!demoAccess) {
      if (
        process.env.RENTALDESK_OWNER_KEY &&
        key === "Bearer " + process.env.RENTALDESK_OWNER_KEY
      )
        actor = "Owner";
      else if (
        process.env.RENTALDESK_INVENTORY_STAFF_KEY &&
        key === "Bearer " + process.env.RENTALDESK_INVENTORY_STAFF_KEY
      )
        actor = "Authorized inventory staff";
      else reject("An authorized inventory key is required.", 403);
    }
    const tx = await client.transaction("write");
    try {
      const result = await operation(tx, actor);
      await tx.commit();
      return result;
    } finally {
      tx.close();
    }
  }
  app.post("/api/inventory/categories", async (req) =>
    write(req.headers.authorization, async (tx) => {
      const parsed = categoryWrite.safeParse(req.body);
      if (!parsed.success) reject("Enter a category name.");
      const { name, original, active } = parsed.data;
      const exists = (
        await tx.execute({
          sql: "SELECT name FROM categories WHERE name=?",
          args: [name],
        })
      ).rows[0];
      if (exists && exists.name !== original)
        reject("Category already exists.", 409);
      if (original) {
        const result = await tx.execute({
          sql: "UPDATE categories SET name=?,active=? WHERE name=?",
          args: [name, active, original],
        });
        if (!result.rowsAffected)
          reject("Category was renamed. Reload the list.", 409);
        if (original !== name)
          await tx.execute({
            sql: "UPDATE items SET category=?,revision=revision+1 WHERE category=?",
            args: [name, original],
          });
      } else
        await tx.execute({
          sql: "INSERT INTO categories(name,active) VALUES(?,?)",
          args: [name, active],
        });
      return { name };
    }),
  );
  app.post("/api/inventory/items", async (req) =>
    write(req.headers.authorization, async (tx, actor) => {
      const parsed = itemWrite.safeParse(req.body);
      if (!parsed.success)
        reject("Check the item fields, quantities and prices.");
      const { id, revision, opening, ...fields } = parsed.data;
      const category = (
        await tx.execute({
          sql: "SELECT * FROM categories WHERE name=?",
          args: [fields.category],
        })
      ).rows[0];
      const old = id
        ? (
            await tx.execute({
              sql: "SELECT * FROM items WHERE id=?",
              args: [id],
            })
          ).rows[0]
        : undefined;
      if (!category || (!category.active && old?.category !== category.name))
        reject("Choose an active category.");
      fields.category = String(category.name);
      if (fields.model === "Daily") fields.period = 1;
      const columns = Object.keys(fields),
        values = Object.values(fields);
      if (id) {
        const result = await tx.execute({
          sql:
            "UPDATE items SET " +
            columns.map((k) => k + "=?").join(",") +
            ",revision=revision+1 WHERE id=? AND revision=?",
          args: [...values, id, revision],
        });
        if (!result.rowsAffected)
          reject("Item changed. Reload before saving.", 409);
        return { id };
      }
      const next = (
        await tx.execute(
          "SELECT COALESCE(MAX(CAST(substr(id,6) AS INTEGER)),0)+1 AS n FROM items",
        )
      ).rows[0].n;
      const newId = "ITEM-" + String(next).padStart(4, "0");
      await tx.execute({
        sql:
          "INSERT INTO items(id,owned,unusable," +
          columns.join(",") +
          ") VALUES(?,?,0," +
          columns.map(() => "?").join(",") +
          ")",
        args: [newId, opening, ...values],
      });
      await tx.execute({
        sql: "INSERT INTO movements(item,kind,quantity,owned,unusable,reason,actor) VALUES(?,'Opening balance',?,?,0,'Item created',?)",
        args: [newId, opening, opening, actor],
      });
      return { id: newId };
    }),
  );
  app.post("/api/inventory/adjustments", async (req) =>
    write(req.headers.authorization, async (tx, actor) => {
      const parsed = adjustment.safeParse(req.body);
      if (!parsed.success)
        reject("Enter a positive whole quantity and a reason.");
      const { id, revision, kind, quantity, reason } = parsed.data;
      const item = (
        await tx.execute({
          sql: "SELECT owned,unusable,revision FROM items WHERE id=?",
          args: [id],
        })
      ).rows[0];
      if (!item || item.revision !== revision)
        reject("Item changed. Reload before adjusting.", 409);
      const deltas = {
        Purchase: [1, 0],
        "Correction increase": [1, 0],
        "Correction decrease": [-1, 0],
        Damage: [0, 1],
        Repair: [0, -1],
        "Retire usable": [-1, 0],
        "Retire unusable": [-1, -1],
      };
      const [dOwned, dUnusable] = deltas[kind];
      const owned = Number(item.owned) + quantity * dOwned,
        unusable = Number(item.unusable) + quantity * dUnusable;
      if (unusable < 0 || owned < unusable)
        reject("Quantity exceeds the stock in this condition.");
      await tx.execute({
        sql: "UPDATE items SET owned=?,unusable=?,revision=revision+1 WHERE id=?",
        args: [owned, unusable, id],
      });
      await tx.execute({
        sql: "INSERT INTO movements(item,kind,quantity,owned,unusable,reason,actor) VALUES(?,?,?,?,?,?,?)",
        args: [id, kind, quantity, owned, unusable, reason, actor],
      });
      return { id };
    }),
  );
}
