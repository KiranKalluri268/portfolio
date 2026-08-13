import { getDataFile } from "@/lib/admin/github";
import AdminEditorForm from "./AdminEditorForm";

// Always fetches the live file content on request, same reasoning as /admin.
export const dynamic = "force-dynamic";

export default async function AdminEditPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const relativePath = path.join("/");

  let content: string | null = null;
  let error: string | null = null;

  try {
    const file = await getDataFile(relativePath);
    // Re-formatted rather than shown raw, so a previous commit's exact
    // whitespace doesn't matter and every edit starts from the same layout.
    content = JSON.stringify(JSON.parse(file.content), null, 2);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load file";
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 font-mono text-lg font-bold">{relativePath}</h1>
        <p className="mb-6 text-sm text-white/60">Editing src/data/{relativePath} on main</p>

        {error ? (
          <p className="rounded-md border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-300">
            {error}
          </p>
        ) : (
          <AdminEditorForm relativePath={relativePath} initialContent={content ?? ""} />
        )}
      </div>
    </main>
  );
}
