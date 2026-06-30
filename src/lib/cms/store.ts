import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { CMS_PATHS, CMS_ROOT, SEED_PATHS } from "./paths";
import {
  canUseBlobStorage,
  canUseCloudCmsStorage,
  canUseKvStorage,
  cmsStorageUnavailableMessage,
  getBlobReadWriteToken,
  getKvRestConfig,
} from "./blob-auth";
import productsSeed from "@/data/products/products.json";
import vehiclesSeed from "@/data/vehicles/vehicles.json";
import quoteConfigSeed from "@/data/quote-config.json";
import transporteCargaHotspots from "@/data/hotspots/transporte-carga.json";
import transportePasajerosHotspots from "@/data/hotspots/transporte-pasajeros.json";
import vehiculosLigerosHotspots from "@/data/hotspots/vehiculos-ligeros.json";
import maquinariaPesadaHotspots from "@/data/hotspots/maquinaria-pesada.json";
import equiposManejoHotspots from "@/data/hotspots/equipos-manejo.json";
import motocicletasHotspots from "@/data/hotspots/motocicletas.json";
import unidadesEspecializadasHotspots from "@/data/hotspots/unidades-especializadas.json";
import activosSinMotorHotspots from "@/data/hotspots/activos-sin-motor.json";
import solucionesEspecialesHotspots from "@/data/hotspots/soluciones-especiales.json";

const BLOB_CMS_PREFIX = "cms";

const HOTSPOT_SEEDS: Record<string, { hotspots: unknown[] }> = {
  "transporte-carga": transporteCargaHotspots,
  "transporte-pasajeros": transportePasajerosHotspots,
  "vehiculos-ligeros": vehiculosLigerosHotspots,
  "maquinaria-pesada": maquinariaPesadaHotspots,
  "equipos-manejo": equiposManejoHotspots,
  motocicletas: motocicletasHotspots,
  "unidades-especializadas": unidadesEspecializadasHotspots,
  "activos-sin-motor": activosSinMotorHotspots,
  "soluciones-especiales": solucionesEspecialesHotspots,
};

function storageKeyFor(filePath: string) {
  const relative = path.relative(CMS_ROOT, filePath).replace(/\\/g, "/");
  return `${BLOB_CMS_PREFIX}/${relative}`;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath: string) {
  if (!(await fileExists(filePath))) return null;
  return fs.readFile(filePath, "utf-8");
}

async function readKvJson<T>(key: string): Promise<T | null> {
  const config = getKvRestConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { result?: string | null };
    if (!payload.result) return null;
    return JSON.parse(payload.result) as T;
  } catch {
    return null;
  }
}

async function writeKvJson(key: string, data: unknown) {
  const config = getKvRestConfig();
  if (!config) {
    throw new Error(cmsStorageUnavailableMessage());
  }

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(data, null, 2)]),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "No se pudo guardar en Upstash Redis");
  }
}

async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const token = getBlobReadWriteToken();
  const baseOptions = token ? { token } : {};

  for (const access of ["private", "public"] as const) {
    try {
      const result = await get(pathname, { ...baseOptions, access });
      if (result?.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as T;
      }
    } catch {
      // Try the other access mode or treat as missing.
    }
  }
  return null;
}

async function writeBlobJson(pathname: string, data: unknown) {
  const body = JSON.stringify(data, null, 2);
  const token = getBlobReadWriteToken();
  const baseOptions = {
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(token ? { token } : {}),
  };

  const errors: unknown[] = [];
  for (const access of ["private", "public"] as const) {
    try {
      await put(pathname, body, { ...baseOptions, access });
      return;
    } catch (error) {
      errors.push(error);
    }
  }

  const last = errors[errors.length - 1];
  if (last instanceof Error) {
    throw last;
  }
  throw new Error("No se pudo guardar en Vercel Blob");
}

async function seedFile(cmsPath: string, seedPath: string) {
  await ensureDir(path.dirname(cmsPath));
  if (!(await fileExists(cmsPath))) {
    const content = await fs.readFile(seedPath, "utf-8");
    await fs.writeFile(cmsPath, content, "utf-8");
  }
}

async function seedHotspots() {
  await ensureDir(CMS_PATHS.hotspotsDir);
  const seedFiles = await fs.readdir(SEED_PATHS.hotspotsDir);
  for (const file of seedFiles) {
    if (!file.endsWith(".json")) continue;
    const cmsFile = path.join(CMS_PATHS.hotspotsDir, file);
    if (!(await fileExists(cmsFile))) {
      const content = await fs.readFile(
        path.join(SEED_PATHS.hotspotsDir, file),
        "utf-8"
      );
      await fs.writeFile(cmsFile, content, "utf-8");
    }
  }
}

export async function ensureCMS() {
  if (canUseCloudCmsStorage()) return;
  await seedFile(CMS_PATHS.products, SEED_PATHS.products);
  await seedFile(CMS_PATHS.vehicles, SEED_PATHS.vehicles);
  await seedFile(CMS_PATHS.quoteConfig, SEED_PATHS.quoteConfig);
  await seedHotspots();
}

async function readFromCloud<T>(key: string): Promise<T | null> {
  if (canUseBlobStorage()) {
    const fromBlob = await readBlobJson<T>(key);
    if (fromBlob !== null) return fromBlob;
  }
  if (canUseKvStorage()) {
    return readKvJson<T>(key);
  }
  return null;
}

async function writeToCloud(key: string, data: unknown) {
  if (canUseBlobStorage()) {
    await writeBlobJson(key, data);
    return;
  }
  if (canUseKvStorage()) {
    await writeKvJson(key, data);
    return;
  }
  if (process.env.VERCEL === "1") {
    throw new Error(cmsStorageUnavailableMessage());
  }
}

export async function readCMS<T>(filePath: string, fallback: T): Promise<T> {
  const key = storageKeyFor(filePath);
  const fromCloud = await readFromCloud<T>(key);
  if (fromCloud !== null) return fromCloud;

  try {
    await ensureCMS();
    const content = await readFileIfExists(filePath);
    if (content) return JSON.parse(content) as T;
  } catch {
    // Seeding can fail on read-only serverless filesystems.
  }

  return fallback;
}

export async function writeCMS(filePath: string, data: unknown) {
  const key = storageKeyFor(filePath);

  if (canUseCloudCmsStorage()) {
    await writeToCloud(key, data);
    return;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(cmsStorageUnavailableMessage());
  }

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function readProducts() {
  return readCMS<unknown[]>(CMS_PATHS.products, productsSeed);
}

export async function writeProducts(data: unknown[]) {
  await writeCMS(CMS_PATHS.products, data);
}

export async function readVehicles() {
  return readCMS<unknown[]>(CMS_PATHS.vehicles, vehiclesSeed);
}

export async function writeVehicles(data: unknown[]) {
  await writeCMS(CMS_PATHS.vehicles, data);
}

export async function readQuoteConfig() {
  return readCMS<Record<string, unknown>>(CMS_PATHS.quoteConfig, quoteConfigSeed);
}

export async function writeQuoteConfig(data: Record<string, unknown>) {
  await writeCMS(CMS_PATHS.quoteConfig, data);
}

export async function readHotspots(vehicleId: string) {
  const filePath = path.join(CMS_PATHS.hotspotsDir, `${vehicleId}.json`);
  const fallback = HOTSPOT_SEEDS[vehicleId] ?? { hotspots: [] };
  const key = storageKeyFor(filePath);

  const fromCloud = await readFromCloud<{ hotspots: unknown[] }>(key);
  if (fromCloud !== null) return fromCloud;

  try {
    await ensureCMS();
    const content = await readFileIfExists(filePath);
    if (content) return JSON.parse(content) as { hotspots: unknown[] };
  } catch {
    // Ignore read-only filesystem errors on serverless.
  }

  const seedPath = path.join(SEED_PATHS.hotspotsDir, `${vehicleId}.json`);
  const seedContent = await readFileIfExists(seedPath);
  if (seedContent) return JSON.parse(seedContent) as { hotspots: unknown[] };

  return fallback;
}

export async function writeHotspots(vehicleId: string, data: { hotspots: unknown[] }) {
  await writeCMS(path.join(CMS_PATHS.hotspotsDir, `${vehicleId}.json`), data);
}

export async function listHotspotVehicles() {
  if (canUseCloudCmsStorage()) {
    return Object.keys(HOTSPOT_SEEDS);
  }

  try {
    await ensureCMS();
    const files = await fs.readdir(CMS_PATHS.hotspotsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return Object.keys(HOTSPOT_SEEDS);
  }
}
