import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("Settings > Website title and icon: change the title, description and favicon", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/settings");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Website title and icon" }) });
  await expect(card.getByLabel("Website title")).toHaveValue("Kalacar — Small Devotional Murtis");
  await card.getByLabel("Website title").fill("Kalacar — Murtis for your car");
  await card.getByLabel("Description").fill("Small brass murtis for the car dashboard.");
  await card.getByLabel("Favicon (tab icon)").setInputFiles({ name: "icon.png", mimeType: "image/png", buffer: PNG });
  await expect(card.getByLabel("Browser tab preview")).toContainText("Kalacar — Murtis for your car");
  await expect(card.getByLabel("Google result preview")).toContainText("Small brass murtis for the car dashboard.");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText(/^Saved\./)).toBeVisible();
  expect(state.saved).toContainEqual({ seo: { title: "Kalacar — Murtis for your car", description: "Small brass murtis for the car dashboard.", favicon: expect.stringMatching(/^\/uploads\//), showOnGoogle: true } });
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("Settings > Website title and icon: the shop can be hidden from Google and shown again", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Website title and icon" }) });
  const google = card.getByLabel(/Show the shop on Google/);
  await expect(google).toBeChecked();
  await google.uncheck();
  await expect(card.getByText(/Hidden: Google is asked not to list any page/)).toBeVisible();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText(/^Saved\./)).toBeVisible();
  expect(state.saved).toContainEqual({ seo: expect.objectContaining({ showOnGoogle: false }) });
});

test("product permalink follows the name unless one is typed", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/products");
  await page.getByRole("button", { name: "Edit details" }).first().click();
  const field = page.getByLabel(/^Permalink/);
  await expect(page.getByText(/address follows the product name: \/products\/test-(ganesh|krushna)\./)).toBeVisible();
  await page.getByLabel("Product name", { exact: true }).fill("Shree Krushna Gold");
  await expect(page.getByText(/address follows the product name: \/products\/shree-krushna-gold/)).toBeVisible();
  await field.fill("Krishna Murti!");
  await expect(page.getByText(/Address: \/products\/krishna-murti\./)).toBeVisible();
  await page.getByRole("button", { name: /Save/ }).last().click();
  await expect.poll(() => state.saved.find(item => "productForm" in item)).toBeTruthy();
  expect((state.saved.find(item => "productForm" in item) as { productForm: string }).productForm).toMatch(/name="permalink"\r\n\r\nKrishna Murti!/);
});
