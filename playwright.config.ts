import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

/**
 * Browser tests. Everything in `e2e/` needs a real engine — layout, paint,
 * scroll containers, print, touch — which is exactly what jsdom cannot give
 * and what every visual regression in this project's history has been about.
 *
 * Two projects rather than one. `chromium` runs with reduced motion so the
 * page is deterministic the moment it loads: no entry animation, no assembling
 * skill web, no résumé writing itself. That is the right setting for testing
 * what a page *is*. `motion` runs the handful of specs that are about the
 * animations themselves.
 */

/** Playwright downloads its own browser in CI. In a sandbox that already has
 *  one at a different revision, point at it rather than fetching another —
 *  set PLAYWRIGHT_CHROMIUM_EXECUTABLE. Unset everywhere else, including CI. */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const PORT = 3210;

/** Annotated, not inferred. Without the contextual type these nest as
 *  `string[][]` rather than reporter tuples, `defineConfig` falls through to
 *  its last overload, and the error TypeScript then reports is about whatever
 *  option that overload happens to drop — nothing to do with the reporter. */
const reporter: PlaywrightTestConfig["reporter"] = process.env.CI
  ? [["github"], ["list"]]
  : [["list"]];

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  // The animation specs measure elapsed time, so they must not compete with
  // other pages for CPU. Everything else is safe in parallel.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    launchOptions: { executablePath },
  },

  projects: [
    {
      name: "chromium",
      testIgnore: /\.motion\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath },
        // Under `contextOptions`, not beside `viewport`. `reducedMotion` is a
        // browser-context option, and `use` has no top-level entry for it —
        // put it there and `defineConfig` quietly falls through to a permissive
        // overload, so the setting is dropped and the config still compiles.
        contextOptions: { reducedMotion: "reduce" },
      },
    },
    {
      name: "motion",
      testMatch: /\.motion\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],

  // A production build, not `next dev`. Dev renders error overlays instead of
  // error.tsx, skips some optimisation, and is slower and noisier — none of
  // which is what ships.
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
};

export default defineConfig(config);
