import fs from "fs/promises";
import path from "path";
import {
  canUseGitHubStorage,
  readGitHubJson,
  writeGitHubJson,
} from "./github-store";
import { getCmsPaths, SEED_PATHS } from "./paths";
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

const REPO_PATHS = {
  products: "data/cms/products.json",
  vehicles: "data/cms/vehicles.json",
  quoteConfig: "data/cms/quote-config.json",
  hotspot: (vehicleId: string) => `data/cms/hotspots/${vehicleId}.json`,
} as const;

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

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function seedFileIfMissing(targetPath: string, sourcePath: string) {
  if (await fileExists(targetPath)) return;
  const source = await readJsonFile<unknown>(sourcePath);
  if (source !== null) {
    await writeJsonFile(targetPath, source);
  }
}

async function seedFallbackIfMissing(targetPath: string, fallback: unknown) {
  if (await fileExists(targetPath)) return;
  await writeJsonFile(targetPath, fallback);
}

async function seedHotspotsIfMissing(hotspotsDir: string) {
  await ensureDir(hotspotsDir);

  for (const [vehicleId, data] of Object.entries(HOTSPOT_SEEDS)) {
    const target = path.join(hotspotsDir, `${vehicleId}.json`);
    if (await fileExists(target)) continue;

    const committed = getCmsPaths();
    const fromCommitted = await readJsonFile<{ hotspots: unknown[] }>(
      path.join(committed.hotspotsDir, `${vehicleId}.json`)
    );
    if (fromCommitted !== null) {
      await writeJsonFile(target, fromCommitted);
      continue;
    }

    await writeJsonFile(target, data);
  }
}

export async function ensureCMS() {
  if (isVercel() && canUseGitHubStorage()) return;

  const disk = getCmsPaths();

  await seedFileIfMissing(disk.products, SEED_PATHS.products);
  await seedFileIfMissing(disk.vehicles, SEED_PATHS.vehicles);
  await seedFileIfMissing(disk.quoteConfig, SEED_PATHS.quoteConfig);

  if (!(await fileExists(disk.products))) {
    await seedFallbackIfMissing(disk.products, productsSeed);
  }
  if (!(await fileExists(disk.vehicles))) {
    await seedFallbackIfMissing(disk.vehicles, vehiclesSeed);
  }
  if (!(await fileExists(disk.quoteConfig))) {
    await seedFallbackIfMissing(disk.quoteConfig, quoteConfigSeed);
  }

  await seedHotspotsIfMissing(disk.hotspotsDir);
}

async function readPersistedJson<T>(
  repoPath: string,
  diskPath: string,
  fallback: T
): Promise<T> {
  if (canUseGitHubStorage()) {
    const fromGitHub = await readGitHubJson<T>(repoPath);
    if (fromGitHub !== null) {
      try {
        await writeJsonFile(diskPath, fromGitHub);
      } catch {
        // Mirror to disk is best-effort on serverless.
      }
      return fromGitHub;
    }
  }

  await ensureCMS();

  const fromDisk = await readJsonFile<T>(diskPath);
  if (fromDisk !== null) return fromDisk;

  return fallback;
}

async function writePersistedJson(
  repoPath: string,
  diskPath: string,
  data: unknown
) {
  let diskPersisted = false;

  try {
    await writeJsonFile(diskPath, data);
    diskPersisted = true;
  } catch (error) {
    if (!isVercel()) throw error;
  }

  if (canUseGitHubStorage()) {
    await writeGitHubJson(repoPath, data, `cms: update ${repoPath}`);
    return;
  }

  if (isVercel()) {
    throw new Error(
      "No se pudo guardar el JSON del CMS de forma permanente. En Vercel, configura GITHUB_TOKEN para persistir los archivos en data/cms del repositorio."
    );
  }

  if (!diskPersisted) {
    throw new Error("No se pudo guardar el JSON del CMS en data/cms.");
  }
}

export async function readProducts() {
  const disk = getCmsPaths();
  return readPersistedJson<unknown[]>(
    REPO_PATHS.products,
    disk.products,
    productsSeed
  );
}

export async function writeProducts(data: unknown[]) {
  const disk = getCmsPaths();
  await writePersistedJson(REPO_PATHS.products, disk.products, data);
}

export async function readVehicles() {
  const disk = getCmsPaths();
  return readPersistedJson<unknown[]>(
    REPO_PATHS.vehicles,
    disk.vehicles,
    vehiclesSeed
  );
}

export async function writeVehicles(data: unknown[]) {
  const disk = getCmsPaths();
  await writePersistedJson(REPO_PATHS.vehicles, disk.vehicles, data);
}

export async function readQuoteConfig() {
  const disk = getCmsPaths();
  return readPersistedJson<Record<string, unknown>>(
    REPO_PATHS.quoteConfig,
    disk.quoteConfig,
    quoteConfigSeed
  );
}

export async function writeQuoteConfig(data: Record<string, unknown>) {
  const disk = getCmsPaths();
  await writePersistedJson(REPO_PATHS.quoteConfig, disk.quoteConfig, data);
}

export async function readHotspots(vehicleId: string) {
  const disk = getCmsPaths();
  const repoPath = REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(disk.hotspotsDir, `${vehicleId}.json`);
  const fallback = HOTSPOT_SEEDS[vehicleId] ?? { hotspots: [] };
  return readPersistedJson<{ hotspots: unknown[] }>(repoPath, localPath, fallback);
}

export async function writeHotspots(vehicleId: string, data: { hotspots: unknown[] }) {
  const disk = getCmsPaths();
  const repoPath = REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(disk.hotspotsDir, `${vehicleId}.json`);
  await writePersistedJson(repoPath, localPath, data);
}

export async function listHotspotVehicles() {
  const disk = getCmsPaths();

  try {
    await ensureCMS();
    const files = await fs.readdir(disk.hotspotsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return Object.keys(HOTSPOT_SEEDS);
  }
}
