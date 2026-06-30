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

function parseRepoSlug(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  return {
    owner: trimmed.slice(0, slash),
    repo: trimmed.slice(slash + 1),
  };
}

export function canUseGitHubStorage() {
  return getGitHubConfig() !== null;
}

export function getGitHubConfig(): GitHubRepoConfig | null {
  const token = readEnv("GITHUB_TOKEN") ?? readEnv("GH_TOKEN");
  if (!token) return null;

  const fromSlug = parseRepoSlug(readEnv("GITHUB_REPO"));

  const owner =
    readEnv("GITHUB_REPO_OWNER") ??
    readEnv("VERCEL_GIT_REPO_OWNER") ??
    fromSlug?.owner;
  const repo =
    readEnv("GITHUB_REPO_NAME") ??
    fromSlug?.repo ??
    readEnv("VERCEL_GIT_REPO_SLUG");

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

async function readGitHubRawJson<T>(
  config: GitHubRepoConfig,
  repoPath: string
): Promise<T | null> {
  const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${repoPath}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

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

    if (res.status === 404) {
      return readGitHubRawJson<T>(config, repoPath);
    }
    if (!res.ok) {
      return readGitHubRawJson<T>(config, repoPath);
    }

    const payload = (await res.json()) as { content?: string };
    if (!payload.content) return null;

    const text = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString(
      "utf-8"
    );
    return JSON.parse(text) as T;
  } catch {
    return readGitHubRawJson<T>(config, repoPath);
  }
}

async function fetchExistingSha(
  config: GitHubRepoConfig,
  repoPath: string
): Promise<string | undefined> {
  const getUrl = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  getUrl.searchParams.set("ref", config.branch);

  const existing = await fetch(getUrl, {
    headers: githubHeaders(config.token),
    cache: "no-store",
  });

  if (!existing.ok) return undefined;

  const meta = (await existing.json()) as { sha?: string };
  return meta.sha;
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

  const content = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString(
    "base64"
  );

  const putUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const sha = await fetchExistingSha(config, repoPath);

    const putRes = await fetch(putUrl, {
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
    });

    if (putRes.ok) return;

    const detail = await putRes.text();
    const isShaConflict = putRes.status === 409 || detail.includes("does not match");
    if (isShaConflict && attempt === 0) continue;

    throw new Error(detail || "No se pudo guardar en GitHub");
  }
}
