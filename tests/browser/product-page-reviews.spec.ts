import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

const review = (over: object) => ({ id: 1, productId: "krushna", author: "Real Buyer", city: "Pune", rating: 5, text: "Lovely", photos: [], videoUrl: "", showOnHome: false, showOnProduct: true, published: true, ...over });

test("product page settings: hide the stock count, show Google reviews", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  const stock = page.getByRole("checkbox", { name: /Show how many are in stock/ });
  const google = page.getByRole("checkbox", { name: /Google reviews section/ });
  await expect(stock).not.toBeChecked();
  await expect(google).toBeChecked();
  await stock.check();
  await google.uncheck();
  await page.locator("section", { has: page.getByRole("heading", { name: "Product page settings" }) }).getByRole("button", { name: /^Save/ }).click();
  await expect.poll(() => state.saved.find(item => "productPage" in item)).toBeTruthy();
  expect((state.saved.find(item => "productPage" in item) as { productPage: { stockCount: object; googleReviews: object } }).productPage).toMatchObject({ stockCount: { show: true }, googleReviews: { show: false } });
});

test("product page settings: delivery time and free delivery", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  const time = page.getByRole("textbox", { name: /^Delivery time/ });
  await expect(time).toHaveValue("3–7 business days");
  await expect(page.getByRole("checkbox", { name: /Show “Free delivery”/ })).toBeChecked();
  await time.fill("4–6 business days");
  await page.getByRole("checkbox", { name: /Show “Free delivery”/ }).uncheck();
  await page.locator("section", { has: page.getByRole("heading", { name: "Product page settings" }) }).getByRole("button", { name: /^Save/ }).click();
  await expect.poll(() => state.saved.find(item => "productPage" in item)).toBeTruthy();
  expect((state.saved.find(item => "productPage" in item) as { productPage: object }).productPage).toMatchObject({ delivery: { estimate: "4–6 business days", free: { show: false, text: "Free delivery across India" } } });
});

test("each product review can be left out of the product page list", async ({ page }) => {
  const state = await mockApi(page, { reviews: [review({}), review({ id: 2, productId: null, author: "Shop Fan" })] });
  await page.goto("/reviews");
  const row = page.locator("article", { hasText: "Real Buyer" });
  await expect(row.getByRole("checkbox", { name: "Product page" })).toBeChecked();
  await expect(page.locator("article", { hasText: "Shop Fan" }).getByRole("checkbox", { name: "Product page" })).toHaveCount(0);
  await row.getByRole("checkbox", { name: "Product page" }).uncheck();
  await expect.poll(() => state.saved).toContainEqual({ review: expect.objectContaining({ id: 1, showOnProduct: false }) });
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("checkbox", { name: /Show in the reviews list on the product page/ })).not.toBeChecked();
});

test("Why choose us: suggested text fills the reasons", async ({ page }) => {
  await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Why choose us", exact: true }) });
  await card.getByRole("checkbox", { name: "Show on site" }).check();
  await card.getByRole("button", { name: "Use suggested text" }).click();
  for (const title of ["Made for small spaces", "Crafted with care", "Checked before it ships", "Packed for a safe journey"]) await expect(card.locator(`input[value="${title}"]`)).toHaveCount(1);
  await expect(card.locator(".editor-row")).toHaveCount(4);
});
