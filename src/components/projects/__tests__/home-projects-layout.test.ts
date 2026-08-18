import { describe, expect, it } from "vitest";
import {
  PROJECTS_CONTENT_GAP,
  desktopProjectsTitleCentre,
  homeProjectsLayout,
  homeProjectsOverlayOffset,
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
      expect(layout.contentOffset).toBeGreaterThanOrEqual(12);
      expect(layout.contentOffset).toBeLessThanOrEqual(24);
      expect(layout.detailsOffset - layout.contentOffset).toBeGreaterThanOrEqual(28);
      expect(layout.detailsOffset - layout.contentOffset).toBeLessThanOrEqual(48);
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

  it("does not offset the mobile card and details", () => {
    const layout = homeProjectsLayout({
      width: 390,
      height: 844,
      narrow: true,
      cardAspect: 768 / 900,
    });

    expect(layout.contentOffset).toBe(0);
    expect(layout.detailsOffset).toBe(0);
  });
});

describe("home Projects detail position", () => {
  it("stays centred on desktop while the focused card changes", () => {
    expect(homeProjectsOverlayOffset({
      narrow: false,
      shiftLimit: 400,
      focusedOffset: 260,
    })).toBe(0);
  });

  it("continues to follow a card within the mobile viewport", () => {
    expect(homeProjectsOverlayOffset({
      narrow: true,
      shiftLimit: 120,
      focusedOffset: 260,
    })).toBe(120);
  });
});
