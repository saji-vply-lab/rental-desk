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
    expect((await app.inject("/api/dashboard/operations")).statusCode).toBe(
      403,
    );
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

test("book against expected returns, block conflicting issues, and reconcile return batches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rentaldesk-rent-"));
  const app = await createApp(join(dir, "test.db"), true);
  const date = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const draft = async (start: number, due: number, quantity: number) => {
    const result = await app.inject({
      method: "POST",
      url: "/api/rental-drafts",
      payload: {
        requestId: crypto.randomUUID(),
        customerId: 1,
        start: date(start),
        due: date(due),
        lines: [
          {
            itemId: "ITEM-0002",
            quantity,
            startOverride: null,
            dueOverride: null,
          },
        ],
      },
    });
    expect(result.statusCode).toBe(200);
    return result.json().id as number;
  };
  const act = (
    id: number,
    action: string,
    revision: number,
    extra: object = {},
  ) =>
    app.inject({
      method: "POST",
      url: "/api/rental-drafts/" + id + "/actions",
      payload: { action, revision, ...extra },
    });
  try {
    const dashboard = async () =>
      (await app.inject("/api/dashboard/operations")).json();
    const baseline = (await dashboard()).available;
    const first = await draft(0, 1, 4);
    expect((await act(first, "Issue", 1)).json().status).toBe("Issued");
    const conflict = await draft(0, 1, 1);
    expect((await act(conflict, "Book", 1)).statusCode).toBe(409);
    const later = await draft(2, 3, 4);
    expect((await act(later, "Book", 1)).json().atRisk).toBe(true);
    expect(
      (await act(later, "Book", 1, { acceptRisk: true })).json().status,
    ).toBe("Booked");
    expect(
      (await app.inject("/api/rental-drafts/" + later)).json().atRisk,
    ).toBe(1);
    const snapshot = await dashboard();
    expect(snapshot.pending).toMatchObject([
      { rentalId: first, outstanding: 4, due: date(1) },
    ]);
    expect(snapshot.bookings).toMatchObject([{ rentalId: later, atRisk: 1 }]);
    expect(snapshot.available).toBe(baseline - 4);
    expect((await act(later, "Issue", 2)).statusCode).toBe(409);
    const ret = (n: number, revision: number) =>
      act(first, "Return", revision, {
        position: 0,
        quantity: n,
        condition: "Good",
      });
    expect((await ret(5, 2)).statusCode).toBe(409);
    expect((await ret(2, 2)).json().status).toBe("Partially returned");
    expect((await dashboard()).pending[0].outstanding).toBe(2);
    expect((await ret(2, 2)).statusCode).toBe(409);
    expect((await ret(2, 3)).json().status).toBe("Completed");
    const settled = await dashboard();
    expect(settled.pending).toHaveLength(0);
    expect(settled.available).toBe(baseline);
    expect(settled.bookings[0].atRisk).toBe(0);
    expect(settled.activity).toContainEqual(
      expect.objectContaining({ action: "Return", dayUnits: 4, monthUnits: 4 }),
    );
    expect((await act(later, "Issue", 2)).json().status).toBe("Issued");
    expect((await act(conflict, "Cancel", 1)).json().status).toBe("Cancelled");
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
