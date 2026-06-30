import fs from "fs/promises";
import path from "path";
import {
  canUseGitHubStorage,
  getRepoIdentity,
  readGitHubJson,
  readPublicGitHubJson,
  writeGitHubJson,
} from "./github-store";
import { getCmsPaths } from "./paths";
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

function getWritableCmsPaths() {
  const root = path.join(process.cwd(), "data", "cms");
  return {
    products: path.join(root, "products.json"),
    vehicles: path.join(root, "vehicles.json"),
    quoteConfig: path.join(root, "quote-config.json"),
    hotspotsDir: path.join(root, "hotspots"),
  };
}

function deployedPath(repoPath: string) {
  return path.join(process.cwd(), repoPath);
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

    const deployed = deployedPath(REPO_PATHS.hotspot(vehicleId));
    const fromDeployed = await readJsonFile<{ hotspots: unknown[] }>(deployed);
    if (fromDeployed !== null) {
      await writeJsonFile(target, fromDeployed);
      continue;
    }

    await writeJsonFile(target, data);
  }
}

export async function ensureCMS() {
  if (isVercel() && (canUseGitHubStorage() || getRepoIdentity())) return;

  const writable = getWritableCmsPaths();
  const committed = getCmsPaths();

  await seedFileIfMissing(writable.products, committed.products);
  await seedFileIfMissing(writable.vehicles, committed.vehicles);
  await seedFileIfMissing(writable.quoteConfig, committed.quoteConfig);

  if (!(await fileExists(writable.products))) {
    await seedFallbackIfMissing(writable.products, productsSeed);
  }
  if (!(await fileExists(writable.vehicles))) {
    await seedFallbackIfMissing(writable.vehicles, vehiclesSeed);
  }
  if (!(await fileExists(writable.quoteConfig))) {
    await seedFallbackIfMissing(writable.quoteConfig, quoteConfigSeed);
  }

  await seedHotspotsIfMissing(writable.hotspotsDir);
}

async function readPersistedJson<T>(
  repoPath: string,
  writablePath: string,
  fallback: T
): Promise<T> {
  if (!isVercel()) {
    await ensureCMS();

    const fromWritable = await readJsonFile<T>(writablePath);
    if (fromWritable !== null) return fromWritable;
  }

  if (canUseGitHubStorage() || (isVercel() && getRepoIdentity())) {
    const fromGitHub = await readGitHubJson<T>(repoPath);
    if (fromGitHub !== null) {
      return fromGitHub;
    }
  }

  if (isVercel() && getRepoIdentity()) {
    const fromPublicGitHub = await readPublicGitHubJson<T>(repoPath);
    if (fromPublicGitHub !== null) {
      return fromPublicGitHub;
    }
  }

  const fromDeployed = await readJsonFile<T>(deployedPath(repoPath));
  if (fromDeployed !== null) return fromDeployed;

  return fallback;
}

async function writePersistedJson(
  repoPath: string,
  writablePath: string,
  data: unknown
) {
  if (isVercel()) {
    if (!canUseGitHubStorage()) {
      throw new Error(
        "No se pudo guardar el JSON del CMS de forma permanente. En Vercel, configura GITHUB_TOKEN con permiso de escritura en el repositorio para persistir los archivos en data/cms."
      );
    }

    await writeGitHubJson(repoPath, data, `cms: update ${repoPath}`);
    return;
  }

  await writeJsonFile(writablePath, data);

  if (canUseGitHubStorage()) {
    try {
      await writeGitHubJson(repoPath, data, `cms: update ${repoPath}`);
    } catch {
      // GitHub sync is optional when running locally.
    }
  }
}

export async function readProducts() {
  const writable = getWritableCmsPaths();
  return readPersistedJson<unknown[]>(
    REPO_PATHS.products,
    writable.products,
    productsSeed
  );
}

export async function writeProducts(data: unknown[]) {
  const writable = getWritableCmsPaths();
  await writePersistedJson(REPO_PATHS.products, writable.products, data);
}

export async function readVehicles() {
  const writable = getWritableCmsPaths();
  return readPersistedJson<unknown[]>(
    REPO_PATHS.vehicles,
    writable.vehicles,
    vehiclesSeed
  );
}

export async function writeVehicles(data: unknown[]) {
  const writable = getWritableCmsPaths();
  await writePersistedJson(REPO_PATHS.vehicles, writable.vehicles, data);
}

export async function readQuoteConfig() {
  const writable = getWritableCmsPaths();
  return readPersistedJson<Record<string, unknown>>(
    REPO_PATHS.quoteConfig,
    writable.quoteConfig,
    quoteConfigSeed
  );
}

export async function writeQuoteConfig(data: Record<string, unknown>) {
  const writable = getWritableCmsPaths();
  await writePersistedJson(REPO_PATHS.quoteConfig, writable.quoteConfig, data);
}

export async function readHotspots(vehicleId: string) {
  const writable = getWritableCmsPaths();
  const repoPath = REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(writable.hotspotsDir, `${vehicleId}.json`);
  const fallback = HOTSPOT_SEEDS[vehicleId] ?? { hotspots: [] };
  return readPersistedJson<{ hotspots: unknown[] }>(repoPath, localPath, fallback);
}

export async function writeHotspots(vehicleId: string, data: { hotspots: unknown[] }) {
  const writable = getWritableCmsPaths();
  const repoPath = REPO_PATHS.hotspot(vehicleId);
  const localPath = path.join(writable.hotspotsDir, `${vehicleId}.json`);
  await writePersistedJson(repoPath, localPath, data);
}

export async function listHotspotVehicles() {
  const writable = getWritableCmsPaths();

  if (canUseGitHubStorage() || (isVercel() && getRepoIdentity())) {
    return Object.keys(HOTSPOT_SEEDS);
  }

  try {
    await ensureCMS();
    const files = await fs.readdir(writable.hotspotsDir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return Object.keys(HOTSPOT_SEEDS);
  }
}
