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

    // While building, the drawing branches and the node springs are real
    // animations.
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
  test("covers the home page while loading, then hands it over automatically", async ({ page }) => {
    await page.goto("/");
    const loader = page.getByRole("dialog", { name: /portfolio loading/i });

    await enterSite(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(loader).toBeHidden();
    const audio = page.getByRole("button", { name: "Play audio playback" });
    await expect(audio).toBeVisible();
    await audio.hover();
    await expect(page.getByText("Click to turn on audio")).toBeVisible();
    await page.mouse.move(1100, 78);
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/automatic-reveal-desktop.png" });
    await audio.click();
    await expect(page.getByRole("button", { name: "Pause audio playback" })).toBeVisible();
  });

  test("rebuilds the scene dots on a same-session reload", async ({ page }) => {
    await page.goto("/");
    await enterSite(page);
    const nav = page.getByRole("navigation", { name: "Scene navigation indicator" });
    await expect(nav).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog", { name: /portfolio loading/i })).toBeHidden();
    await expect(nav).toBeVisible();
    const initialWidth = await nav.evaluate((element) => element.getBoundingClientRect().width);
    expect(initialWidth).toBeLessThan(100);
    await expect.poll(() => nav.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(200);
  });
});
