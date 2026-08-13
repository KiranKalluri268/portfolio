import Link from "next/link";
import { listDataFiles } from "@/lib/admin/github";

// Fetches the live file list on every request. Nothing here looks "dynamic"
// to Next's own heuristics (no cookies()/headers() call - the auth check
// happens in middleware), so without this it gets prerendered once at build
// time and every visitor sees whatever the list happened to be then.
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  let files: string[] = [];
  let error: string | null = null;

  try {
    files = await listDataFiles();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to list content files";
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Content admin</h1>
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="text-sm text-white/60 underline underline-offset-2 hover:text-white"
            >
              Log out
            </button>
          </form>
        </div>

        {error && (
          <p className="mb-6 rounded-md border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <ul className="space-y-1">
          {files.map((path) => (
            <li key={path}>
              <Link
                href={`/admin/edit/${path}`}
                className="block rounded-md px-3 py-2 font-mono text-sm hover:bg-white/10"
              >
                {path}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
