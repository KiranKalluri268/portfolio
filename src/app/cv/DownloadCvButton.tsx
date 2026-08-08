"use client";

import { useState } from "react";
import type { CvData } from "@/lib/content/types";

export default function DownloadCvButton({ cv }: { cv: CvData }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadPdf = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      // Kept out of the initial bundle: the PDF renderer is large and only
      // needed once someone actually asks for the download.
      const [{ pdf }, { default: CvPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./CvPdfDocument"),
      ]);
      const blob = await pdf(<CvPdfDocument cv={cv} />).toBlob();
      // Safari's built-in PDF viewer intercepts application/pdf blobs and
      // opens them inline instead of honouring the `download` attribute.
      // Re-typing as generic binary stops it recognising the blob as a
      // previewable PDF; the .pdf extension below still names the saved file.
      const downloadBlob = new Blob([blob], { type: "application/octet-stream" });
      const url = URL.createObjectURL(downloadBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Saikiran-Kalluri-CV.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={isGenerating}
      className="shrink-0 whitespace-nowrap rounded-md bg-white px-3 py-2 text-xs font-semibold text-black shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100 sm:px-5 sm:py-2.5 sm:text-sm"
      aria-label="Download CV as a PDF"
    >
      {isGenerating ? "Preparing PDF…" : "Download as PDF"}
    </button>
  );
}
