"use client";

import { useState } from "react";
import type { ResumeInternship } from "@/lib/content/types";

export default function DownloadResumeButton({
  internships,
}: {
  internships: ResumeInternship[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadPdf = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const [{ pdf }, { default: ResumePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./ResumePdfDocument"),
      ]);
      const blob = await pdf(<ResumePdfDocument internships={internships} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Saikiran-Kalluri-Resume.pdf";
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
      aria-label="Download resume as a PDF"
    >
      {isGenerating ? "Preparing PDF…" : "Download as PDF"}
    </button>
  );
}
