import { test, expect } from "@playwright/test";
import { enterSite } from "./helpers";

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

/** The menu and the entry screen both hold the page still, and reaching Home
 *  through the menu has both holding it at once. While each saved and restored
 *  `body.style.overflow` itself, the entry screen saved the menu's "hidden" and
 *  put that back on the way out, so the body kept `overflow: hidden` for the
 *  rest of the visit. That makes the body its own scroll container, which stops
 *  `position: sticky` working against the document — so About's panel scrolled
 *  away with the page instead of pinning, and the rest of its 500svh of runway
 *  read as a long gap before Experience. */
test.describe("the page is handed back when the menu and the entry screen overlap", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("button", { name: /open menu/i }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Home", exact: true }).click();
    await enterSite(page);
    // enterSite returns as soon as the header is visible behind the entry
    // screen, which is before its exit flight has finished. The page is still
    // held still until it actually goes, so the assertions below have to wait
    // for that or they read a lock that is legitimately still held.
    await expect(page.getByRole("dialog", { name: /portfolio entry/i })).toBeHidden();
  });

  test("the body is left scrollable", async ({ page }) => {
    const overflow = await page.evaluate(() => ({
      inline: document.body.style.overflow,
      computed: getComputedStyle(document.body).overflowY,
    }));
    expect(overflow.inline).not.toBe("hidden");
    expect(overflow.computed).not.toBe("hidden");
  });

  test("About still pins to the top instead of scrolling away", async ({ page }) => {
    const pinnedAt = await page.evaluate(async () => {
      const about = document.getElementById("about");
      if (!about) return null;
      const panel = [...about.querySelectorAll("div")].find(
        (element) => getComputedStyle(element).position === "sticky",
      );
      if (!panel) return null;
      const sectionTop = about.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, sectionTop + window.innerHeight * 2);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return Math.round(panel.getBoundingClientRect().top);
    });

    expect(pinnedAt).not.toBeNull();
    // Held at the top of the viewport. Unstuck it was measured at -1230.
    expect(Math.abs(pinnedAt as number)).toBeLessThan(4);
  });
});
