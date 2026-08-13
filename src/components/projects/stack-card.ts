/** Draws one project card into a 2D canvas, which then becomes a WebGL
 *  texture. The cards are rendered entirely on the GPU in this view, so
 *  everything a card shows — its name, its image, its skill marks — has to be
 *  composed here rather than laid out as DOM. */

/** Two shapes, because one aspect cannot serve both. A phone held upright can
 *  only give a landscape card about a third of its height, which leaves three
 *  cramped cards on screen instead of one to look at. */
/** The height of each is the header, the image panel and the skills strip
 *  added up — so halving the image panel is what makes these shorter than a
 *  card's contents would otherwise ask for. */
export const CARD_SHAPES = {
  wide: { width: 1200, height: 690 },
  portrait: { width: 900, height: 768 },
} as const;

export type CardShape = keyof typeof CARD_SHAPES;

/** Derives a short monogram from the title, matching ProjectThumbnail's own
 *  fallback so a project without a screenshot reads the same in both views. */
export function monogram(title: string) {
  const words = title
    .replace(/[–—-].*$/, "")
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word));
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/** Fills the rect with the image cropped to cover it, the canvas equivalent of
 *  `object-fit: cover`. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

/** The generated panel for work with no shareable screenshot — the same warm
 *  monogram ProjectThumbnail draws, so the grid and this view agree. */
function drawMonogramPanel(
  context: CanvasRenderingContext2D,
  title: string,
  role: string,
  fontFamily: string,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  const warm = context.createRadialGradient(
    x + width * 0.3,
    y + height * 0.25,
    0,
    x + width * 0.3,
    y + height * 0.25,
    width * 0.75,
  );
  warm.addColorStop(0, "rgba(224,69,10,0.28)");
  warm.addColorStop(1, "rgba(224,69,10,0)");
  context.fillStyle = "#0b0b0b";
  context.fillRect(x, y, width, height);
  context.fillStyle = warm;
  context.fillRect(x, y, width, height);

  context.textAlign = "center";
  context.fillStyle = "rgba(255,255,255,0.85)";
  context.font = `700 ${Math.round(132 * scale)}px ${fontFamily}`;
  context.fillText(monogram(title), x + width / 2, y + height / 2 + 20 * scale);

  context.fillStyle = "rgba(255,255,255,0.4)";
  context.font = `600 ${Math.round(30 * scale)}px ${fontFamily}`;
  context.fillText(role.toUpperCase(), x + width / 2, y + height / 2 + 90 * scale);
  context.textAlign = "left";
}

export interface CardDrawing {
  title: string;
  role: string;
  image: HTMLImageElement | null;
  icons: HTMLImageElement[];
  fontFamily: string;
  shape: CardShape;
}

export function drawCard({ title, role, image, icons, fontFamily, shape }: CardDrawing) {
  const { width: textureWidth, height: textureHeight } = CARD_SHAPES[shape];

  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  // Every size below was chosen against the wide card, so the portrait one
  // scales them by its own width rather than repeating the layout.
  const scale = textureWidth / CARD_SHAPES.wide.width;

  const pad = Math.round(44 * scale);
  const headerHeight = Math.round(150 * scale);
  const stripHeight = Math.round(190 * scale);
  const iconSize = Math.round(54 * scale);
  const imageTop = headerHeight;
  const imageHeight = textureHeight - headerHeight - stripHeight;

  context.fillStyle = "#050505";
  roundedRect(context, 0, 0, textureWidth, textureHeight, 28 * scale);
  context.fill();

  // Project name, top-left, as drawn in the layout sketch.
  context.fillStyle = "#ffffff";
  context.font = `700 ${Math.round(54 * scale)}px ${fontFamily}`;
  context.textBaseline = "middle";
  const name = title.replace(/\s*[–—-]\s.*$/, "");
  context.fillText(name, pad, headerHeight / 2 + 8 * scale);

  // The image panel.
  context.save();
  roundedRect(context, pad, imageTop, textureWidth - pad * 2, imageHeight, 16 * scale);
  context.clip();
  if (image) {
    drawCover(context, image, pad, imageTop, textureWidth - pad * 2, imageHeight);
  } else {
    drawMonogramPanel(
      context,
      title,
      role,
      fontFamily,
      pad,
      imageTop,
      textureWidth - pad * 2,
      imageHeight,
      scale,
    );
  }
  context.restore();

  // The skills strip along the bottom.
  const stripTop = imageTop + imageHeight + Math.round(34 * scale);
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pad, stripTop);
  context.lineTo(textureWidth - pad, stripTop);
  context.stroke();

  let iconX = pad;
  const iconY = stripTop + Math.round(44 * scale);
  for (const icon of icons) {
    if (iconX + iconSize > textureWidth - pad) break;
    context.drawImage(icon, iconX, iconY, iconSize, iconSize);
    iconX += iconSize + Math.round(26 * scale);
  }

  context.strokeStyle = "rgba(255,255,255,0.14)";
  roundedRect(context, 0.5, 0.5, textureWidth - 1, textureHeight - 1, 28 * scale);
  context.stroke();

  return canvas;
}
