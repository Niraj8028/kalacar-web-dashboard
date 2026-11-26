import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

test("Settings > Footer and menus: change the text, hide WhatsApp, and reorder, add and remove links", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/settings?tab=footer");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Footer and menus" }) });
  await expect(card.getByText("Automatic links")).toBeVisible();
  // Starts from the pages that have "Show in the footer" ticked.
  await expect(card.getByLabel("Name", { exact: true })).toHaveCount(2);
  await expect(card.getByLabel("Name", { exact: true }).first()).toHaveValue("About Kalacar");
  await card.getByLabel("Text next to the logo").fill("Made with devotion in Pune");
  await card.getByLabel("Show the WhatsApp number").uncheck();
  await card.getByRole("button", { name: "Move Contact us up" }).click();
  await card.getByRole("button", { name: "+ Add link" }).click();
  await card.getByLabel("Name", { exact: true }).nth(2).fill("Instagram");
  await card.getByLabel("Link", { exact: true }).fill("https://instagram.com/kalacar");
  await card.getByRole("button", { name: "Save footer" }).click();
  await expect(card.getByText("Saved. The footer and menu are updated on every page.")).toBeVisible();
  expect(state.saved).toEqual([{ footer: { text: "Made with devotion in Pune", showWhatsapp: false, links: [{ label: "Contact us", link: "/contact" }, { label: "About Kalacar", link: "/about" }, { label: "Instagram", link: "https://instagram.com/kalacar" }], business: { name: "", address: "", email: "", phone: "" } } }]);
  await expect(card.getByText("3 links")).toBeVisible();
  await card.locator(".footer-link-row").nth(1).getByRole("button", { name: "Remove" }).click();
  await expect(card.getByLabel("Name", { exact: true })).toHaveCount(2);
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("business details for Google Merchant Center are saved with the footer", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/settings?tab=footer");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Footer and menus" }) });
  await card.getByLabel("Business name").fill(" Kalacar Studio ");
  await card.getByLabel("Business address").fill("12 MG Road, Kothrud, Pune 411038");
  await card.getByLabel("Business email").fill("hello@kalacar");
  await card.getByRole("button", { name: "Save footer" }).click();
  await expect(card.getByRole("alert")).toHaveText("The business email doesn't look right. Check it, or leave it empty.");
  expect(state.saved).toEqual([]);
  await card.getByLabel("Business email").fill("hello@kalacar.in");
  await card.getByLabel("Business phone").fill("+91 95615 79131");
  await card.getByRole("button", { name: "Save footer" }).click();
  await expect(card.getByText("Saved. The footer and menu are updated on every page.")).toBeVisible();
  expect(state.saved).toEqual([{ footer: expect.objectContaining({ business: { name: "Kalacar Studio", address: "12 MG Road, Kothrud, Pune 411038", email: "hello@kalacar.in", phone: "+91 95615 79131" } }) }]);
  await expect(card.getByLabel("Business name")).toHaveValue("Kalacar Studio");
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("a link without a proper address is pointed out after saving", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings?tab=footer");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Footer and menus" }) });
  await card.getByRole("button", { name: "+ Add link" }).click();
  await card.getByLabel("Name", { exact: true }).nth(2).fill("Broken");
  await card.getByLabel("Link", { exact: true }).fill("instagram.com");
  await card.getByRole("button", { name: "Save footer" }).click();
  await expect(card.getByText(/1 link was left out/)).toBeVisible();
});

test("the line above the product name can be changed or hidden", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  const card = page.locator('[aria-labelledby="product-page-page-title"]');
  const group = card.locator("fieldset", { hasText: "Line above the product name" });
  await expect(group.getByLabel("Text")).toHaveValue("{category} · SMALL DEVOTIONAL MURTI");
  await group.getByLabel("Text").fill("{category} · HANDPICKED FOR YOU");
  await card.getByRole("button", { name: "Save product page settings" }).click();
  await expect(card.getByText(/Saved. Every product page/)).toBeVisible();
  expect(state.saved[0]).toMatchObject({ productPage: { eyebrow: { show: true, text: "{category} · HANDPICKED FOR YOU" } } });
});

test("each reason in Why choose us can have an icon", async ({ page }) => {
  await mockApi(page);
  await page.goto("/pages");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Why choose us", exact: true }) });
  await card.getByRole("checkbox", { name: "Show on site" }).check();
  await card.getByRole("button", { name: "+ Add reason" }).click();
  await expect(card.getByText("Icon (optional)")).toBeVisible();
  await expect(card.getByText(/two per row/)).toBeVisible();
});
