import { expect, test } from "@playwright/test";
import { expectFits, mockApi, watchErrors } from "./mock-api";

// A 1×1 PNG, small enough to upload unchanged.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test.describe("Settings > Logo", () => {
  test("upload, keep own colours, set a width, save", async ({ page }) => {
    const errors = watchErrors(page);
    const state = await mockApi(page);
    await page.goto("/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Logo", exact: true }) });
    await expect(card.getByText("Using the built-in Kalacar logo.")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /Show the logo in white/ })).toHaveCount(0);
    await card.getByLabel("Shop logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(card.getByText("Change photo")).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /Show the logo in white/ })).not.toBeChecked();
    await expect(card.getByRole("img", { name: "Logo preview" })).toHaveCSS("filter", "none");
    await card.getByRole("slider").fill("220");
    await expect(card.getByText("Logo width on computers: 220px")).toBeVisible();
    await expect(card.getByText(/Phones show it at 70% of this width \(154px\)/)).toBeVisible();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText(/Saved\. The shop shows the new logo now/)).toBeVisible();
    expect(state.brand).toEqual({ logo: "/uploads/site-test-1.png", width: 220, white: false });
    await expectFits(page);
    expect(errors).toEqual([]);
  });
  test("white option and back to the default size", async ({ page }) => {
    const state = await mockApi(page, { brand: { logo: "/uploads/old.png", width: 180, white: false } });
    await page.goto("/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Logo", exact: true }) });
    await card.getByRole("checkbox", { name: /Show the logo in white/ }).check();
    await expect(card.getByRole("img", { name: "Logo preview" })).not.toHaveCSS("filter", "none");
    await card.getByRole("button", { name: "Use the default size" }).click();
    await expect(card.getByText(/\(default\)/)).toBeVisible();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText(/Saved/)).toBeVisible();
    expect(state.brand).toEqual({ logo: "/uploads/old.png", width: 0, white: true });
  });
  test("an older shop that sends only the logo still loads", async ({ page }) => {
    await mockApi(page, { brand: { logo: "/uploads/old.png" } as never });
    await page.goto("/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Logo", exact: true }) });
    await expect(card.getByText(/Logo width on computers: 150px \(default\)/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
