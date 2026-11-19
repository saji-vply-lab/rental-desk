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
