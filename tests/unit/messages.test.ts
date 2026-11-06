import { describe, expect, it } from "vitest";
import { fill, mailLink, orderValues, whatsappNumber } from "../../src/messages";

describe("customer phone numbers for WhatsApp, SMS and Call", () => {
  it("adds 91 to Indian 10-digit numbers", () => expect(whatsappNumber("98765 43210")).toBe("919876543210"));
  it("removes a leading 0", () => expect(whatsappNumber("09876543210")).toBe("919876543210"));
  it("keeps a country code", () => expect(whatsappNumber("+1 415 555 2671")).toBe("14155552671"));
  it("refuses numbers that are too short or missing", () => {
    expect(whatsappNumber("12345")).toBe("");
    expect(whatsappNumber("")).toBe("");
    expect(whatsappNumber()).toBe("");
  });
});

describe("filling a template", () => {
  const labels = [{ key: "tracking_id", label: "Tracking ID" }];
  it("fills known values", () => expect(fill("Hi {first_name}", { first_name: "Asha" }, labels)).toEqual({ text: "Hi Asha", missing: [] }));
  it("reports a missing value", () => expect(fill("ID {tracking_id}", { tracking_id: "" }, labels).missing).toEqual(["tracking id"]));
  it("doesn't read a customer's text as a variable", () => expect(fill("Hi {first_name}", { first_name: "{tracking_id}", tracking_id: "SECRET" }, labels).text).toBe("Hi {tracking_id}"));
});

describe("order details", () => {
  const order = { id: "ab12cd34-1111", customer: "Asha Patil", total: 1299, items: [{ name: "Krushna", variant: "Gold", quantity: 1 }, { name: "Ganesh", variant: "Standard", quantity: 2 }], trackingCourier: "trackon", trackingId: "T1" };
  it("builds the values messages use", () => {
    const values = orderValues(order, "dispatched");
    expect(values).toMatchObject({ first_name: "Asha", order_id: "AB12CD34", order_total: "₹1,299", status: "Dispatched", courier: "Trackon", tracking_id: "T1", product_names: "Krushna (Gold) x 1, Ganesh x 2" });
  });
});

describe("email links", () => {
  it("keeps special characters from breaking the link", () => {
    const link = mailLink("a@example.test", "Order & more", "Line 1\nLine #2");
    expect(link).toContain("subject=Order%20%26%20more");
    expect(link).toContain("Line%201%0D%0ALine%20%232");
  });
});
