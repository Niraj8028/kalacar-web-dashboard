import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test("the Instagram account is set in Settings and refuses a bad username", async ({ page }) => {
  await mockApi(page);
  await page.goto("/settings?tab=shop");
  const card = page.locator('[aria-labelledby="instagram-title"]');
  const username = card.getByLabel("Instagram username");
  await username.fill("not a name");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("alert")).toContainText("valid Instagram username");
  await username.fill("@kalacar.in");
  await card.getByLabel("Show on the home page").check();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved.");
  await expect(username).toHaveValue("kalacar.in");
  await expect(card.getByRole("link", { name: /Open @kalacar\.in/ })).toHaveAttribute("href", "https://www.instagram.com/kalacar.in/");
});
