import { createApp } from "./app";
import staticFiles from "@fastify/static";
import { resolve } from "node:path";
const app = await createApp(
  process.env.DATABASE_PATH || "data/shop.sqlite",
  false,
);
await app.register(staticFiles, { root: resolve("apps/web/dist") });
await app.listen({ port: 3001, host: "127.0.0.1" });
