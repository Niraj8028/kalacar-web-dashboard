import { expect, test } from "@playwright/test";
import { expectFits, HOME, mockApi, OLD_HERO, order, watchErrors } from "./mock-api";

test.describe("every dashboard page opens and fits", () => {
  for (const [path, heading] of [["/", "Overview"], ["/orders", "Orders"], ["/products", "Products"], ["/customers", "Customers"], ["/coupons", "Coupons"], ["/pages", "Pages"], ["/reviews", "Reviews"], ["/inquiries", "Inquiries"], ["/settings", "Settings"]] as const) {
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
  await page.goto("/settings?tab=shop");
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
  await page.goto("/settings?tab=payments");
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

test.describe("Pages section", () => {
  test("Home Page settings save, with a checkbox for each part", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/pages");
    const hero = page.locator("section", { has: page.getByRole("heading", { name: "Hero", exact: true }) });
    await hero.getByRole("textbox", { name: "Main title" }).fill("New hero title");
    await hero.getByRole("checkbox", { name: "Show description" }).uncheck();
    await page.getByRole("button", { name: "Save home page" }).click();
    await expect(page.getByText("Saved. The home page is updated.")).toBeVisible();
    expect(state.saved[0]).toMatchObject({ home: { hero: { show: true, slides: [{ title: "New hero title", showDescription: false }] } } });
    await expectFits(page);
  });
  test("hero slides: add, reorder, remove, timer settings", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/pages");
    const hero = page.locator("section", { has: page.getByRole("heading", { name: "Hero", exact: true }) });
    await hero.getByRole("button", { name: "+ Add slide" }).click();
    const second = hero.locator(".hero-slide-editor").nth(1);
    await second.getByRole("textbox", { name: "Main title" }).fill("Second title");
    await second.getByRole("button", { name: "Move up" }).click();
    await expect(hero.locator(".hero-slide-editor legend").first()).toHaveText("Slide 1 · Second title");
    await hero.getByRole("spinbutton", { name: "Seconds per slide" }).fill("8");
    await page.getByRole("button", { name: "Save home page" }).click();
    await expect(page.getByText("Saved. The home page is updated.")).toBeVisible();
    expect(state.saved[0]).toMatchObject({ home: { hero: { autoplay: true, interval: 8, slides: [{ title: "Second title" }, { title: "Hero title" }] } } });
    page.once("dialog", dialog => void dialog.accept());
    await hero.locator(".hero-slide-editor").nth(0).getByRole("button", { name: "Remove slide" }).click();
    await expect(hero.locator(".hero-slide-editor")).toHaveCount(1);
    await expect(hero.locator(".hero-slide-editor").getByRole("button", { name: "Remove slide" })).toBeDisabled();
    await hero.getByRole("checkbox", { name: /Change slides automatically/ }).uncheck();
    await expect(hero.getByRole("spinbutton", { name: "Seconds per slide" })).toHaveCount(0);
    await expectFits(page);
  });
  test("a shop still on the old single hero opens as one slide and saves as slides", async ({ page }) => {
    const state = await mockApi(page, { home: { ...HOME, hero: OLD_HERO } });
    await page.goto("/pages");
    const hero = page.locator("section", { has: page.getByRole("heading", { name: "Hero", exact: true }) });
    await expect(hero.locator(".hero-slide-editor")).toHaveCount(1);
    await expect(hero.getByRole("textbox", { name: "Main title" })).toHaveValue("Hero title");
    await hero.getByRole("textbox", { name: "Main title" }).fill("Changed");
    await page.getByRole("button", { name: "Save home page" }).click();
    expect(state.saved[0]).toMatchObject({ home: { hero: { show: true, slides: [{ title: "Changed" }] } } });
  });
  test("a hidden section stays hidden but keeps its text", async ({ page }) => {
    await mockApi(page);
    await page.goto("/pages");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Coming Soon", exact: true }) });
    await card.getByRole("checkbox", { name: "Show on site" }).uncheck();
    await expect(card.getByText(/Hidden on the site/)).toBeVisible();
    await card.getByRole("checkbox", { name: "Show on site" }).check();
    await expect(card.getByRole("button", { name: /Add upcoming murti/ })).toBeVisible();
  });
  test("a page can be edited with the rich text editor, with SEO fields", async ({ page }) => {
    const state = await mockApi(page);
    await page.goto("/pages");
    await page.getByRole("button", { name: /^About Kalacar/ }).click();
    await expect(page.getByText(/This page has "To confirm" items/)).toBeVisible();
    const editor = page.getByRole("textbox", { name: "About Kalacar content" });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Our real story");
    await page.getByLabel("SEO title (for Google)").fill("About us");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText("Saved. The page is updated.")).toBeVisible();
    expect(state.saved[0]).toMatchObject({ seoTitle: "About us" });
    expect(JSON.stringify(state.saved[0])).toContain("Our real story");
    await expectFits(page);
  });
});

test("reviews can be added, and the form says to use real ones", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/reviews");
  await page.getByRole("button", { name: "+ Add review" }).click();
  await expect(page.getByText(/only reviews from real customers/)).toBeVisible();
  await page.getByLabel("Customer name").fill("Real Buyer");
  await page.getByLabel("Review", { exact: true }).fill("Lovely finish");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  expect(state.saved[0]).toMatchObject({ author: "Real Buyer", text: "Lovely finish", rating: 5 });
});

test("inquiries show messages and can be marked handled", async ({ page }) => {
  await mockApi(page, { inquiries: [{ id: 1, name: "Asha", email: "asha@example.test", phone: "", message: "Is it in stock?", handled: false, createdAt: "2026-11-06T10:00:00.000Z" }] });
  await page.goto("/inquiries");
  await expect(page.getByText("Is it in stock?")).toBeVisible();
  await page.getByRole("button", { name: "Mark handled" }).click();
  await expect(page.getByRole("button", { name: "Mark as new" })).toBeVisible();
  await expectFits(page);
});

test("product page settings save, and real activity starts switched off", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/settings?tab=products");
  const card = page.locator('[aria-labelledby="product-page-title"]');
  await expect(card.getByRole("checkbox", { name: /Show how many people are viewing/ })).not.toBeChecked();
  await card.getByRole("checkbox", { name: "Show the offer" }).check();
  await card.getByLabel("Offer text").fill("₹200 off above ₹1,500");
  await card.getByRole("button", { name: "Save product page settings" }).click();
  await expect(card.getByText(/Saved. Every product page/)).toBeVisible();
  expect(state.saved[0]).toMatchObject({ productPage: { offer: { show: true, text: "₹200 off above ₹1,500" } } });
});

test("product editor has description and bundle choices", async ({ page }) => {
  await mockApi(page);
  await page.goto("/products");
  await page.getByRole("button", { name: "Edit details" }).first().click();
  await expect(page.getByLabel(/^Product description/)).toBeVisible();
  await expect(page.getByRole("group", { name: /Frequently bought together/ }).getByRole("checkbox").first()).toBeVisible();
});

test.describe("Settings are grouped by purpose", () => {
  const groups = [["Shop", "Shop status"], ["Products", "Product page settings"], ["Orders", "Customer message templates"], ["Bag and payments", "Razorpay status"]] as const;
  for (const [tab, card] of groups) {
    test(`${tab} tab shows its settings only`, async ({ page }) => {
      const errors = watchErrors(page);
      await mockApi(page);
      await page.goto("/settings");
      const nav = page.getByRole("navigation", { name: "Settings categories" });
      await nav.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole("heading", { name: card, exact: true })).toBeVisible();
      for (const [, other] of groups.filter(([name]) => name !== tab)) await expect(page.getByRole("heading", { name: other, exact: true })).toBeHidden();
      await expectFits(page);
      expect(errors).toEqual([]);
    });
  }
  test("the address remembers the tab", async ({ page }) => {
    await mockApi(page);
    await page.goto("/settings");
    await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: /^Orders/ }).click();
    await expect(page).toHaveURL(/\/settings\?tab=orders/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Customer message templates", exact: true })).toBeVisible();
  });
  test("unsaved typing survives switching tabs, and the tab says so", async ({ page }) => {
    await mockApi(page);
    await page.goto("/settings?tab=shop");
    const input = page.locator('[aria-labelledby="shop-link-title"] input');
    await input.fill("https://kalacar.in/");
    const nav = page.getByRole("navigation", { name: "Settings categories" });
    await expect(nav.getByRole("button", { name: /^Shop/ })).toContainText("Unsaved");
    await nav.getByRole("button", { name: /^Orders/ }).click();
    await nav.getByRole("button", { name: /^Shop/ }).click();
    await expect(input).toHaveValue("https://kalacar.in/");
  });
});
