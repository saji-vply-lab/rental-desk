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

test("search stock by item name, ID and category", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search inventory" });
  for (const query of [" PUMP ", "item-0002", "motors"]) {
    await search.fill(query);
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("listitem")).toContainText("Water pump");
  }
  await search.fill("no such item");
  await expect(page.getByRole("status")).toContainText("0 of 3 items");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(3);
});

test("combine category and text filters", async ({ page }) => {
  await page.goto("/");
  const category = page.getByRole("combobox", { name: "Category" });
  await category.selectOption("Furniture");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem")).toContainText("Folding chair");
  await page.getByRole("searchbox").fill("pump");
  await expect(page.getByRole("status")).toContainText("0 of 3 items");
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
  await page.getByRole("button", { name: "Add item line" }).click();
  await page.getByLabel("Inventory item").selectOption("ITEM-0001");
  await page.getByLabel("Quantity").fill("100");
  await page.getByLabel("Override return date").check();
  await page.getByLabel("Item return date").fill("2027-02-07");
  await page.getByLabel("Common return date").fill("2027-02-04");
  await page.getByRole("button", { name: "Save inquiry" }).click();
  await expect(page.getByText("Quantity 100")).toBeVisible();
  await page.reload();
  await expect(page.getByText("01/02/2027 – 07/02/2027")).toBeVisible();
  expect(await (await request.get("/api/overview")).json()).toEqual(before);
});
