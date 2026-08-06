import { test, expect } from "@playwright/test";
import { enterSite } from "./helpers";

/**
 * The page-entry animations, run without reduced motion.
 *
 * These assert the *contract* of each intro — which animations exist, in what
 * order, and that the page ends up complete — rather than elapsed milliseconds.
 * Timing assertions on a shared CI runner measure the runner.
 */

test.describe("the résumé writes itself onto its sheet", () => {
  test("every piece is scheduled, in reading order, and all arrive", async ({ page }) => {
    await page.goto("/resume");

    await page.waitForFunction(
      () => document.getAnimations().some((a) => (a as CSSAnimation).animationName === "paper-reveal"),
      null,
      { polling: 16, timeout: 20_000 },
    );

    const schedule = await page.evaluate(() => {
      const pieces = [...document.querySelectorAll("[data-reveal]")];
      const delays = pieces.map((el) => {
        const anim = el.getAnimations()[0] as CSSAnimation | undefined;
        return anim ? Math.round(anim.effect!.getTiming().delay as number) : null;
      });
      return { count: pieces.length, delays };
    });

    expect(schedule.count).toBeGreaterThan(1);
    expect(schedule.delays.every((d) => d !== null)).toBe(true);
    // Reading order is the whole point: the header first, the footer last.
    const delays = schedule.delays as number[];
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }

    // And it finishes: nothing is left invisible once the writing is done.
    await expect
      .poll(async () => page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal]")]
          .filter((el) => Number(getComputedStyle(el).opacity) > 0.99).length,
      ), { timeout: 15_000 })
      .toBe(schedule.count);
  });

  test("a scroll finishes it at once", async ({ page }) => {
    await page.goto("/resume");
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => page.evaluate(() => {
        const all = [...document.querySelectorAll("[data-reveal]")];
        return all.length > 0 && all.every((el) => Number(getComputedStyle(el).opacity) > 0.99);
      }), { timeout: 8_000 })
      .toBe(true);
  });
});

test.describe("the skill web assembles itself", () => {
  test("it builds and then settles into an ordinary web", async ({ page }) => {
    await page.goto("/skills");

    // While building, the comets and the node springs are real animations.
    await page.waitForFunction(
      () => document.getAnimations()
        .some((a) => String((a as CSSAnimation).animationName).startsWith("skill-")),
      null,
      { polling: 16, timeout: 20_000 },
    );

    // Once done, every intro style is dropped — nothing it did survives.
    await expect
      .poll(async () => page.evaluate(() => {
        const nodes = [...document.querySelectorAll("[data-web-node]")];
        return nodes.length > 0 && nodes.every((el) => getComputedStyle(el).opacity === "1");
      }), { timeout: 20_000 })
      .toBe(true);

    await expect(page.getByRole("button", { name: /saikiran/i })).toBeVisible();
  });
});

test.describe("the entry screen", () => {
  test("covers the home page until Enter, then hands it over", async ({ page }) => {
    await page.goto("/");
    // The hero is behind the entry screen and must not be readable through it.
    const enter = page.getByRole("button", { name: /enter portfolio/i });
    await enter.waitFor({ state: "visible", timeout: 20_000 });

    await enterSite(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(enter).toBeHidden();
  });
});
