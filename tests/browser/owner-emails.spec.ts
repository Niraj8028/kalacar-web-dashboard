import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test("order emails to the owner: addresses and which orders", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=orders");
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Order emails to you" }) });
  const emails = card.getByRole("textbox", { name: /^Send order emails to/ });
  await expect(emails).toHaveValue("");
  await expect(card.getByRole("checkbox", { name: /Email me every paid order/ })).toBeChecked();
  await expect(card.getByRole("checkbox", { name: /Email me orders that weren't paid/ })).toBeChecked();
  await emails.fill("owner@example.test, not-an-email");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("alert")).toContainText("isn't an email address");
  await emails.fill("Owner@Example.test, partner@example.test");
  await card.getByRole("checkbox", { name: /Email me orders that weren't paid/ }).uncheck();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toContainText("Saved");
  await expect(emails).toHaveValue("owner@example.test, partner@example.test");
  expect(state.saved).toContainEqual({ ownerEmails: { emails: "Owner@Example.test, partner@example.test", paid: true, unpaid: false } });
});

test("an unpaid order can be followed up on WhatsApp with the Not paid message", async ({ page }) => {
  await mockApi(page);
  await page.goto("/orders");
  const row = page.locator("tr", { hasText: "Waiting Buyer" });
  await expect(row.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=WhatsApp%20unpaid%20CCCCCCCC/);
  await expect(row.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919876543210");
});

test("Not paid has its own customer message template", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings?tab=orders");
  await expect(page.getByRole("button", { name: "Not paid" })).toBeVisible();
});
