import Fastify from "fastify";
import { openShop } from "./db";
import { overviewSchema } from "@rentaldesk/shared";
export async function createApp(path: string, demo: boolean) {
  const shop = await openShop(path, demo);
  const app = Fastify();
  app.addHook("onClose", async () => shop.close());
  app.get("/api/health", async () => {
    await shop.health();
    return { status: "ok" };
  });
  app.get("/api/overview", async () =>
    overviewSchema.parse(await shop.overview()),
  );
  return app;
}
