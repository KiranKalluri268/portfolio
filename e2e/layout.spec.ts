import { test, expect } from "@playwright/test";
import { PAGES, enterSite, horizontalOverflow } from "./helpers";

/**
 * The regression this file exists for: a `sed` meant for the résumé sheet also
 * matched the toolbar above it and widened it to 794px. On a phone that pushed
 * the download button off screen and made the page drag sideways — and the
 * check written at the time passed, because it measured the document's scroll
 * width while the overflow sat inside a nested scroll container.
 */

const PHONE = { width: 390, height: 844 };

test.describe("nothing drags sideways", () => {
  for (const path of PAGES) {
    test(`${path} on a phone`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }

  test("/ on a phone", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/");
    await enterSite(page);
    expect(await horizontalOverflow(page)).toEqual([]);
  });
});

test.describe("the documents keep their controls reachable", () => {
  for (const [path, label] of [
    ["/resume", "Download"],
    ["/cv", "Download"],
  ] as const) {
    test(`${path} keeps its download button on screen at 390px`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(path);

      const download = page.getByRole("button", { name: new RegExp(label, "i") });
      await expect(download).toBeVisible();

      // Visible is not the same as on screen: the button that went missing was
      // still in the DOM and still "visible", just past the right-hand edge.
      const box = await download.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width + 1);
    });

    test(`${path} scales its sheet to fit the screen`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(path);
      const sheet = page.locator("article").first();
      await expect(sheet).toBeVisible();
      const box = await sheet.boundingBox();
      expect(box).not.toBeNull();
      // PaperViewport scales A4 down rather than reflowing it, so the painted
      // sheet must fit even though its layout box is 210mm wide.
      expect(box!.width).toBeLessThanOrEqual(PHONE.width + 1);
    });
  }
});

test.describe("the header does not sit on top of the page's own controls", () => {
  // Found by this suite on its first run and fixed since. The site header is
  // fixed in the layout, so it painted over this dialog: at 402px the logo
  // landed on "Alternative view" and the menu button on Close, and at 1280px
  // the audio toggle sat inside the Close button and took its click — pressing
  // the middle of "Close" played audio. The header is now hidden while a
  // full-screen dialog is open.
  for (const [name, size] of [
    ["a phone", { width: 402, height: 860 }],
    ["a desktop", { width: 1280, height: 800 }],
  ] as const) {
    test(`nothing from the header sits on the directory on ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/skills");
      await page.getByRole("button", { name: /open accessible skill directory/i }).click();

      const close = page.getByRole("button", { name: /close skill directory/i });
      await expect(close).toBeVisible();

      // Nothing of the site header may be on screen over the dialog.
      await expect(page.getByRole("banner")).toBeHidden();

      // And the dialog's own control is the thing under the pointer.
      const box = (await close.boundingBox())!;
      const atCentre = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        return el?.closest("button")?.getAttribute("aria-label") ?? el?.tagName ?? "nothing";
      }, [box.x + box.width / 2, box.y + box.height / 2]);
      expect(atCentre).toMatch(/close skill directory/i);

      // Closing it gives the site back.
      await close.click();
      await expect(page.getByRole("banner")).toBeVisible();
    });
  }
});
