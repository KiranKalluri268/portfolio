import { test, expect } from "@playwright/test";
import { PAGES, enterSite } from "./helpers";

test.describe("every route answers", () => {
  for (const path of PAGES) {
    test(`${path} responds and renders a heading`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
    });
  }

  test("/ opens once the entry screen is dismissed", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await enterSite(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("addresses that are not pages", () => {
  // These are the pages with no test coverage at all until now, and the ones a
  // visitor is most likely to reach by accident.
  test("an unknown path returns 404 and the site's own page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "There is nothing at this address",
    );
    // The header proves it is still inside the layout: the site did not go
    // anywhere, only the page.
    await expect(page.getByRole("banner")).toBeVisible();
    // Scoped to main: the header's logo is also a link home.
    await expect(page.getByRole("main").getByRole("link", { name: "Home" })).toBeVisible();
  });

  test("a nested unknown path returns 404 too", async ({ page }) => {
    const response = await page.goto("/projects/no-such-project");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "There is nothing at this address",
    );
  });
});

test("the social card renders as a PNG with no network of its own", async ({ request }) => {
  // It used to fetch the black hole from the deployed site, so a build could
  // produce a card without its background and nothing would notice.
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  // A card that failed to draw the disc is markedly smaller than one that did.
  expect((await response.body()).byteLength).toBeGreaterThan(100_000);
});

test("robots and sitemap are served", async ({ request }) => {
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/projects");
});
