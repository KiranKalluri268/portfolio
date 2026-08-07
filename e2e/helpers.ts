import type { Page } from "@playwright/test";

/** Every route that is not the home page. The home page is gated behind the
 *  entry screen and needs `enterSite` first. */
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

/** Clicks through the entry screen and waits for the home page behind it.
 *  Under reduced motion the exit is 300ms rather than the full flight. */
export async function enterSite(page: Page) {
  const enter = page.getByRole("button", { name: /enter/i });
  await enter.waitFor({ state: "visible", timeout: 20_000 });
  await enter.click();
  await page.getByRole("banner").waitFor({ state: "visible" });
}
