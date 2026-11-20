import { expect, test } from "@playwright/test";
test("phone dashboard shows seeded stock", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Folding chair")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("page dashboard stock and filter the full catalog", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("listitem");
  const totals = page.getByRole("region", { name: "Inventory totals" });
  await expect(list).toHaveCount(10);
  const summary = await totals.innerText();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(list).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.getByRole("searchbox").fill("Folding chair");
  await expect(list).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  await page.getByLabel("Per page").selectOption("25");
  await expect(list).toHaveCount(12);
  expect(await totals.innerText()).toBe(summary);
});

test("search stock by item name, ID and category", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search inventory" });
  for (const query of [" PUMP ", "item-0002", "motors"]) {
    await search.fill(query);
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("listitem")).toContainText("Water pump");
  }
  await search.fill("no such item");
  await expect(page.getByRole("status")).toContainText("0 of 12 items");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(10);
});

test("combine category and text filters", async ({ page }) => {
  await page.goto("/");
  const category = page.getByRole("combobox", { name: "Category" });
  await category.selectOption("Furniture");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Folding chair" })).toBeVisible();
  await page.getByRole("searchbox").fill("pump");
  await expect(page.getByRole("status")).toContainText("0 of 12 items");
  await category.selectOption("");
  await expect(page.getByRole("listitem")).toContainText("Water pump");
});

test("navigate through inventory management and record a repair", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Manage inventory" }).click();
  await page.getByRole("link", { name: "Manage categories" }).click();
  await page.getByRole("link", { name: "Add category" }).click();
  await page.getByLabel("Category name").fill("Workshop demo");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(page.getByRole("link", { name: "Workshop demo" })).toBeVisible();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await page.getByRole("link", { name: "Add item" }).click();
  await page.getByLabel("Item name").fill("Test drill");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("Workshop demo");
  await page.getByLabel("Zone (room)").fill("Workshop");
  await page.getByLabel("Subzone (rack)").fill("R1");
  await page.getByLabel("Opening quantity").fill("3");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("heading", { name: "Test drill" })).toBeVisible();
  await page.getByRole("link", { name: "Edit item" }).click();
  await page.getByLabel("Rental rate").fill("99.50");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByText("₹99.50 per day")).toBeVisible();
  for (const kind of ["Damage", "Repair"]) {
    await page.getByRole("link", { name: "Adjust stock" }).click();
    await page.getByLabel("Movement").selectOption(kind);
    await page.getByLabel("Quantity", { exact: true }).fill("1");
    await page.getByLabel("Reason").fill(kind + " inspection");
    await page.getByRole("button", { name: "Record adjustment" }).click();
    await expect(
      page.getByText(kind + " inspection", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Test drill" }).click();
  }
});

test("create, find and edit a customer and check duplicate phone numbers", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Customers" }).click();
  const add = async (name: string, phone: string) => {
    await page.getByRole("link", { name: "Add customer" }).click();
    await page.getByLabel("Customer name").fill(name);
    await page.getByLabel("Address").fill("Demo street");
    await page.getByLabel("Phone 1").fill(phone);
    await page.getByRole("button", { name: "Save customer" }).click();
  };
  await add("Demo customer", "9876543210");
  await page.getByRole("link", { name: "Edit customer" }).click();
  await page.getByRole("button", { name: "Add phone number" }).click();
  await page.getByLabel("Phone 2").fill("9995550001");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("9995550001")).toBeVisible();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("searchbox").fill("5550001");
  await expect(page.getByRole("link", { name: "Demo customer" })).toBeVisible();
  await add("Another demo", "+91 98765 43210");
  await expect(page.getByRole("alert")).toContainText("existing customer");
  await page.getByRole("link", { name: "Demo customer" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo customer" }),
  ).toBeVisible();
});

test("save an unreserved inquiry with an independent line return date", async ({
  page,
  request,
}) => {
  const seed = await request.post("/api/customers", {
    data: {
      name: "Inquiry sample",
      address: "Demo road",
      phones: ["5557778888"],
    },
  });
  const customer = await seed.json();
  const before = await (await request.get("/api/overview")).json();
  await page.goto("/");
  await page.getByRole("link", { name: "Rental inquiries" }).click();
  await page.getByRole("link", { name: "New inquiry" }).click();
  await page
    .locator('select[name="customer"]')
    .selectOption(String(customer.id));
  await page.getByLabel("Common start date").fill("2027-02-01");
  await page.getByLabel("Common return date").fill("2027-02-03");
  await page.getByRole("button", { name: "Choose Folding chair" }).click();
  await page.getByRole("button", { name: "Add to lines" }).click();
  await page.getByLabel("Quantity").fill("100");
  await page.locator(".line-dates summary").click();
  await page.getByLabel("Override return date").check();
  await page.getByLabel("Item return date").fill("2027-02-07");
  await page.getByLabel("Common return date").fill("2027-02-04");
  await page.getByRole("button", { name: "Save inquiry" }).click();
  await expect(page.getByText("Quantity 100")).toBeVisible();
  await page.reload();
  await expect(page.getByText("01/02/2027 – 07/02/2027")).toBeVisible();
  expect(await (await request.get("/api/overview")).json()).toEqual(before);
});

for (const [section, noun] of [
  ["Rental inquiries", "inquiry"],
  ["Rentals", "rental draft"],
]) {
  test(
    "browse and edit " + noun + " items across categories and pages",
    async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: section, exact: true }).click();
      await page.getByRole("link", { name: "New " + noun }).click();
      await page.locator('select[name="customer"]').selectOption({ index: 1 });
      await page.getByLabel("Common start date").fill("2027-03-01");
      await page.getByLabel("Common return date").fill("2027-03-05");
      await page.getByLabel("Items per page").selectOption("5");
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Previous", exact: true }),
      ).toBeEnabled();
      const filter = page.getByRole("combobox", { name: "Picker category" });
      await filter.selectOption("Furniture");
      await expect(
        page.getByRole("button", { name: "Previous", exact: true }),
      ).toBeDisabled();
      for (const name of ["Banquet table", "Folding chair"]) {
        await page.getByRole("button", { name: "Choose " + name }).click();
        await page.getByRole("button", { name: "Add to lines" }).click();
        await expect(filter).toHaveValue("Furniture");
      }
      await filter.selectOption("Tools & Machinery");
      await page.getByLabel("Find an item").fill("drill");
      await page.getByRole("button", { name: "Choose Rotary drill" }).click();
      await page.getByRole("button", { name: "Add to lines" }).click();
      await page.getByRole("button", { name: "Save " + noun }).click();
      await page.getByRole("link", { name: "Edit " + noun }).click();
      await expect(page.getByLabel("Quantity", { exact: true })).toHaveCount(3);
      await page.getByLabel("Quantity", { exact: true }).first().fill("7");
      await page.getByRole("button", { name: "Save " + noun }).click();
      await expect(page.getByText("Quantity 7")).toBeVisible();
    },
  );
}
test("convert an inquiry, book, issue and return each line", async ({
  page,
}) => {
  await page.goto("/#/inquiries/1");
  await page.getByRole("button", { name: "Open as rental draft" }).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/Demo Riverside Hall · Booked/)).toBeVisible();
  await page.getByRole("button", { name: "Issue rental" }).click();
  await page.getByLabel("Return quantity").fill("4");
  await page.getByRole("button", { name: "Save return" }).click();
  await expect(
    page.getByText(/Demo Riverside Hall · Partially returned/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save return" }).click();
  await expect(page.getByText(/Demo Riverside Hall · Completed/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Quantity 4")).toContainText("0 outstanding");
});

test("dashboard filters pending lines and links critical returns to rentals", async ({
  page,
}) => {
  const line = {
    rentalId: 10,
    itemId: "ITEM-0001",
    name: "Folding chair",
    customer: "Demo Hall",
    outstanding: 2,
  };
  await page.route("**/api/dashboard/operations", (route) =>
    route.fulfill({
      json: {
        today: "2026-11-19",
        available: 7,
        pending: [
          { ...line, position: 0, due: "2026-11-18" },
          { ...line, position: 1, due: "2026-11-19", outstanding: 1 },
        ],
        bookings: [
          {
            rentalId: 11,
            position: 0,
            itemId: line.itemId,
            name: line.name,
            customer: "Demo Club",
            start: "2026-11-21",
            due: "2026-11-22",
            quantity: 3,
            atRisk: 1,
          },
        ],
        activity: [],
      },
    }),
  );
  await page.goto("/");
  const returns = page.getByRole("region", { name: "Outstanding returns" });
  await returns.getByRole("combobox", { name: "Show" }).selectOption("Overdue");
  await expect(returns.getByRole("listitem")).toHaveCount(1);
  await expect(returns.getByRole("listitem")).toContainText("2 outstanding");
  await returns
    .getByRole("combobox", { name: "Show" })
    .selectOption("Due today");
  await expect(returns.getByRole("listitem")).toContainText("1 outstanding");
  const critical = page.getByRole("region", { name: "Critical returns" });
  await critical.locator("summary").click();
  await expect(
    critical.getByRole("link", { name: "RNT-10 · Demo Hall" }).first(),
  ).toHaveAttribute("href", "#/rental-drafts/10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("record a booking advance and see its receipt in billing history", async ({
  page,
  request,
}) => {
  const rental = (await (await request.post("/api/inquiries/2/rental")).json())
    .id;
  await page.goto("/#/rental-drafts/" + rental);
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await page
    .getByText("Payments and billing adjustments", { exact: true })
    .click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("125.50");
  await page.getByLabel("Payment reference").fill("DEMO-ADVANCE");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Cash DEMO-ADVANCE/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Cash DEMO-ADVANCE/)).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        document.documentElement.dataset.sharedPdf = file
          ? file.name + " " + (await file.slice(0, 5).text())
          : "";
      },
    });
  });
  await page.route("**/receipts/payment-*?format=preview", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        phones: [
          ...data.phones,
          "09876543210",
          "98765 43210",
          "0091 98765 43210",
        ],
      },
    });
  });
  await page.getByRole("button", { name: /Payment receipt #/ }).click();
  const dialog = page.getByRole("dialog", { name: "Payment receipt" });
  await expect(dialog).toContainText("₹125.50");
  await expect(
    dialog.getByRole("link", { name: "Share summary via WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/12025550102\?text=/);
  const recipient = dialog.getByLabel("Customer phone");
  const shareLink = dialog.getByRole("link", {
    name: "Share summary via WhatsApp",
  });
  for (const phone of ["09876543210", "98765 43210", "0091 98765 43210"]) {
    await recipient.selectOption(phone);
    await expect(shareLink).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/919876543210\?text=/,
    );
  }
  await recipient.selectOption("");
  await expect(shareLink).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await dialog.getByRole("button", { name: "Share PDF" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shared-pdf",
    /^PAY-\d+\.pdf %PDF-/,
  );
  const download = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^PAY-\d+\.pdf$/);
  await dialog.getByRole("button", { name: "Close receipt" }).click();
  await expect(dialog).toHaveCount(0);
});
