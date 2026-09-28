import type { Page } from "@playwright/test";

/** Every route that is not the home page. */
export const PAGES = ["/projects", "/skills", "/resume", "/cv"] as const;

/**
 * Finds sideways scroll anywhere on the page, and returns what is causing it.
 *
 * Measuring `document.scrollingElement.scrollWidth` is the obvious version and
 * it is the version that has already failed here: a sideways-scroll check
 * passed while the overflow sat inside `.page`, which is its own scroll
 * container. So this walks every element that can scroll, not just the
 * document — including ones whose class names are hashed by CSS modules and
 * cannot be selected for by name.
 */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const guilty: { tag: string; className: string; scrollWidth: number; clientWidth: number }[] = [];
    const describe = (el: Element) => ({
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });

    const root = document.scrollingElement ?? document.documentElement;
    // A pixel of slack: sub-pixel layout rounding is not a dragging page.
    if (root.scrollWidth > root.clientWidth + 1) guilty.push(describe(root));

    for (const el of document.querySelectorAll("*")) {
      const overflowX = getComputedStyle(el).overflowX;
      const scrollable = overflowX === "auto" || overflowX === "scroll";
      if (!scrollable) continue;
      if (el.scrollWidth > el.clientWidth + 1) guilty.push(describe(el));
    }
    return guilty;
  });
}

/** Waits for the automatic loading reveal to hand back the home page. */
export async function enterSite(page: Page) {
  await page.waitForFunction(() => window.sessionStorage.getItem("portfolio:entered") === "true", null, { timeout: 20_000 });
  await page.getByRole("dialog", { name: /portfolio loading/i }).waitFor({ state: "hidden", timeout: 20_000 });
  await page.getByRole("banner").waitFor({ state: "visible" });
}
