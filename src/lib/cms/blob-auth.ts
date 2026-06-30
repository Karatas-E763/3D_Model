function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function getBlobReadWriteToken() {
  return readEnv("BLOB_READ_WRITE_TOKEN");
}

export function getBlobStoreId() {
  return readEnv("BLOB_STORE_ID");
}

/** True when @vercel/blob can authenticate (token or Vercel OIDC + store id). */
export function canUseBlobStorage() {
  if (getBlobReadWriteToken()) return true;
  return process.env.VERCEL === "1" && Boolean(getBlobStoreId());
}

export function getKvRestConfig() {
  const url = readEnv("UPSTASH_REDIS_REST_URL") ?? readEnv("KV_REST_API_URL");
  const token =
    readEnv("UPSTASH_REDIS_REST_TOKEN") ?? readEnv("KV_REST_API_TOKEN");
  if (!url || !token) return null;
  return { url, token };
}

export function canUseKvStorage() {
  return getKvRestConfig() !== null;
}

export function canUseCloudCmsStorage() {
  return canUseBlobStorage() || canUseKvStorage();
}

export function cmsStorageUnavailableMessage() {
  return "Almacenamiento persistente no configurado. En Vercel: Storage → Blob (o Upstash Redis) → Connect to Project, luego redeploy.";
}
