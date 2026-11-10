import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

test("Product spotlight: pick a product and save; it has no heading fields", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Product spotlight", exact: true }) });
  await expect(card.getByText(/Hidden on the site/)).toBeVisible();
  await card.getByRole("checkbox", { name: "Show on site" }).check();
  await expect(card.getByRole("textbox", { name: "Heading", exact: true })).toHaveCount(0);
  await expect(card.getByRole("textbox", { name: "Subheading", exact: true })).toHaveCount(0);
  const product = card.getByRole("combobox", { name: "Product" });
  const firstProduct = await product.locator("option").nth(1).getAttribute("value");
  await product.selectOption(firstProduct ?? "");
  await card.getByRole("checkbox", { name: "Show the shop logo" }).uncheck();
  await page.getByRole("button", { name: "Save home page" }).click();
  await expect(page.getByText("Saved. The home page is updated.")).toBeVisible();
  expect(state.saved[0]).toMatchObject({ home: { spotlight: { show: true, productId: firstProduct, showLogo: false, whatsapp: { show: true, label: "Order on WhatsApp" } } } });
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("Featured murtis: choose murtis, category buttons off by default, save", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Featured murtis", exact: true }) });
  await expect(card.getByRole("checkbox", { name: "Show on site" })).toBeChecked();
  const showFilters = card.getByRole("checkbox", { name: /Show the category buttons/ });
  await expect(showFilters).not.toBeChecked();
  const picker = card.getByRole("group", { name: /Murtis to show/ });
  const first = picker.getByRole("checkbox").first();
  await first.check();
  await showFilters.check();
  await page.getByRole("button", { name: "Save home page" }).click();
  await expect(page.getByText("Saved. The home page is updated.")).toBeVisible();
  const saved = state.saved[0] as { home: { catalogue: { productIds: string[]; showFilters: boolean } } };
  expect(saved.home.catalogue.showFilters).toBe(true);
  expect(saved.home.catalogue.productIds).toHaveLength(1);
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("Why choose us: logo on the left can use the shop logo or an uploaded one", async ({ page }) => {
  await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Why choose us", exact: true }) });
  await card.getByRole("checkbox", { name: "Show on site" }).check();
  const showLogo = card.getByRole("checkbox", { name: "Show a logo on the left" });
  await expect(showLogo).toBeChecked();
  await expect(card.getByText("Logo or icon (empty uses the shop logo)")).toBeVisible();
  await showLogo.uncheck();
  await expect(card.getByText("Logo or icon (empty uses the shop logo)")).toHaveCount(0);
});
