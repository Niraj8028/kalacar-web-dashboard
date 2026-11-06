import type { Page, Route } from "@playwright/test";

// The shop's API is answered here, so these tests never read or write the real database.
const colour = (id: string, name: string, stock: number, active = true) => ({ id, name, swatch: "#b5763a", gallery: [], price: 999, originalPrice: 1299, stock, sort: 0, active });
const product = (id: string, name: string, deity: string, variants: ReturnType<typeof colour>[]) => ({ id, name, deity, image: "/favicon.svg", gallery: ["/favicon.svg"], price: 999, stock: variants.reduce((sum, v) => sum + v.stock, 0), variants, specs: [], highlights: [], accordions: [] });
export const order = (id: string, customer: string, status: string, over: object = {}) => ({ id, date: "6 Nov 2026", customer, item: "Test murti · 1", total: 999, status, fulfillmentStatus: "unfulfilled", email: "buyer@example.test", phone: "9876543210", address: "Test address", pincode: "411001", ...over });
const T = (word: string) => ({ whatsapp: `WhatsApp ${word} {order_id}`, sms: `SMS ${word} {order_id}`, emailSubject: `Order {order_id} ${word}`, emailBody: `Hi {customer_name}, ${word}` });
const templates = { unfulfilled: T("received"), processing: T("preparing"), dispatched: { ...T("sent"), sms: "Sent by {courier}, ID {tracking_id}" }, completed: { ...T("done"), sms: "" } };
const label = { deliverTo: "{customer_name}", from: "Kalacar", details: "{order_id}" };

export type ApiState = { orders: ReturnType<typeof order>[]; stamp: string; realtime: { key: string | null; cluster: string | null }; calls: Record<string, number>; shopLink: string; failing: Set<string>; payment: object };

export async function mockApi(page: Page, over: Partial<ApiState> = {}) {
  const state: ApiState = {
    orders: [order("aaaaaaaa-1", "Paid Buyer", "Paid"), order("bbbbbbbb-2", "No Phone", "Paid", { phone: "", fulfillmentStatus: "processing" }), order("cccccccc-3", "Waiting Buyer", "Awaiting payment")],
    stamp: "1", realtime: { key: null, cluster: null }, calls: {}, shopLink: "http://localhost:3000/", failing: new Set(),
    payment: { mode: "test", secretSet: true, checkoutOpen: true, webhookSet: false }, ...over,
  };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const products = [product("krushna", "Test Krushna", "Krishna", [colour("gold", "Gold", 5), colour("white", "White", 0), colour("rose", "Rose", 0, false)]), product("ganesh", "Test Ganesh", "Ganesh", [colour("plain", "Plain", 2)]), product("soldout", "Test Soldout", "Shiva", [colour("black", "Black", 0)])];
  await page.route("**/api/**", route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    state.calls[path] = (state.calls[path] ?? 0) + 1;
    if (state.failing.has(path)) return json(route, { error: "Temporarily unavailable" }, 503);
    if (path === "/api/auth/session") return json(route, { user: { name: "Test Owner", email: "owner@example.test" }, isOwner: true });
    if (path === "/api/realtime/config") return json(route, state.realtime);
    if (path === "/api/admin/orders/changes") return json(route, { stamp: state.stamp });
    if (path === "/api/admin/orders") return json(route, { orders: state.orders, statusCounts: { all: state.orders.length, pending_payment: 1, processing: 2, on_hold: 0, dispatched: 0, completed: 0, cancelled: 0, refunded: 0 }, total: state.orders.length, listLimit: 100 });
    if (path === "/api/admin/products") return json(route, { products });
    if (path === "/api/admin/metrics") return json(route, { todayRevenue: 999, monthRevenue: 1998, totalOrders: 3, paidOrders: 2, averageOrderValue: 999, lowStockProducts: 1, outOfStockProducts: 1, lowStockThreshold: 3, fulfillmentNeeded: 1, paymentRecovery: 1, paymentMode: "test" });
    if (path === "/api/admin/customers") return json(route, { customers: [{ id: "u1", name: "Paid Buyer", email: "buyer@example.test", phone: "9876543210", google: true, isOwner: false, joined: "2026-11-01", paidOrders: 1, allOrders: 2, spent: 999, refunded: 0, lastOrder: "2026-11-06", city: "Pune", pincode: "411001" }] });
    if (path === "/api/admin/coupons") return json(route, { coupons: [{ id: 1, code: "TEST10", type: "percent", amount: 10, maxDiscount: null, minSpend: 0, usageLimit: 5, oncePerCustomer: false, startsOn: null, expiresOn: null, active: true, used: 1, reserved: 1, discountGiven: 100, status: "active" }] });
    if (path === "/api/admin/categories") return json(route, { categories: [{ id: 1, name: "Krishna", productCount: 1 }, { id: 2, name: "Ganesh", productCount: 1 }] });
    if (path === "/api/admin/order-messages") return json(route, { templates, defaults: templates, variables: [{ key: "order_id", label: "Order ID" }, { key: "customer_name", label: "Customer name" }, { key: "courier", label: "Courier" }, { key: "tracking_id", label: "Tracking ID" }] });
    if (path === "/api/admin/print-label") return json(route, { template: label, defaults: label, variables: [{ key: "order_id", label: "Order ID" }] });
    if (path === "/api/admin/payment-status") return json(route, state.payment);
    if (path === "/api/admin/push") return json(route, { publicKey: "" });
    if (path === "/api/admin/settings" && request.method() === "PATCH") {
      const body = request.postDataJSON() as { shopLink?: string };
      if (body.shopLink !== undefined) {
        if (!/^https:\/\//.test(body.shopLink)) return json(route, { error: "The website link must start with https://" }, 400);
        state.shopLink = body.shopLink;
        return json(route, { shopLink: state.shopLink });
      }
      return json(route, body);
    }
    if (path === "/api/admin/settings") return json(route, { giftWrap: { enabled: false, price: 49, title: "Gift-ready packaging", description: "" }, store: { mode: "live", comingSoonMessage: "", announcementEnabled: false, announcementText: "" }, shopLink: state.shopLink });
    return json(route, { error: `Not expected in this test: ${path}` }, 500);
  });
  return state;
}

export async function expectFits(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (extra > 0) throw new Error(`Page is ${extra}px wider than the screen`);
}

export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  return errors;
}
