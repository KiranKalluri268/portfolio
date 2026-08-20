/** Draws one project card into a 2D canvas, which then becomes a WebGL
 *  texture. The cards are rendered entirely on the GPU in this view, so
 *  everything a card shows — its name, its image, its skill marks — has to be
 *  composed here rather than laid out as DOM. */

/** Two shapes, because one aspect cannot serve both. A phone held upright can
 *  only give a landscape card about a third of its height, which leaves three
 *  cramped cards on screen instead of one to look at. */
/** The height of each is the header, the image panel and the skills strip
 *  added up — so halving the image panel is what makes these shorter than a
 *  card's contents would otherwise ask for.
 *
 *  This is the card itself. The texture is larger, because the glow has to
 *  have somewhere to fall — see GLOW_PAD. */
/** `pad` is the margin left around the card for its glow to fall into. A
 *  texture is clipped at its own edge, so without it the glow would be cut off
 *  square exactly where it should be softest.
 *
 *  `cell` is the projects grid's own shape, and it has no pad because it has no
 *  glow: there a card is not an object lying on a background but one cell of a
 *  continuous surface, so it has to reach its neighbour. It is square because
 *  the surface bends the same amount in both directions, and a landscape cell
 *  made the columns read as stripes rather than as a lattice. The other two
 *  shapes belong to the list view and the home row, where a card really is a
 *  single object with room around it. */
export const CARD_SHAPES = {
  wide: { width: 1200, height: 690, pad: 96 },
  portrait: { width: 900, height: 768, pad: 72 },
  cell: { width: 1000, height: 1000, pad: 0 },
} as const;

export type CardShape = keyof typeof CARD_SHAPES;

/** The full texture for a shape: the card plus its margin on all four sides.
 *  For a grid cell the two are the same rectangle. */
export function textureSizeFor(shape: CardShape) {
  const { width, height, pad } = CARD_SHAPES[shape];
  return { width: width + pad * 2, height: height + pad * 2, pad };
}

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

/** Canvas has no `color-mix`, so a colour taken from the stylesheet is given
 *  its alpha here. Handles the hex forms the grid actually uses. */
function withAlpha(colour: string, alpha: number) {
  const hex = colour.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (long) {
    const [, r, g, b] = long;
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
  }
  if (short) {
    const [, r, g, b] = short;
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, ${alpha})`;
  }
  // Already a functional colour, or something unexpected: let canvas try it,
  // and fall back to a neutral glow rather than drawing nothing.
  return hex || `rgba(255, 255, 255, ${alpha})`;
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
  /** Where the project came from, as a CSS colour. Read off the projects grid
   *  so the two views cannot disagree about what a colour means. */
  originColour: string;
  /** Pixels drawn per layout unit. The layout below is written against a card
   *  filling the screen; the grid draws the same card a third of that size, and
   *  a texture four times the resolution it is ever sampled at is memory an old
   *  phone has to find for detail nobody can see. Defaults to full size. */
  resolution?: number;
}

export function drawCard({
  title,
  role,
  image,
  icons,
  fontFamily,
  shape,
  originColour,
  resolution = 1,
}: CardDrawing) {
  const card = CARD_SHAPES[shape];
  const texture = textureSizeFor(shape);
  const textureWidth = card.width;
  const textureHeight = card.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(texture.width * resolution);
  canvas.height = Math.round(texture.height * resolution);
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  // Everything below is written in layout units; this is the only place the
  // drawn resolution enters, so the layout never has to know about it.
  context.scale(resolution, resolution);

  // Every size below was chosen against the wide card, so the portrait one
  // scales them by its own width rather than repeating the layout.
  const scale = textureWidth / CARD_SHAPES.wide.width;

  // The card is drawn inset by the glow's margin; everything below is written
  // in the card's own coordinates, so the origin moves once here.
  context.translate(texture.pad, texture.pad);

  /** A cell of the grid's surface, rather than a card lying on top of one.
   *  It has no glow to bleed and no rounding, because its edges are the
   *  lattice's own lines and a rounded corner would leave four holes wherever
   *  four cells meet. */
  const membrane = texture.pad === 0;
  const radius = membrane ? 0 : 28 * scale;

  const pad = Math.round(44 * scale);
  const headerHeight = Math.round(150 * scale);
  const stripHeight = Math.round(190 * scale);
  const iconSize = Math.round(54 * scale);
  const imageTop = headerHeight;
  const imageHeight = textureHeight - headerHeight - stripHeight;

  // A wide soft glow in the origin's colour and a tight ring that still reads
  // as an edge when the card is small. Painted before anything else so they sit
  // under the card. A cell has neither: there is no margin for a glow to fall
  // into, and its neighbour is where the glow would have gone.
  if (!membrane) {
    context.save();
    context.shadowColor = withAlpha(originColour, 0.3);
    context.shadowBlur = 40 * scale * 1.46;
    context.fillStyle = "#050505";
    roundedRect(context, 0, 0, textureWidth, textureHeight, radius);
    context.fill();
    context.shadowColor = withAlpha(originColour, 0.22);
    context.shadowBlur = 2 * scale;
    context.fill();
    context.restore();
  }

  context.fillStyle = "#050505";
  roundedRect(context, 0, 0, textureWidth, textureHeight, radius);
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

  // The edge, in the origin's colour, so a white border against a green or
  // orange glow does not read as two different systems.
  //
  // On a cell this line is doing a second job: it is the lattice itself, the
  // only thing drawing the grid's shape as the surface bends. That is why it is
  // heavier and brighter here than on a card, where a glow is already marking
  // the edge and the line only has to be the last of it.
  const edge = membrane ? 3 * scale : 1;
  context.lineWidth = edge;
  context.strokeStyle = withAlpha(originColour, membrane ? 0.55 : 0.35);
  roundedRect(
    context,
    edge / 2,
    edge / 2,
    textureWidth - edge,
    textureHeight - edge,
    radius,
  );
  context.stroke();

  return canvas;
}
