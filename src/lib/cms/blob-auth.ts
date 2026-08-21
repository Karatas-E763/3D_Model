function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function canUseBlobStorage() {
  if (readEnv("BLOB_READ_WRITE_TOKEN")) return true;
  if (process.env.VERCEL === "1" && readEnv("BLOB_STORE_ID")) return true;
  return false;
}

export function getBlobCommandOptions() {
  const token = readEnv("BLOB_READ_WRITE_TOKEN");
  const storeId = readEnv("BLOB_STORE_ID");
  const oidcToken = readEnv("VERCEL_OIDC_TOKEN");

  if (token) {
    return { access: "private" as const, token };
  }

  if (storeId && oidcToken) {
    return { access: "private" as const, storeId, oidcToken };
  }

  if (storeId) {
    return { access: "private" as const, storeId };
  }

  return { access: "private" as const };
}
