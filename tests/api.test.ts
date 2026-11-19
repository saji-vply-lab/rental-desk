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
        expect(response.json().items).toHaveLength(demo ? 12 : 0);
        if (demo) {
          expect((await app.inject("/api/customers")).json()).toHaveLength(3);
          const inquiries = (await app.inject("/api/inquiries")).json();
          expect(inquiries).toHaveLength(3);
          for (const inquiry of inquiries) {
            expect(
              (await app.inject("/api/inquiries/" + inquiry.id)).json().lines,
            ).toHaveLength(2);
          }
        }
      } finally {
        await app.close();
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("stock adjustments reject stale revisions and invalid quantities without recording a movement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rentaldesk-stock-"));
  const app = await createApp(join(dir, "test.db"), true);
  try {
    const change = (quantity: number, revision: number) =>
      app.inject({
        method: "POST",
        url: "/api/inventory/adjustments",
        payload: {
          id: "ITEM-0001",
          kind: "Repair",
          quantity,
          revision,
          reason: "Checked at counter",
        },
      });
    expect((await change(3, 1)).statusCode).toBe(400);
    expect((await change(1, 1)).statusCode).toBe(200);
    expect((await change(1, 1)).statusCode).toBe(409);
    const history = (
      await app.inject("/api/inventory/ITEM-0001/history")
    ).json();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      kind: "Repair",
      owned: 24,
      unusable: 1,
      actor: "Demo owner",
    });
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("production denies unauthenticated inventory changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rentaldesk-auth-"));
  const app = await createApp(join(dir, "test.db"), false);
  try {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/inventory/categories",
          payload: { name: "Extra", active: 1 },
        })
      ).statusCode,
    ).toBe(403);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
