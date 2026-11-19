import { test, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../apps/server/src/app";
test.each([true, false])("shop survives restart (demo=%s)", async (demo) => {
  const dir = await mkdtemp(join(tmpdir(), "rentaldesk-"));
  try {
    for (let run = 0; run < 2; run++) {
      const app = await createApp(join(dir, "shop.sqlite"), demo);
      try {
        expect((await app.inject("/api/health")).json()).toEqual({
          status: "ok",
        });
        const response = await app.inject("/api/overview");
        expect(response.statusCode).toBe(200);
        expect(response.json().shop).toBe(
          demo ? "Demo Rental Shop" : "Rental Shop",
        );
        expect(response.json().items).toHaveLength(demo ? 3 : 0);
      } finally {
        await app.close();
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
