import { test, expect } from "@playwright/test";

/** The menu is the only way to reach most of the site from most of the site,
 *  and it is the thing every page-entry animation waits on. */
test.describe("the site menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/skills");
    await page.getByRole("button", { name: /open menu/i }).click();
  });

  test("opens as a dialog listing every page", async ({ page }) => {
    const panel = page.getByRole("dialog", { name: /site menu/i });
    await expect(panel).toBeVisible();
    for (const label of ["Home", "Projects", "Skills", "Résumé", "CV"]) {
      await expect(panel.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
  });

  test("marks the page you are already on", async ({ page }) => {
    const current = page.getByRole("dialog").getByRole("link", { name: "Skills", exact: true });
    await expect(current).toHaveAttribute("aria-current", "page");
  });

  test("navigates, and the cover is gone by the time it lands", async ({ page }) => {
    await page.getByRole("dialog").getByRole("link", { name: "Projects", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    // The panel holds the screen until the new route has painted, then lifts.
    // If it were left up, the page would be unreachable.
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Escape closes it and returns focus to the trigger", async ({ page }) => {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: /open menu/i })).toBeFocused();
  });

  test("keeps focus inside itself", async ({ page }) => {
    const panel = page.getByRole("dialog");
    // Nothing behind the cover is reachable, so tabbing has to cycle within it.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    const inside = await panel.evaluate((el) => el.contains(document.activeElement));
    expect(inside).toBe(true);
  });
});
