import "server-only";

/** Commits a content edit to a new branch via GitHub's API, since the
 *  deployed function has no persistent git checkout to run `git commit`
 *  against - only a token and the REST API.
 *
 *  Uses the Git Data API (blob -> tree -> commit -> ref) rather than the
 *  simpler one-call Contents API, so the result is one real commit with the
 *  message the change was given, not an auto-generated one.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function repoOwner(): string {
  return process.env.GITHUB_REPO_OWNER ?? "KiranKalluri268";
}

function repoName(): string {
  return process.env.GITHUB_REPO_NAME ?? "portfolio";
}

function baseBranch(): string {
  return process.env.GITHUB_BASE_BRANCH ?? "main";
}

async function githubFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env("GITHUB_ADMIN_TOKEN")}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub API ${init.method ?? "GET"} ${path} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export interface FetchedFile {
  content: string;
  /** True once a JSON parse of `content` has actually been attempted by the
   *  caller - this type doesn't guarantee it, it's just where the raw text
   *  the editor will show comes from. */
  sha: string;
}

/** The current content of a file under `src/data/`, read from `branch`
 *  directly rather than from whatever happens to be bundled in the running
 *  deployment, so editing is always against the real latest content. */
export async function getDataFile(relativePath: string, branch = baseBranch()): Promise<FetchedFile> {
  const result = (await githubFetch(
    `/repos/${repoOwner()}/${repoName()}/contents/src/data/${relativePath}?ref=${encodeURIComponent(branch)}`,
  )) as { content: string; encoding: string; sha: string };

  if (result.encoding !== "base64") {
    throw new Error(`${relativePath}: unexpected encoding "${result.encoding}" from GitHub`);
  }

  return {
    content: Buffer.from(result.content, "base64").toString("utf8"),
    sha: result.sha,
  };
}

/** One entry per subdirectory or single file under `src/data/`, listed live
 *  from the base branch so a file added since the last deploy still shows up. */
export async function listDataFiles(): Promise<string[]> {
  async function listDir(dir: string): Promise<string[]> {
    const entries = (await githubFetch(
      `/repos/${repoOwner()}/${repoName()}/contents/src/data/${dir}?ref=${encodeURIComponent(baseBranch())}`,
    )) as Array<{ name: string; type: "file" | "dir" }>;

    const files: string[] = [];
    for (const entry of entries) {
      if (entry.type === "file" && entry.name.endsWith(".json")) {
        files.push(dir ? `${dir}/${entry.name}` : entry.name);
      }
    }
    return files;
  }

  const root = (await githubFetch(
    `/repos/${repoOwner()}/${repoName()}/contents/src/data?ref=${encodeURIComponent(baseBranch())}`,
  )) as Array<{ name: string; type: "file" | "dir" }>;

  const paths: string[] = [];
  for (const entry of root) {
    if (entry.type === "file" && entry.name.endsWith(".json")) {
      paths.push(entry.name);
    } else if (entry.type === "dir") {
      paths.push(...(await listDir(entry.name)));
    }
  }
  return paths.sort();
}

function slugifyForBranch(message: string): string {
  const slug = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "update";
}

export interface CommitResult {
  branchName: string;
  commitUrl: string;
  pullRequestUrl: string;
}

/** Commits a single file's new content to a fresh branch off the base branch,
 *  named from `message`, and opens a pull request for it. The base branch
 *  itself is never written to directly. */
export async function commitContentChange({
  relativePath,
  content,
  message,
}: {
  relativePath: string;
  content: string;
  message: string;
}): Promise<CommitResult> {
  const owner = repoOwner();
  const repo = repoName();
  const base = baseBranch();

  const baseRef = (await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${base}`)) as {
    object: { sha: string };
  };
  const baseCommitSha = baseRef.object.sha;

  const baseCommit = (await githubFetch(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`)) as {
    tree: { sha: string };
  };

  const blob = (await githubFetch(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  })) as { sha: string };

  const tree = (await githubFetch(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [
        {
          path: `src/data/${relativePath}`,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        },
      ],
    }),
  })) as { sha: string };

  const commit = (await githubFetch(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  })) as { sha: string; html_url: string };

  // Collisions are unlikely but not impossible with two edits sharing a
  // name in the same run - a short suffix from the commit sha keeps the
  // branch name unique without needing to check for an existing ref first.
  const branchName = `content/${slugifyForBranch(message)}-${commit.sha.slice(0, 7)}`;

  await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: commit.sha,
    }),
  });

  const pullRequest = (await githubFetch(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: message,
      head: branchName,
      base,
      body: "Opened by the content admin tool.",
    }),
  })) as { html_url: string };

  return {
    branchName,
    commitUrl: commit.html_url,
    pullRequestUrl: pullRequest.html_url,
  };
}
