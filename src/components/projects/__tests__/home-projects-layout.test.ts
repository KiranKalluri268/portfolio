import { describe, expect, it } from "vitest";
import {
  PROJECTS_CONTENT_GAP,
  desktopProjectsTitleCentre,
  homeProjectsLayout,
} from "../home-projects-layout";

const DESKTOPS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 2560, height: 1440 },
] as const;

describe("home Projects desktop layout", () => {
  for (const viewport of DESKTOPS) {
    it(`keeps separate content bands at ${viewport.width}x${viewport.height}`, () => {
      const titleHeight = 72;
      const titleBottom = desktopProjectsTitleCentre({
        sectionHeight: viewport.height,
        headerBottom: 96,
        titleHeight,
      }) + titleHeight / 2;
      const layout = homeProjectsLayout({
        ...viewport,
        narrow: false,
        cardAspect: 690 / 1200,
        titleHeight,
        headerBottom: 96,
      });

      expect(layout.cardTop).toBeGreaterThanOrEqual(titleBottom + PROJECTS_CONTENT_GAP);
      expect(layout.cardBottom).toBeLessThan(layout.overlayTop);
      expect(layout.overlayTop).toBeLessThan(layout.railTop);
      expect(layout.railTop).toBeLessThan(viewport.height);
    });
  }

  it("preserves the 680px reference cap when height allows it", () => {
    const layout = homeProjectsLayout({
      width: 1920,
      height: 1080,
      narrow: false,
      cardAspect: 690 / 1200,
      titleHeight: 72,
      headerBottom: 96,
    });

    expect(layout.cardWidth).toBe(680);
  });
});
