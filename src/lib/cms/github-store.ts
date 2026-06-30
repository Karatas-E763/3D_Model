interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function canUseGitHubStorage() {
  return getGitHubConfig() !== null;
}

export function getGitHubConfig(): GitHubRepoConfig | null {
  const token = readEnv("GITHUB_TOKEN") ?? readEnv("GH_TOKEN");
  if (!token) return null;

  const owner =
    readEnv("GITHUB_REPO_OWNER") ?? readEnv("VERCEL_GIT_REPO_OWNER");
  const repo = readEnv("GITHUB_REPO") ?? readEnv("VERCEL_GIT_REPO_SLUG");
  const branch =
    readEnv("GITHUB_BRANCH") ??
    readEnv("VERCEL_GIT_COMMIT_REF") ??
    "main";

  if (!owner || !repo) return null;

  return { owner, repo, branch, token };
}

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

export async function readGitHubJson<T>(repoPath: string): Promise<T | null> {
  const config = getGitHubConfig();
  if (!config) return null;

  const url = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  url.searchParams.set("ref", config.branch);

  try {
    const res = await fetch(url, {
      headers: githubHeaders(config.token),
      cache: "no-store",
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const payload = (await res.json()) as { content?: string };
    if (!payload.content) return null;

    const text = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString(
      "utf-8"
    );
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeGitHubJson(
  repoPath: string,
  data: unknown,
  message: string
) {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("GitHub token no configurado");
  }

  const getUrl = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  getUrl.searchParams.set("ref", config.branch);

  let sha: string | undefined;
  const existing = await fetch(getUrl, {
    headers: githubHeaders(config.token),
    cache: "no-store",
  });

  if (existing.ok) {
    const meta = (await existing.json()) as { sha?: string };
    sha = meta.sha;
  }

  const content = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString(
    "base64"
  );

  const putRes = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`,
    {
      method: "PUT",
      headers: {
        ...githubHeaders(config.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content,
        sha,
        branch: config.branch,
      }),
      cache: "no-store",
    }
  );

  if (!putRes.ok) {
    const detail = await putRes.text();
    throw new Error(detail || "No se pudo guardar en GitHub");
  }
}
