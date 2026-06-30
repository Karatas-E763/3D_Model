import { get, list, put } from "@vercel/blob";
import { getBlobCommandOptions } from "./blob-auth";

export const BLOB_PATHS = {
  products: "cms/products.json",
  vehicles: "cms/vehicles.json",
  quoteConfig: "cms/quote-config.json",
  hotspot: (vehicleId: string) => `cms/hotspots/${vehicleId}.json`,
  hotspotsPrefix: "cms/hotspots/",
} as const;

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

export async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, getBlobCommandOptions());
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const text = await streamToText(result.stream);
  return JSON.parse(text) as T;
}

export async function writeBlobJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data, null, 2), {
    ...getBlobCommandOptions(),
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function listBlobHotspotIds() {
  const result = await list({
    ...getBlobCommandOptions(),
    prefix: BLOB_PATHS.hotspotsPrefix,
  });

  return result.blobs
    .map((blob) =>
      blob.pathname
        .replace(BLOB_PATHS.hotspotsPrefix, "")
        .replace(/\.json$/, "")
    )
    .filter(Boolean);
}
