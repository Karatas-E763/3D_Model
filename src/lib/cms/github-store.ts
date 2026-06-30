interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

let resolvedDefaultBranch: string | null = null;

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function getRepoIdentity(): { owner: string; repo: string } | null {
  const owner =
    readEnv("GITHUB_REPO_OWNER") ?? readEnv("VERCEL_GIT_REPO_OWNER");
  const repo = readEnv("GITHUB_REPO") ?? readEnv("VERCEL_GIT_REPO_SLUG");
  if (!owner || !repo) return null;
  return { owner, repo };
}

export function canUseGitHubStorage() {
  return getGitHubConfig() !== null;
}

export function getGitHubConfig(): GitHubRepoConfig | null {
  const token = readEnv("GITHUB_TOKEN") ?? readEnv("GH_TOKEN");
  if (!token) return null;

  const identity = getRepoIdentity();
  if (!identity) return null;

  return {
    ...identity,
    branch: readEnv("GITHUB_BRANCH") ?? "main",
    token,
  };
}

async function resolveDefaultBranch(config: GitHubRepoConfig): Promise<string> {
  if (readEnv("GITHUB_BRANCH")) {
    return config.branch;
  }

  if (resolvedDefaultBranch) {
    return resolvedDefaultBranch;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}`,
      {
        headers: githubHeaders(config.token),
        cache: "no-store",
      }
    );

    if (res.ok) {
      const meta = (await res.json()) as { default_branch?: string };
      if (meta.default_branch) {
        resolvedDefaultBranch = meta.default_branch;
        return meta.default_branch;
      }
    }
  } catch {
    // Fall back to configured branch.
  }

  resolvedDefaultBranch = config.branch;
  return config.branch;
}

async function getBranch(config: GitHubRepoConfig) {
  return resolveDefaultBranch(config);
}

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

async function readRawGitHubJson<T>(
  owner: string,
  repo: string,
  branch: string,
  repoPath: string
): Promise<T | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoPath}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function readPublicGitHubJson<T>(repoPath: string): Promise<T | null> {
  const identity = getRepoIdentity();
  if (!identity) return null;

  const branch = readEnv("GITHUB_BRANCH") ?? "main";
  return readRawGitHubJson<T>(identity.owner, identity.repo, branch, repoPath);
}

export async function readGitHubJson<T>(repoPath: string): Promise<T | null> {
  const config = getGitHubConfig();
  if (!config) return readPublicGitHubJson<T>(repoPath);

  const branch = await getBranch(config);

  const url = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  url.searchParams.set("ref", branch);

  try {
    const res = await fetch(url, {
      headers: githubHeaders(config.token),
      cache: "no-store",
    });

    if (res.status === 404) {
      return readRawGitHubJson<T>(config.owner, config.repo, branch, repoPath);
    }
    if (!res.ok) {
      return readRawGitHubJson<T>(config.owner, config.repo, branch, repoPath);
    }

    const payload = (await res.json()) as { content?: string };
    if (!payload.content) return null;

    const text = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString(
      "utf-8"
    );
    return JSON.parse(text) as T;
  } catch {
    return readRawGitHubJson<T>(config.owner, config.repo, branch, repoPath);
  }
}

async function dispatchCmsWorkflow(
  config: GitHubRepoConfig,
  repoPath: string,
  data: unknown
) {
  const content_b64 = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString(
    "base64"
  );

  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/dispatches`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(config.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "cms-update",
        client_payload: {
          path: repoPath,
          content_b64,
        },
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "No se pudo encolar la actualización del CMS en GitHub");
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    const verify = await readGitHubJson<unknown>(repoPath);
    if (verify !== null) return;
  }

  throw new Error(
    "La actualización del CMS fue enviada a GitHub Actions pero no pudo verificarse a tiempo"
  );
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

  const branch = await getBranch(config);

  const getUrl = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  getUrl.searchParams.set("ref", branch);

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
        branch,
      }),
      cache: "no-store",
    }
  );

  if (!putRes.ok) {
    const detail = await putRes.text();
    const needsWorkflow =
      putRes.status === 403 ||
      detail.includes("Resource not accessible") ||
      detail.includes("must have push access");

    if (needsWorkflow) {
      await dispatchCmsWorkflow(config, repoPath, data);
      return;
    }

    throw new Error(detail || "No se pudo guardar en GitHub");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const verify = await readGitHubJson<unknown>(repoPath);
    if (verify !== null) return;
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }

  throw new Error("El archivo JSON no pudo verificarse después de guardar en GitHub");
}
