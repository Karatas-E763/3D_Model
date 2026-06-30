import { get, put } from "@vercel/blob";

const BLOB_PREFIX = "cms";
const githubShaCache = new Map<string, string>();

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function getBlobToken() {
  return readEnv("BLOB_READ_WRITE_TOKEN");
}

export function canUseBlobStorage() {
  if (getBlobToken()) return true;
  return process.env.VERCEL === "1" && Boolean(readEnv("BLOB_STORE_ID"));
}

export function getBlobReadWriteToken() {
  return getBlobToken();
}

function blobPathnameFor(repoPath: string) {
  return `${BLOB_PREFIX}/${repoPath.replace(/^data\/cms\//, "")}`;
}

function getGitHubConfig() {
  const token = readEnv("GITHUB_TOKEN");
  const owner = readEnv("GITHUB_REPO_OWNER") ?? readEnv("VERCEL_GIT_REPO_OWNER");
  const repo = readEnv("GITHUB_REPO") ?? readEnv("VERCEL_GIT_REPO_SLUG");
  const branch =
    readEnv("GITHUB_BRANCH") ?? readEnv("VERCEL_GIT_COMMIT_REF") ?? "main";

  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch };
}

export function canUseGitHubStorage() {
  return getGitHubConfig() !== null;
}

export function canUseRemoteCmsStorage() {
  return canUseBlobStorage() || canUseGitHubStorage();
}

async function readBlobJson<T>(repoPath: string): Promise<T | null> {
  if (!canUseBlobStorage()) return null;

  const token = getBlobToken();
  const pathname = blobPathnameFor(repoPath);
  const baseOptions = token ? { token } : {};

  for (const access of ["private", "public"] as const) {
    try {
      const result = await get(pathname, { ...baseOptions, access });
      if (result?.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as T;
      }
    } catch {
      // Missing blob or access mismatch — try next mode.
    }
  }

  return null;
}

async function writeBlobJson(repoPath: string, data: unknown) {
  const body = JSON.stringify(data, null, 2);
  const token = getBlobToken();
  const pathname = blobPathnameFor(repoPath);
  const baseOptions = {
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(token ? { token } : {}),
  };

  let lastError: unknown;
  for (const access of ["private", "public"] as const) {
    try {
      await put(pathname, body, { ...baseOptions, access });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo guardar en Vercel Blob");
}

async function readGitHubJson<T>(repoPath: string): Promise<T | null> {
  const config = getGitHubConfig();
  if (!config) return null;

  const url = new URL(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
  );
  url.searchParams.set("ref", config.branch);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const payload = (await res.json()) as { content?: string; sha?: string };
  if (!payload.content || !payload.sha) return null;

  githubShaCache.set(repoPath, payload.sha);
  const text = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return JSON.parse(text) as T;
}

async function writeGitHubJson(repoPath: string, data: unknown) {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error("GitHub no configurado para guardar CMS");
  }

  let sha = githubShaCache.get(repoPath);
  if (!sha) {
    const url = new URL(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`
    );
    url.searchParams.set("ref", config.branch);
    const headRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (headRes.ok) {
      const existing = (await headRes.json()) as { sha?: string };
      sha = existing.sha;
    }
  }

  const content = JSON.stringify(data, null, 2);
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `cms: update ${repoPath}`,
        content: Buffer.from(content, "utf-8").toString("base64"),
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "No se pudo guardar en GitHub");
  }

  const saved = (await res.json()) as { content?: { sha?: string } };
  if (saved.content?.sha) {
    githubShaCache.set(repoPath, saved.content.sha);
  }
}

export async function readRemoteCmsJson<T>(repoPath: string): Promise<T | null> {
  const fromBlob = await readBlobJson<T>(repoPath);
  if (fromBlob !== null) return fromBlob;

  return readGitHubJson<T>(repoPath);
}

export async function writeRemoteCmsJson(repoPath: string, data: unknown) {
  if (canUseBlobStorage()) {
    await writeBlobJson(repoPath, data);
    return;
  }

  if (canUseGitHubStorage()) {
    await writeGitHubJson(repoPath, data);
    return;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "No hay almacenamiento persistente. Conecta Vercel Blob al proyecto o define GITHUB_TOKEN en Vercel."
    );
  }
}
