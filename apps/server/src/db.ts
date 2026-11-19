import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});
const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  zone: text("zone").notNull(),
  subzone: text("subzone").notNull(),
  owned: integer("owned").notNull(),
  unusable: integer("unusable").notNull(),
});
export async function openShop(path: string, demo: boolean) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const client = createClient({ url: pathToFileURL(resolve(path)).href });
  try {
    await client.execute(
      "CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)",
    );
    const tx = await client.transaction("write");
    try {
      if (
        !(await tx.execute("SELECT version FROM migrations WHERE version=1"))
          .rows.length
      ) {
        await tx.executeMultiple(
          readFileSync(
            new URL(
              "../../../database/migrations/0001-foundation.sql",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        await tx.execute({
          sql: "INSERT INTO tenants(id,name) VALUES(1,?)",
          args: [demo ? "Demo Rental Shop" : "Rental Shop"],
        });
        if (demo)
          await tx.execute(
            "INSERT INTO items VALUES ('ITEM-0001','Folding chair','Furniture','Store A','Rack 1',24,2),('ITEM-0002','Water pump','Pumps & Motors','Store B','Rack 3',4,0),('ITEM-0003','Floor scrubber','Cleaning Equipment','Store A','Rack 2',3,1)",
          );
        await tx.execute("INSERT INTO migrations VALUES (1)");
      }
      if (
        !(await tx.execute("SELECT version FROM migrations WHERE version=2"))
          .rows.length
      ) {
        await tx.executeMultiple(
          readFileSync(
            new URL(
              "../../../database/migrations/0002-inventory.sql",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        await tx.execute("INSERT INTO migrations VALUES (2)");
      }
      if (
        !(await tx.execute("SELECT version FROM migrations WHERE version=3"))
          .rows.length
      ) {
        await tx.executeMultiple(
          readFileSync(
            new URL(
              "../../../database/migrations/0003-customers.sql",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        await tx.execute("INSERT INTO migrations VALUES (3)");
      }
      await tx.commit();
    } finally {
      tx.close();
    }
    const db = drizzle(client);
    return {
      client,
      close: () => client.close(),
      health: () => client.execute("SELECT 1"),
      async overview() {
        const [shop] = await db.select().from(tenants);
        return {
          shop: shop.name,
          items: await db.select().from(items).orderBy(items.name),
        };
      },
    };
  } catch (error) {
    client.close();
    throw error;
  }
}
