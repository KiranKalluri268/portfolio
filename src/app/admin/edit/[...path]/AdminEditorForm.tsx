"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "done"; pullRequestUrl: string };

export default function AdminEditorForm({
  relativePath,
  initialContent,
}: {
  relativePath: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "submitting" });

    const response = await fetch("/api/admin/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath, content, message }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus({ kind: "error", message: body.error ?? "Failed to commit" });
      return;
    }

    setStatus({ kind: "done", pullRequestUrl: body.pullRequestUrl });
  };

  if (status.kind === "done") {
    return (
      <div className="rounded-md border border-green-400/40 bg-green-400/10 p-4 text-sm text-green-300">
        Committed. <a href={status.pullRequestUrl} target="_blank" rel="noopener noreferrer" className="underline">Open the pull request →</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        className="h-[60vh] w-full rounded-md border border-white/20 bg-white/5 p-4 font-mono text-xs text-white outline-none focus:border-accent"
      />
      <input
        type="text"
        required
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What changed? (becomes the commit message)"
        className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-2 text-white outline-none focus:border-accent"
      />
      {status.kind === "error" && (
        <p className="rounded-md border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-300 whitespace-pre-wrap">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="rounded-md bg-white px-5 py-2 font-semibold text-black disabled:opacity-50"
      >
        {status.kind === "submitting" ? "Committing…" : "Commit change"}
      </button>
    </form>
  );
}
