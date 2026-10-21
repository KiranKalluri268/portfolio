import { describe, expect, it } from "vitest";
import {
  PROJECTS_CARD_CLEARANCE,
  PROJECTS_CARD_MAX_WIDTH,
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
      const titleWidth = 232;
      const layout = homeProjectsLayout({
        ...viewport,
        narrow: false,
        cardAspect: 690 / 1200,
        titleHeight,
        titleWidth,
        headerBottom: 96,
        navBottom: 86,
      });

      // Below the heading, or beside it and clear of it.
      const cardLeft = (viewport.width - layout.cardWidth) / 2;
      const titleRight = viewport.width * 0.1 + titleWidth / 2;
      expect(
        layout.cardTop >= titleBottom + PROJECTS_CONTENT_GAP
          || cardLeft >= titleRight + PROJECTS_CARD_CLEARANCE - 0.01,
      ).toBe(true);
      expect(layout.cardTop).toBeGreaterThanOrEqual(86 + PROJECTS_CARD_CLEARANCE);
      expect(layout.cardBottom).toBeLessThan(layout.overlayTop);
      expect(layout.overlayTop).toBeLessThan(layout.railTop);
      expect(layout.railTop).toBeLessThan(viewport.height);
      expect(layout.contentOffset).toBeGreaterThanOrEqual(12);
      expect(layout.contentOffset).toBeLessThanOrEqual(24);
      expect(layout.detailsOffset - layout.contentOffset).toBeGreaterThanOrEqual(28);
      expect(layout.detailsOffset - layout.contentOffset).toBeLessThanOrEqual(48);
    });
  }

  it("uses the room under the scene dots for a taller card", () => {
    const options = { width: 1440, height: 900, narrow: false, cardAspect: 690 / 1200, titleHeight: 72, headerBottom: 96 };
    const after = homeProjectsLayout({ ...options, titleWidth: 232, navBottom: 86 });
    // Below the heading, the card at 1440x900 was 618x355.
    expect(after.cardHeight).toBeGreaterThan(355 * 1.2);
  });

  it("never draws a desktop card wider than its cap", () => {
    const layout = homeProjectsLayout({
      width: 2560,
      height: 1440,
      narrow: false,
      cardAspect: 690 / 1200,
      titleHeight: 72,
      titleWidth: 232,
      headerBottom: 96,
      navBottom: 86,
    });

    expect(layout.cardWidth).toBe(PROJECTS_CARD_MAX_WIDTH);
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
