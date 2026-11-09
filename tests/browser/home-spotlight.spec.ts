import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

test("Product spotlight: pick a product, set the heading, save", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Product spotlight", exact: true }) });
  await expect(card.getByText(/Hidden on the site/)).toBeVisible();
  await card.getByRole("checkbox", { name: "Show on site" }).check();
  await card.getByRole("textbox", { name: "Heading", exact: true }).fill("Bring home the divine");
  await card.getByRole("textbox", { name: "Subheading", exact: true }).fill("Experience the joy of Krishna");
  const product = card.getByRole("combobox", { name: "Product" });
  const firstProduct = await product.locator("option").nth(1).getAttribute("value");
  await product.selectOption(firstProduct ?? "");
  await card.getByRole("checkbox", { name: "Show the shop logo" }).uncheck();
  await page.getByRole("button", { name: "Save home page" }).click();
  await expect(page.getByText("Saved. The home page is updated.")).toBeVisible();
  expect(state.saved[0]).toMatchObject({ home: { spotlight: { show: true, title: "Bring home the divine", description: "Experience the joy of Krishna", productId: firstProduct, showLogo: false, whatsapp: { show: true, label: "Order on WhatsApp" } } } });
  await expectFits(page);
  expect(errors).toEqual([]);
});
