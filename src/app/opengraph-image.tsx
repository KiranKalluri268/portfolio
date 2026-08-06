import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

const STAR_COLORS = ["255,255,255", "255,233,196", "212,251,255"] as const;

function createStars(count: number) {
  let seed = 268;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, (_, index) => {
    const flare = index > 0 && index % 17 === 0;
    return {
      x: Math.round(12 + random() * 1176),
      y: Math.round(10 + random() * 610),
      radius: flare ? 1.6 + random() * 0.5 : 0.65 + random() * 0.85,
      alpha: 0.32 + random() * 0.62,
      color: STAR_COLORS[Math.floor(random() * STAR_COLORS.length)],
      flare,
    };
  });
}

const stars = createStars(58);

export const alt = "Saikiran Kalluri — Software Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  // Everything this card needs comes off disk. The black hole used to be
  // fetched from the deployed site, which made building the next deploy depend
  // on the last one being up and failed outright anywhere without outbound
  // network — including CI, where the build logged
  // "Can't load image ... Unsupported image type: unknown" on every run and
  // produced the card without its background.
  const [regularBuffer, boldBuffer, blackHoleBuffer] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "tektur-regular.ttf")),
    readFile(path.join(process.cwd(), "public", "fonts", "tektur-bold.ttf")),
    readFile(path.join(process.cwd(), "public", "images", "blackhole.png")),
  ]);
  const blackHole = `data:image/png;base64,${blackHoleBuffer.toString("base64")}`;
  const regular = regularBuffer.buffer.slice(
    regularBuffer.byteOffset,
    regularBuffer.byteOffset + regularBuffer.byteLength,
  ) as ArrayBuffer;
  const bold = boldBuffer.buffer.slice(
    boldBuffer.byteOffset,
    boldBuffer.byteOffset + boldBuffer.byteLength,
  ) as ArrayBuffer;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#000000",
          color: "white",
          padding: "68px 76px",
          fontFamily: "Tektur",
        }}
      >
        {stars.map(({ x, y, radius, alpha, color, flare }, index) => (
          <div
            key={`${x}-${y}-${index}`}
            style={{
              position: "absolute",
              left: flare ? x - 9 : x,
              top: flare ? y - 9 : y,
              width: flare ? 18 : radius * 2,
              height: flare ? 18 : radius * 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {flare ? (
              <div
                style={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, rgba(${color},${alpha}) 0%, rgba(${color},${alpha * 0.5}) 12%, rgba(${color},0.12) 34%, rgba(${color},0) 72%)`,
                }}
              />
            ) : (
              <div
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  display: "flex",
                  borderRadius: "50%",
                  background: `rgba(${color},${alpha})`,
                  boxShadow: radius > 1.2 ? `0 0 ${radius * 2}px rgba(${color},0.28)` : "none",
                }}
              />
            )}
          </div>
        ))}

        <div
          style={{
            position: "absolute",
            right: -54,
            top: 154,
            width: 650,
            height: 362,
            display: "flex",
            opacity: 0.95,
            filter: "drop-shadow(0 0 30px rgba(249,115,22,0.3))",
          }}
        >
          <img
            src={blackHole}
            alt=""
            width="650"
            height="362"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(2,2,5,0.98) 0%, rgba(2,2,5,0.9) 48%, rgba(2,2,5,0.05) 76%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 66,
              height: 54,
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 10,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -1,
              boxShadow: "0 0 20px rgba(224,69,10,0.25)",
            }}
          >
            KS
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
              Saikiran Kalluri
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#ffb27a", letterSpacing: 0.3 }}>
              Software Engineer · Full-stack · AI · Cloud
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", fontSize: 22, color: "#a3a3a3" }}>
            <div style={{ width: 30, height: 2, marginRight: 14, background: "#e0450a" }} />
            saikirankalluri.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Tektur", data: regular, weight: 400, style: "normal" },
        { name: "Tektur", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
