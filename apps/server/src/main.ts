import { createApp } from "./app";
const app = await createApp(
  process.env.DATABASE_PATH || "data/development.sqlite",
  true,
);
await app.listen({ port: 3001, host: "127.0.0.1" });
