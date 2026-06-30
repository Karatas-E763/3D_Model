import fs from "fs/promises";
import path from "path";
import {
  getCmsPaths,
  getDeployedCmsPaths,
  SEED_PATHS,
} from "./paths";
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

function memoryKey(filePath: string) {
  return filePath.replace(/\\/g, "/");
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

async function writeJsonFile(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  memoryStore().set(memoryKey(filePath), data);
}

async function seedFile(cmsPath: string, seedPath: string) {
  if (await fileExists(cmsPath)) return;
  const seedContent = await readFileIfExists(seedPath);
  if (seedContent) {
    await writeJsonFile(cmsPath, JSON.parse(seedContent) as unknown);
    return;
  }
}

async function seedFromFallback(cmsPath: string, fallback: unknown) {
  if (await fileExists(cmsPath)) return;
  await writeJsonFile(cmsPath, fallback);
}

async function seedHotspots(cmsHotspotsDir: string) {
  await ensureDir(cmsHotspotsDir);

  if (process.env.VERCEL === "1") {
    for (const [vehicleId, data] of Object.entries(HOTSPOT_SEEDS)) {
      const cmsFile = path.join(cmsHotspotsDir, `${vehicleId}.json`);
      await seedFromFallback(cmsFile, data);
    }
    return;
  }

  const seedFiles = await fs.readdir(SEED_PATHS.hotspotsDir);
  for (const file of seedFiles) {
    if (!file.endsWith(".json")) continue;
    const cmsFile = path.join(cmsHotspotsDir, file);
    await seedFile(cmsFile, path.join(SEED_PATHS.hotspotsDir, file));
  }
}

async function seedFromDeployedCopy(cmsPath: string, deployedPath: string) {
  if (await fileExists(cmsPath)) return;
  const deployedContent = await readFileIfExists(deployedPath);
  if (deployedContent) {
    await writeJsonFile(cmsPath, JSON.parse(deployedContent) as unknown);
  }
}

export async function ensureCMS() {
  const cms = getCmsPaths();
  const deployed = getDeployedCmsPaths();

  if (process.env.VERCEL === "1") {
    await seedFromDeployedCopy(cms.products, deployed.products);
    await seedFromDeployedCopy(cms.vehicles, deployed.vehicles);
    await seedFromDeployedCopy(cms.quoteConfig, deployed.quoteConfig);

    await seedFromFallback(cms.products, productsSeed);
    await seedFromFallback(cms.vehicles, vehiclesSeed);
    await seedFromFallback(cms.quoteConfig, quoteConfigSeed);
    await seedHotspots(cms.hotspotsDir);
    return;
  }

  await seedFile(cms.products, SEED_PATHS.products);
  await seedFile(cms.vehicles, SEED_PATHS.vehicles);
  await seedFile(cms.quoteConfig, SEED_PATHS.quoteConfig);
  await seedHotspots(cms.hotspotsDir);
}

export async function readCMS<T>(filePath: string, fallback: T): Promise<T> {
  const key = memoryKey(filePath);
  const cached = memoryStore().get(key);
  if (cached !== undefined) return cached as T;

  await ensureCMS();

  const content = await readFileIfExists(filePath);
  if (content) {
    const parsed = JSON.parse(content) as T;
    memoryStore().set(key, parsed);
    return parsed;
  }

  return fallback;
}

export async function writeCMS(filePath: string, data: unknown) {
  await writeJsonFile(filePath, data);
}

export async function readProducts() {
  const cms = getCmsPaths();
  return readCMS<unknown[]>(cms.products, productsSeed);
}

export async function writeProducts(data: unknown[]) {
  const cms = getCmsPaths();
  await writeCMS(cms.products, data);
}

export async function readVehicles() {
  const cms = getCmsPaths();
  return readCMS<unknown[]>(cms.vehicles, vehiclesSeed);
}

export async function writeVehicles(data: unknown[]) {
  const cms = getCmsPaths();
  await writeCMS(cms.vehicles, data);
}

export async function readQuoteConfig() {
  const cms = getCmsPaths();
  return readCMS<Record<string, unknown>>(cms.quoteConfig, quoteConfigSeed);
}

export async function writeQuoteConfig(data: Record<string, unknown>) {
  const cms = getCmsPaths();
  await writeCMS(cms.quoteConfig, data);
}

export async function readHotspots(vehicleId: string) {
  const cms = getCmsPaths();
  const filePath = path.join(cms.hotspotsDir, `${vehicleId}.json`);
  const fallback = HOTSPOT_SEEDS[vehicleId] ?? { hotspots: [] };
  return readCMS<{ hotspots: unknown[] }>(filePath, fallback);
}

export async function writeHotspots(vehicleId: string, data: { hotspots: unknown[] }) {
  const cms = getCmsPaths();
  await writeCMS(path.join(cms.hotspotsDir, `${vehicleId}.json`), data);
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
