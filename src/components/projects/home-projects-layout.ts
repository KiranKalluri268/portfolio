export const PROJECTS_HEADER_GAP = 16;
export const PROJECTS_CONTENT_GAP = 16;
/** Between the card and the scene dots above it, and between the card and the
 *  heading beside it. */
export const PROJECTS_CARD_CLEARANCE = 24;
/** The widest a desktop card is ever drawn. */
export const PROJECTS_CARD_MAX_WIDTH = 860;
/** Where the settled heading's centre is across the screen on desktop: it moves
 *  -40vw from the middle (projects.tsx), so 10vw from the left edge. */
const SETTLED_TITLE_CENTRE = 0.1;

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
  detailsOffset: number;
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
 * On desktop the settled heading sits at the top left, beside the card rather
 * than above it, so the card may rise to just under the scene dots — as long
 * as it stays clear of the heading sideways. Where that would cost it width
 * (a narrower screen, where the card would reach under the heading), it keeps
 * below the heading instead: whichever of the two gives the taller card. The
 * summary and the progress rail keep their bands below either way. Mobile
 * retains its existing compact, counter-aligned layout. */
export function homeProjectsLayout({
  width,
  height,
  narrow,
  cardAspect,
  titleHeight = 0,
  titleWidth = 0,
  headerBottom = 0,
  navBottom = 0,
}: {
  width: number;
  height: number;
  narrow: boolean;
  cardAspect: number;
  titleHeight?: number;
  titleWidth?: number;
  headerBottom?: number;
  /** The bottom of the scene dots, which sit top-centre on desktop. */
  navBottom?: number;
}): HomeProjectsLayout {
  const railBand = narrow ? RAIL_BAND.narrow : RAIL_BAND.wide;
  const reservedOverlayBand = clamp(
    OVERLAY_BAND.min,
    OVERLAY_BAND.max,
    height * OVERLAY_BAND.ratio,
  );
  // Keep the cards slightly lowered, then give the fixed desktop details
  // additional separation beneath them. The rail remains fixed, so the detail
  // band yields the combined offset instead of crossing the navigation area.
  const contentOffset = narrow ? 0 : clamp(12, 24, height * 0.02);
  const detailsOffset = narrow
    ? 0
    : contentOffset + clamp(28, 48, height * 0.045);
  const overlayBand = reservedOverlayBand - detailsOffset;

  const titleBottom = narrow
    ? 0
    : desktopProjectsTitleCentre({ sectionHeight: height, headerBottom, titleHeight })
      + titleHeight / 2;
  const fit = (top: number, widest: number) => {
    const available = Math.max(120, height - top - reservedOverlayBand - railBand);
    const fitted = Math.min(width * (narrow ? 0.86 : 0.62), widest, (available * 0.98) / cardAspect);
    return { top, available, width: fitted };
  };
  // Below the heading, as it always was.
  const belowTitle = fit(
    narrow ? height * 0.16 : Math.max(height * 0.24, titleBottom + PROJECTS_CONTENT_GAP),
    narrow ? 680 : PROJECTS_CARD_MAX_WIDTH,
  );
  // Up beside it, under the scene dots, no wider than leaves the heading clear.
  const titleRight = width * SETTLED_TITLE_CENTRE + titleWidth / 2;
  const besideTitle = fit(
    Math.max(navBottom, headerBottom * 0.5) + PROJECTS_CARD_CLEARANCE,
    Math.min(PROJECTS_CARD_MAX_WIDTH, width - 2 * (titleRight + PROJECTS_CARD_CLEARANCE)),
  );
  const chosen = narrow || besideTitle.width <= belowTitle.width ? belowTitle : besideTitle;
  const topBand = chosen.top;
  const availableHeight = chosen.available;
  const cardWidth = chosen.width;
  const cardHeight = cardWidth * cardAspect;
  const cardTop = topBand + (availableHeight - cardHeight) / 2 + contentOffset;
  const cardBottom = cardTop + cardHeight;
  const overlayTop = height - railBand - overlayBand;
  const railTop = height - railBand;

  return {
    railBand,
    overlayBand,
    contentOffset,
    detailsOffset,
    topBand,
    cardWidth,
    cardHeight,
    cardTop,
    cardBottom,
    overlayTop,
    railTop,
  };
}
