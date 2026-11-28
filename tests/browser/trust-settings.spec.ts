import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

test("Trust and checkout: every line's words, icons and switches save together, without touching other settings", async ({ page }) => {
  const errors = watchErrors(page);
  const state = await mockApi(page);
  await page.goto("/settings?tab=trust");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Trust and checkout" }) });
  // Settings saved before this tab existed open with the shop's defaults.
  await expect(card.getByRole("textbox", { name: "Promise 1" })).toHaveValue("Free delivery");
  await expect(card.getByRole("textbox", { name: /^Promise/ })).toHaveCount(4);
  await expect(card.getByRole("button", { name: "+ Add promise" })).toBeDisabled();
  await card.getByRole("textbox", { name: "Promise 2" }).fill("Breakage replaced free");
  await card.getByRole("button", { name: "Remove" }).nth(3).click();
  const buy = card.locator("fieldset", { has: page.getByText("Buy now button", { exact: true }) });
  await buy.getByRole("textbox", { name: "Button text" }).fill("Order now");
  await buy.getByLabel("Icon before the text").selectOption("star");
  await buy.getByRole("checkbox", { name: /Show payment names/ }).uncheck();
  await card.getByLabel(/Orders after this time count from the next day/).selectOption("16");
  await card.getByRole("textbox", { name: /^Pay button text/ }).fill("Pay {total} now");
  await card.getByRole("checkbox", { name: /Show the tax note/ }).uncheck();
  const leave = card.locator("fieldset", { has: page.getByText("“Before you go” panel", { exact: true }) });
  await leave.getByRole("textbox", { name: "Box heading" }).fill("Kisi insaan se baat karein");
  await leave.getByRole("checkbox", { name: "Show a Call button" }).uncheck();
  await leave.locator(".trust-reason").first().getByRole("textbox", { name: "Answer" }).fill("COD chahiye");
  await leave.locator(".trust-reason").nth(3).getByRole("checkbox", { name: "Show" }).uncheck();
  await card.getByRole("button", { name: "Save trust and checkout" }).click();
  await expect(card.getByText("Saved. The shop is updated.")).toBeVisible();
  const saved = (state.saved.find(item => "productPage" in item) as { productPage: Record<string, unknown> }).productPage;
  expect(saved).toMatchObject({
    buyNow: { label: "Order now", icon: "star", showMarks: false }, deliveryDates: { cutoffHour: 16 }, payButton: { label: "Pay {total} now" },
    bagTrust: { taxNote: { show: false } }, leaveSurvey: { contact: { title: "Kisi insaan se baat karein", showCall: false } },
    // Other product page settings are kept as they were.
    stickyBar: { show: true }, whatsappHelp: { show: true, label: "Chat" },
  });
  const survey = saved.leaveSurvey as { reasons: { key: string; label: string; show: boolean }[] };
  expect(survey.reasons[0]).toEqual({ key: "cod", label: "COD chahiye", show: true });
  expect(survey.reasons[3]).toMatchObject({ key: "price", show: false });
  expect((saved.trustStrip as { items: { title: string }[] }).items.map(item => item.title)).toEqual(["Free delivery", "Breakage replaced free", "Photo before dispatch"]);
  expect(saved).not.toHaveProperty("freeGift");
  await expectFits(page);
  expect(errors).toEqual([]);
});

test("Product page settings don't save over Trust and checkout", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  await page.getByRole("checkbox", { name: /Show how many are in stock/ }).check();
  await page.locator("section", { has: page.getByRole("heading", { name: "Product page settings" }) }).getByRole("button", { name: /^Save/ }).click();
  await expect.poll(() => state.saved.find(item => "productPage" in item)).toBeTruthy();
  expect((state.saved.find(item => "productPage" in item) as { productPage: object }).productPage).not.toHaveProperty("trustStrip");
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
