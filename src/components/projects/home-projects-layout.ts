export const PROJECTS_HEADER_GAP = 16;
export const PROJECTS_CONTENT_GAP = 16;

const RAIL_BAND = { wide: 92, narrow: 28 } as const;
const OVERLAY_BAND = { min: 132, ratio: 0.26, max: 230 } as const;

const clamp = (minimum: number, maximum: number, value: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** Desktop project details occupy one fixed position below the carousel.
 * Mobile keeps following the focused card because it has no progress rail to
 * settle with and may naturally stop between panels. */
export function homeProjectsOverlayOffset({
  narrow,
  shiftLimit,
  focusedOffset,
}: {
  narrow: boolean;
  shiftLimit: number;
  focusedOffset: number;
}) {
  return narrow ? clamp(-shiftLimit, shiftLimit, focusedOffset) : 0;
}

export function desktopProjectsTitleCentre({
  sectionHeight,
  headerBottom,
  titleHeight,
}: {
  sectionHeight: number;
  headerBottom: number;
  titleHeight: number;
}) {
  const preferredCentre = sectionHeight * 0.135;
  const safeCentre = headerBottom + PROJECTS_HEADER_GAP + titleHeight / 2;
  return Math.max(preferredCentre, safeCentre);
}

export interface HomeProjectsLayout {
  railBand: number;
  overlayBand: number;
  contentOffset: number;
  topBand: number;
  cardWidth: number;
  cardHeight: number;
  cardTop: number;
  cardBottom: number;
  overlayTop: number;
  railTop: number;
}

/** The vertical contract shared by the WebGL cards and their DOM overlay.
 *
 * Desktop preserves the spacious 1920x1080 composition, then lets height cap
 * the card before the heading, summary or progress rail can collide. Mobile
 * retains its existing compact, counter-aligned layout. */
export function homeProjectsLayout({
  width,
  height,
  narrow,
  cardAspect,
  titleHeight = 0,
  headerBottom = 0,
}: {
  width: number;
  height: number;
  narrow: boolean;
  cardAspect: number;
  titleHeight?: number;
  headerBottom?: number;
}): HomeProjectsLayout {
  const railBand = narrow ? RAIL_BAND.narrow : RAIL_BAND.wide;
  const reservedOverlayBand = clamp(
    OVERLAY_BAND.min,
    OVERLAY_BAND.max,
    height * OVERLAY_BAND.ratio,
  );
  // Move the desktop cards and their fixed details down as one composition.
  // The rail remains fixed, so the detail band yields the same amount of
  // height instead of crossing into the navigation area.
  const contentOffset = narrow ? 0 : clamp(12, 24, height * 0.02);
  const overlayBand = reservedOverlayBand - contentOffset;

  const titleBottom = narrow
    ? 0
    : desktopProjectsTitleCentre({ sectionHeight: height, headerBottom, titleHeight })
      + titleHeight / 2;
  const topBand = narrow
    ? height * 0.16
    : Math.max(height * 0.24, titleBottom + PROJECTS_CONTENT_GAP);
  const availableHeight = Math.max(120, height - topBand - reservedOverlayBand - railBand);
  const cardWidth = Math.min(
    width * (narrow ? 0.86 : 0.62),
    680,
    (availableHeight * 0.98) / cardAspect,
  );
  const cardHeight = cardWidth * cardAspect;
  const cardTop = topBand + (availableHeight - cardHeight) / 2 + contentOffset;
  const cardBottom = cardTop + cardHeight;
  const overlayTop = height - railBand - overlayBand;
  const railTop = height - railBand;

  return {
    railBand,
    overlayBand,
    contentOffset,
    topBand,
    cardWidth,
    cardHeight,
    cardTop,
    cardBottom,
    overlayTop,
    railTop,
  };
}
