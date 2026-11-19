import { rentalRoutes } from "./rentals";
import { inquiryRoutes } from "./inquiries";
import Fastify from "fastify";
import { openShop } from "./db";
import { overviewSchema } from "@rentaldesk/shared";
import { customerRoutes } from "./customers";
import { inventoryRoutes } from "./inventory";
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
  rentalRoutes(app, shop.client, demo);
  inquiryRoutes(app, shop.client, demo);
  customerRoutes(app, shop.client, demo);
  inventoryRoutes(app, shop.client, demo);
  return app;
}
