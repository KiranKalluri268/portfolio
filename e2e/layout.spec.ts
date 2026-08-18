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

const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
] as const;

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

test.describe("the Projects heading stays clear of the fixed header", () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await enterSite(page);

      const heroActions = page.locator(".hero-cta");
      const heroActionsBox = await heroActions.boundingBox();
      expect(heroActionsBox).not.toBeNull();
      expect(heroActionsBox!.y + heroActionsBox!.height).toBeLessThanOrEqual(viewport.height);

      // Put the scrubbed timeline just past the heading's first movement. The
      // pin spacer contains the full ScrollTrigger range, so this follows the
      // real browser geometry instead of duplicating the animation's scroll
      // distance in the test.
      await page.evaluate(() => {
        const section = document.querySelector<HTMLElement>("#projects");
        const spacer = section?.parentElement;
        if (!section || !spacer) throw new Error("Projects pin was not created");
        const start = spacer.getBoundingClientRect().top + window.scrollY;
        const range = spacer.offsetHeight - window.innerHeight;
        window.scrollTo(0, start + range * 0.18);
      });

      const title = page.locator("#projects > h2");
      await expect(title).toBeVisible();
      await expect.poll(async () => {
        const titleBox = await title.boundingBox();
        const headerBox = await page.getByRole("banner").boundingBox();
        if (!titleBox || !headerBox) return Number.NEGATIVE_INFINITY;
        return titleBox.y - (headerBox.y + headerBox.height);
      }).toBeGreaterThanOrEqual(15);

      const projectsGeometry = await page.locator("[data-home-projects-row]").evaluate((row) => ({
        cardTop: Number((row as HTMLElement).dataset.cardTop),
        cardBottom: Number((row as HTMLElement).dataset.cardBottom),
        overlayTop: Number((row as HTMLElement).dataset.overlayTop),
        railTop: Number((row as HTMLElement).dataset.railTop),
      }));
      const titleBox = await title.boundingBox();
      expect(titleBox).not.toBeNull();
      expect(projectsGeometry.cardTop).toBeGreaterThanOrEqual(
        titleBox!.y + titleBox!.height + 15,
      );
      expect(projectsGeometry.cardBottom).toBeLessThan(projectsGeometry.overlayTop);
      expect(projectsGeometry.overlayTop).toBeLessThan(projectsGeometry.railTop);
    });
  }
});

test("the compact scene controls stay beside Experience at 1280x720", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?section=experience");
  await enterSite(page);

  const controls = (await page.locator("[data-navigation-controls]").boundingBox())!;
  const highlight = (await page
    .locator("#experience .experience-row")
    .first()
    .locator(".experience-card-scale")
    .last()
    .boundingBox())!;

  expect(controls.x).toBeGreaterThanOrEqual(highlight.x + highlight.width);
});
