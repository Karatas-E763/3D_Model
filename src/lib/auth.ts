import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "directtrack_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const DEFAULT_ADMIN_USERNAME = "admins";
const DEFAULT_ADMIN_PASSWORD = "directtrack2024";

const BUILTIN_CREDENTIALS = [
  { username: DEFAULT_ADMIN_USERNAME, password: DEFAULT_ADMIN_PASSWORD },
  { username: "admin", password: DEFAULT_ADMIN_PASSWORD },
  { username: DEFAULT_ADMIN_USERNAME, password: "directtrack2026" },
] as const;

function readEnv(name: string) {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;

  let trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed || undefined;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

function getSecret() {
  return (process.env.AUTH_SECRET ?? "directtrack-dev-secret-change-in-production").trim();
}

function getAllowedCredentials() {
  const seen = new Set<string>();
  const credentials: Array<{ username: string; password: string }> = [];

  const add = (username: string, password: string) => {
    const key = `${username}\0${password}`;
    if (seen.has(key)) return;
    seen.add(key);
    credentials.push({ username, password });
  };

  for (const credential of BUILTIN_CREDENTIALS) {
    add(credential.username, credential.password);
  }

  const envUser = readEnv("ADMIN_USERNAME");
  const envPass = readEnv("ADMIN_PASSWORD");
  if (envUser && envPass) {
    add(envUser, envPass);
  }

  return credentials;
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function createToken(username: string) {
  const expires = Date.now() + SESSION_TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const body = `${username}:${expires}:${nonce}`;
  return `${body}.${sign(body)}`;
}

function verifyToken(token: string): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }
  const [username, expiresStr] = body.split(":");
  const expires = Number(expiresStr);
  if (!username || !expires || Date.now() > expires) return null;
  return username;
}

export function validateCredentials(username: string, password: string) {
  const normalizedUser = username.trim();
  const normalizedPass = password.trim();
  if (!normalizedUser || !normalizedPass) return false;

  return getAllowedCredentials().some(
    (credential) =>
      safeEqual(normalizedUser, credential.username) &&
      safeEqual(normalizedPass, credential.password)
  );
}

export function createSessionToken(username: string) {
  return createToken(username.trim());
}

export function applySessionCookie(response: NextResponse, username: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions());
  return response;
}

export async function createSession(username: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions());
}

export function clearSessionOnResponse(response: NextResponse) {
  const options = sessionCookieOptions();
  response.cookies.delete({ name: SESSION_COOKIE, path: options.path });
  response.cookies.set(SESSION_COOKIE, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const options = sessionCookieOptions();
  cookieStore.delete({ name: SESSION_COOKIE, path: options.path });
  cookieStore.set(SESSION_COOKIE, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSessionUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
