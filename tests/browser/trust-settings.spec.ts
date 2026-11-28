import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

test("product page settings: trust strip, delivery dates, free gift, WhatsApp button, survey and photo promise", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Product page settings" }) });
  // Settings saved before this change still open with the shop's defaults.
  await expect(card.getByRole("textbox", { name: "Promise 1" })).toHaveValue("Free delivery");
  await expect(card.getByRole("textbox", { name: /^Promise/ })).toHaveCount(4);
  await expect(card.getByRole("button", { name: "+ Add promise" })).toBeDisabled();
  await card.getByRole("textbox", { name: "Promise 2" }).fill("Breakage replaced free");
  await card.getByRole("button", { name: "Remove" }).nth(3).click();
  await card.getByLabel(/Orders after this time count from the next day/).selectOption("16");
  await card.getByRole("checkbox", { name: /Show a free gift/ }).check();
  await expect(card.getByText("Add the gift's name, or it won't show.")).toBeVisible();
  await card.getByRole("textbox", { name: /^Gift name/ }).fill("Blessing card");
  await card.getByRole("checkbox", { name: /Ask why, when someone leaves checkout/ }).uncheck();
  await card.getByRole("button", { name: /^Save/ }).click();
  await expect.poll(() => state.saved.find(item => "productPage" in item)).toBeTruthy();
  const saved = (state.saved.find(item => "productPage" in item) as { productPage: Record<string, unknown> }).productPage;
  expect(saved).toMatchObject({
    deliveryDates: { show: true, cutoffHour: 16 }, freeGift: { show: true, name: "Blessing card" }, leaveSurvey: { show: false },
    whatsappFloat: { show: true, label: "Questions? Chat with us" }, preDispatch: { show: true },
  });
  expect((saved.trustStrip as { items: { title: string }[] }).items.map(item => item.title)).toEqual(["Free delivery", "Breakage replaced free", "Photo before dispatch"]);
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("Checkouts: why people left, and a WhatsApp message for those who didn't pay", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/checkouts");
  await expect(page.getByRole("heading", { level: 1, name: "Checkouts" })).toBeVisible();
  const reasons = page.locator(".reason-bars li");
  await expect(reasons.first()).toContainText("I want Cash on Delivery");
  await expect(reasons.first().locator("b")).toHaveText("2");
  await expect(page.getByText("“Want to see a video first”")).toBeVisible();
  // Starts on the ones to follow up: left before paying.
  const rows = page.locator(".checkout-lead");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Asha Patil");
  await expect(rows.first()).toContainText("Cute Krishna (Blue) × 1 · ₹699");
  const whatsapp = rows.first().getByRole("link", { name: "WhatsApp" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=Hi%20Asha%20Patil%2C%20your%20bag%20is%20waiting/);
  await rows.first().getByLabel("Contacted").check();
  await expect.poll(() => state.saved).toContainEqual({ lead: "11111111-1111-4111-8111-111111111111", contacted: true });
  // A shopper who paid later has no follow-up message, and links to the order.
  await page.getByRole("button", { name: /^Paid later/ }).click();
  await expect(rows.first()).toContainText("Ravi Shah");
  await expect(rows.first().getByRole("link", { name: "WhatsApp" })).toHaveCount(0);
  await rows.first().getByRole("button", { name: "Open the order" }).click();
  await expect(page).toHaveURL(/\/orders\/33333333-3333-4333-8333-333333333333$/);
  expect(errors).toEqual([]);
});

test("message templates include one for checkouts left before paying", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings?tab=orders");
  await expect(page.getByRole("button", { name: "Left checkout" })).toBeVisible();
});
