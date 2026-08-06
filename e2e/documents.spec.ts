import { test, expect } from "@playwright/test";

/**
 * The résumé and the CV are the two pages that get printed and downloaded, and
 * both of those paths have been broken before without anything noticing.
 */

test.describe("printing", () => {
  for (const path of ["/resume", "/cv"] as const) {
    test(`${path} prints all of its text, including mid-reveal`, async ({ page }) => {
      await page.goto(path);
      // Deliberately early: the reveal is still running, and nothing pauses a
      // page for the print dialog. Without the print rule, whatever had not
      // arrived yet would go to paper as white space.
      await page.emulateMedia({ media: "print" });

      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal]")]
          .filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length);
      expect(hidden).toBe(0);
    });

    test(`${path} does not print the fixed site header`, async ({ page }) => {
      await page.goto(path);
      await page.emulateMedia({ media: "print" });
      // It is fixed, so without the print rule it lands on the first page.
      const display = await page.evaluate(
        () => getComputedStyle(document.querySelector('header[role="banner"]')!).display);
      expect(display).toBe("none");
    });
  }
});

test.describe("the reveal cannot leave a document blank", () => {
  for (const path of ["/resume", "/cv"] as const) {
    test(`${path} shows everything with JavaScript disabled`, async ({ browser }) => {
      // The server renders the waiting state and only script moves it on, so
      // without script the sheet would stay blank forever. That is the one
      // failure mode a résumé cannot have.
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(path);

      const counts = await page.evaluate(() => {
        const all = [...document.querySelectorAll("[data-reveal]")];
        return {
          total: all.length,
          shown: all.filter((el) => Number(getComputedStyle(el).opacity) > 0.99).length,
        };
      });
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.shown).toBe(counts.total);
      await context.close();
    });
  }
});

test.describe("the download still works", () => {
  for (const [path, name] of [["/resume", "resume"], ["/cv", "cv"]] as const) {
    test(`${path} produces a PDF`, async ({ page }) => {
      await page.goto(path);
      const button = page.getByRole("button", { name: /download/i });
      await expect(button).toBeEnabled();

      const download = page.waitForEvent("download", { timeout: 25_000 });
      await button.click();
      const file = await download;
      expect(file.suggestedFilename().toLowerCase()).toContain(name === "cv" ? "cv" : "resume");
    });
  }
});
