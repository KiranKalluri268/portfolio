"use client";

import { useEffect } from "react";

/** The last resort: the root layout itself failed, so it is not there to be
 *  rendered into and neither is anything it provides — no starfield, no header,
 *  no fonts, and no guarantee the stylesheet it imports was ever applied.
 *
 * This renders its own document and styles itself inline for that reason. It
 * should never be seen; if it is, it should still look deliberate. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          The site failed to load
        </h1>
        <p style={{ margin: 0, maxWidth: "26rem", color: "#9ca3af", lineHeight: 1.6 }}>
          Not something you did. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            cursor: "pointer",
            border: "none",
            borderRadius: "999px",
            background: "#fff",
            padding: "0.65rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#000",
          }}
        >
          Reload
        </button>
        {error.digest && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#4b5563" }}>
            Reference {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
