import fs from "fs/promises";
import path from "path";
import {
  CMS_REPO_PATHS,
  getCmsPaths,
  SEED_PATHS,
} from "./paths";
import {
  canUseRemoteCmsStorage,
  readRemoteCmsJson,
  writeRemoteCmsJson,
} from "./remote-store";
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

type CmsMemory = Map<string, unknown>;

const globalForCms = globalThis as typeof globalThis & {
  __directtrackCmsMemory?: CmsMemory;
};

function memoryStore(): CmsMemory {
  if (!globalForCms.__directtrackCmsMemory) {
    globalForCms.__directtrackCmsMemory = new Map();
  }
  return globalForCms.__directtrackCmsMemory;
}

function isVercel() {
  return process.env.VERCEL === "1";
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

async function readLocalJsonFile<T>(filePath: string): Promise<T | null> {
  if (!(await fileExists(filePath))) return null;
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

async function writeLocalJsonFile(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function seedLocalFile(cmsPath: string, seedPath: string, fallback: unknown) {
  if (await fileExists(cmsPath)) return;

  const seedContent = await readLocalJsonFile<unknown>(seedPath);
  if (seedContent !== null) {
    await writeLocalJsonFile(cmsPath, seedContent);
    return;
  }

  await writeLocalJsonFile(cmsPath, fallback);
}

async function seedHotspotsLocal(cmsHotspotsDir: string) {
  await ensureDir(cmsHotspotsDir);

  if (isVercel()) {
    for (const [vehicleId, data] of Object.entries(HOTSPOT_SEEDS)) {
      const cmsFile = path.join(cmsHotspotsDir, `${vehicleId}.json`);
      if (!(await fileExists(cmsFile))) {
        await writeLocalJsonFile(cmsFile, data);
      }
    }
    return;
  }

  const seedFiles = await fs.readdir(SEED_PATHS.hotspotsDir);
  for (const file of seedFiles) {
    if (!file.endsWith(".json")) continue;
    const cmsFile = path.join(cmsHotspotsDir, file);
    await seedLocalFile(
      cmsFile,
      path.join(SEED_PATHS.hotspotsDir, file),
      HOTSPOT_SEEDS[file.replace(".json", "")] ?? { hotspots: [] }
    );
  }
}

export async function ensureCMS() {
  if (isVercel() && canUseRemoteCmsStorage()) return;

  const cms = getCmsPaths();
  await seedLocalFile(cms.products, SEED_PATHS.products, productsSeed);
  await seedLocalFile(cms.vehicles, SEED_PATHS.vehicles, vehiclesSeed);
  await seedLocalFile(cms.quoteConfig, SEED_PATHS.quoteConfig, quoteConfigSeed);
  await seedHotspotsLocal(cms.hotspotsDir);
}

async function readCMS<T>(repoPath: string, localPath: string, fallback: T): Promise<T> {
  const cacheKey = repoPath;
  const cached = memoryStore().get(cacheKey);
  if (cached !== undefined) return cached as T;

  if (isVercel()) {
    const remote = await readRemoteCmsJson<T>(repoPath);
    if (remote !== null) {
      memoryStore().set(cacheKey, remote);
      return remote;
    }
  }

  await ensureCMS();

  const local = await readLocalJsonFile<T>(localPath);
  if (local !== null) {
    memoryStore().set(cacheKey, local);
    return local;
  }

  return fallback;
}

async function writeCMS(repoPath: string, localPath: string, data: unknown) {
  memoryStore().set(repoPath, data);

  if (isVercel()) {
    await writeRemoteCmsJson(repoPath, data);
    try {
      await writeLocalJsonFile(localPath, data);
    } catch {
      // Deployed filesystem is read-only on Vercel; remote store is authoritative.
    }
    return;
  }

  await writeLocalJsonFile(localPath, data);
}

export async function readProducts() {
  const cms = getCmsPaths();
  return readCMS<unknown[]>(CMS_REPO_PATHS.products, cms.products, productsSeed);
}

export async function writeProducts(data: unknown[]) {
  const cms = getCmsPaths();
  await writeCMS(CMS_REPO_PATHS.products, cms.products, data);
}

export async function readVehicles() {
  const cms = getCmsPaths();
  return readCMS<unknown[]>(CMS_REPO_PATHS.vehicles, cms.vehicles, vehiclesSeed);
}

export async function writeVehicles(data: unknown[]) {
  const cms = getCmsPaths();
  await writeCMS(CMS_REPO_PATHS.vehicles, cms.vehicles, data);
}

export async function readQuoteConfig() {
  const cms = getCmsPaths();
  return readCMS<Record<string, unknown>>(
    CMS_REPO_PATHS.quoteConfig,
    cms.quoteConfig,
    quoteConfigSeed
  );
}

export async function writeQuoteConfig(data: Record<string, unknown>) {
  const cms = getCmsPaths();
  await writeCMS(CMS_REPO_PATHS.quoteConfig, cms.quoteConfig, data);
}

export async function readHotspots(vehicleId: string) {
  const cms = getCmsPaths();
  const repoPath = CMS_REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(cms.hotspotsDir, `${vehicleId}.json`);
  const fallback = HOTSPOT_SEEDS[vehicleId] ?? { hotspots: [] };
  return readCMS<{ hotspots: unknown[] }>(repoPath, localPath, fallback);
}

export async function writeHotspots(vehicleId: string, data: { hotspots: unknown[] }) {
  const cms = getCmsPaths();
  const repoPath = CMS_REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(cms.hotspotsDir, `${vehicleId}.json`);
  await writeCMS(repoPath, localPath, data);
}

export async function listHotspotVehicles() {
  const cms = getCmsPaths();

  try {
    await ensureCMS();
    const files = await fs.readdir(cms.hotspotsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return Object.keys(HOTSPOT_SEEDS);
  }
}
