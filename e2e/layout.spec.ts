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
  test("the skills directory heading clears the logo", async ({ page }) => {
    await page.goto("/skills");
    await page.getByRole("button", { name: /open accessible skill directory/i }).click();

    const heading = page.getByRole("heading", { name: "Skill directory" });
    await expect(heading).toBeVisible();

    const logo = await page.getByRole("banner").getByRole("link").first().boundingBox();
    const title = await heading.boundingBox();
    expect(logo).not.toBeNull();
    expect(title).not.toBeNull();
    expect(title!.x).toBeGreaterThanOrEqual(logo!.x + logo!.width);
  });

  // Found by this suite on its first run, and left failing rather than quietly
  // fixed — there is more than one reasonable way to fix it and the choice
  // changes what a visitor sees. Measured at 1280x720:
  //
  //   audio toggle  x 1090-1120  y 69-87
  //   Close button  x 1082-1152  y 55-93
  //
  // The toggle sits entirely inside the Close button, and elementFromPoint at
  // the centre of Close returns the toggle — so clicking the middle of "Close"
  // plays audio instead of closing the directory. Recorded in STATUS.md.
  test.fixme("the directory's Close button is the thing you click on", async ({ page }) => {
    await page.goto("/skills");
    await page.getByRole("button", { name: /open accessible skill directory/i }).click();

    const close = page.getByRole("button", { name: /close skill directory/i });
    await expect(close).toBeVisible();
    const box = (await close.boundingBox())!;

    const atCentre = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return el?.closest("button")?.getAttribute("aria-label") ?? el?.tagName ?? "nothing";
    }, [box.x + box.width / 2, box.y + box.height / 2]);

    expect(atCentre).toMatch(/close skill directory/i);
  });
});
