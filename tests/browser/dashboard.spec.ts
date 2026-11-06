import { expect, test } from "@playwright/test";
import { expectFits, mockApi, order, watchErrors } from "./mock-api";

test.describe("every dashboard page opens and fits", () => {
  for (const [path, heading] of [["/", "Overview"], ["/orders", "Orders"], ["/products", "Products"], ["/customers", "Customers"], ["/coupons", "Coupons"], ["/settings", "Settings"]] as const) {
    test(path, async ({ page }) => {
      const errors = watchErrors(page);
      await mockApi(page);
      await page.goto(path);
      await expect(page).toHaveTitle(new RegExp(`${heading} · Kalacar owner`));
      await page.waitForTimeout(800);
      await expectFits(page);
      expect(errors).toEqual([]);
      await expect(page.locator('[role="alert"]')).toHaveCount(0);
    });
  }
});

test("menu shows the website link in a new tab, not Owner space", async ({ page }, info) => {
  await mockApi(page);
  await page.goto("/");
  const scope = info.project.name === "phone" ? page.locator(".mobile-brand") : page.locator(".sidebar");
  const link = scope.getByRole("link", { name: /Visit website/ });
  await expect(link).toHaveAttribute("href", "http://localhost:3000/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(scope.getByText("OWNER SPACE")).toHaveCount(0);
});

test("the website link is saved safely in Settings", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings");
  const card = page.locator('[aria-labelledby="shop-link-title"]');
  const input = card.locator("input");
  await input.fill("javascript:alert(1)");
  await card.getByRole("button", { name: "Save link" }).click();
  await expect(card.getByRole("alert")).toContainText("https://");
  await input.fill("https://kalacar.in/");
  await card.getByRole("button", { name: "Save link" }).click();
  await expect(card.getByText("Saved.")).toBeVisible();
});

test("Razorpay status explains each state and hides keys", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings");
  const card = page.locator('[aria-labelledby="payment-status-title"]');
  await expect(card).toContainText("Test mode");
  await expect(card).toContainText("Open for test payments");
  await expect(card).not.toContainText("rzp_");
});

test("order buttons fill the right links and block with a reason", async ({ page }) => {
  await mockApi(page);
  await page.goto("/orders");
  const paid = page.locator(".data-table tbody tr", { hasText: "Paid Buyer" });
  await expect(paid.getByRole("link", { name: "SMS" })).toHaveAttribute("href", /^sms:\+919876543210\?&body=SMS%20received%20AAAAAAAA/);
  await expect(paid.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919876543210");
  await expect(paid.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210/);
  const noPhone = page.locator(".data-table tbody tr", { hasText: "No Phone" });
  await noPhone.getByRole("button", { name: "SMS" }).click({ force: true }); // greyed out, but explains why when clicked
  await expect(noPhone.getByText("This order has no valid phone number.")).toBeVisible();
  await expectFits(page);
});

test("Products search and stock filters work", async ({ page }) => {
  await mockApi(page);
  await page.goto("/products");
  const stock = page.locator(".product-stock-filters");
  await expect(stock.getByRole("button", { name: /^All/ })).toContainText("3");
  await stock.getByRole("button", { name: /^Low stock/ }).click();
  await expect(page.getByText("Test Ganesh")).toBeVisible();
  await expect(page.getByText("Test Soldout")).toHaveCount(0);
  await stock.getByRole("button", { name: /^All/ }).click();
  await page.getByRole("searchbox", { name: "Search products" }).fill("nothing like this");
  await expect(page.getByText("No products match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("Test Soldout")).toBeVisible();
  await expectFits(page);
});

test.describe("orders stay in sync without constant calling", () => {
  test("a new payment appears, with a count, within the fallback time", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/products");
    await expect(page).toHaveTitle(/Products/);
    await page.waitForTimeout(1500);
    state.orders = [order("dddddddd-4", "New Buyer", "Paid"), ...state.orders];
    state.stamp = "2";
    await expect(page).toHaveTitle(/^\(1\) Products/, { timeout: 20000 });
    await page.goto("/orders");
    await expect(page.getByText("New Buyer")).toBeVisible();
  });
  test("an order that was already there doesn't alert", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/products");
    await page.waitForTimeout(1500);
    state.stamp = "2";
    await page.waitForTimeout(17000);
    await expect(page).toHaveTitle(/^Products/);
  });
  test("opening Orders clears the count", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/products");
    await page.waitForTimeout(1500);
    state.orders = [order("dddddddd-4", "New Buyer", "Paid"), ...state.orders];
    state.stamp = "2";
    await expect(page).toHaveTitle(/^\(1\)/, { timeout: 20000 });
    await page.evaluate(() => window.history.pushState(null, "", "/orders"));
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await expect(page).toHaveTitle(/^Orders/);
  });
  test("nothing reloads full order lists while nothing changes", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/orders");
    await page.waitForTimeout(2000);
    const orders = state.calls["/api/admin/orders"] ?? 0, products = state.calls["/api/admin/products"] ?? 0, metrics = state.calls["/api/admin/metrics"] ?? 0;
    await page.waitForTimeout(12000);
    expect(state.calls["/api/admin/orders"]).toBe(orders);
    expect(state.calls["/api/admin/products"]).toBe(products);
    expect(state.calls["/api/admin/metrics"]).toBe(metrics);
  });
});

test.describe("failures don't harm the dashboard", () => {
  test("a broken live-update setup still shows new orders", async ({ page }) => {
    const state = await mockApi(page, { realtime: { key: "not-a-real-key", cluster: "zz" } });
    await page.goto("/orders");
    await expect(page.getByText("Waiting Buyer")).toBeVisible();
    state.orders = [order("eeeeeeee-5", "Late Buyer", "Paid"), ...state.orders];
    state.stamp = "3";
    await expect(page.getByText("Late Buyer")).toBeVisible({ timeout: 20000 });
  });
  test("the page works when live-update settings can't load", async ({ page }) => {
    const state = await mockApi(page);
    state.failing.add("/api/realtime/config");
    await page.goto("/orders");
    await expect(page.getByText("Paid Buyer")).toBeVisible();
  });
  test("a failed background reload keeps orders on screen", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/orders");
    await expect(page.getByText("Paid Buyer")).toBeVisible();
    state.failing.add("/api/admin/orders");
    state.stamp = "4";
    await page.waitForTimeout(17000);
    await expect(page.getByText("Paid Buyer")).toBeVisible();
  });
});
