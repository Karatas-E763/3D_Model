import os from "os";
import path from "path";

export const SEED_PATHS = {
  products: path.join(process.cwd(), "src", "data", "products", "products.json"),
  vehicles: path.join(process.cwd(), "src", "data", "vehicles", "vehicles.json"),
  quoteConfig: path.join(process.cwd(), "src", "data", "quote-config.json"),
  hotspotsDir: path.join(process.cwd(), "src", "data", "hotspots"),
} as const;

/** Writable CMS root: local `data/cms`, or `/tmp` on Vercel serverless. */
export function getCmsRoot() {
  if (process.env.VERCEL === "1") {
    return path.join(os.tmpdir(), "directtrack-cms");
  }
  return path.join(process.cwd(), "data", "cms");
}

export function getCmsPaths() {
  const root = getCmsRoot();
  return {
    products: path.join(root, "products.json"),
    vehicles: path.join(root, "vehicles.json"),
    quoteConfig: path.join(root, "quote-config.json"),
    hotspotsDir: path.join(root, "hotspots"),
  };
}

/** Bundled read-only CMS files shipped with the deployment. */
export const DEPLOYED_CMS_ROOT = path.join(process.cwd(), "data", "cms");

export function getDeployedCmsPaths() {
  const root = DEPLOYED_CMS_ROOT;
  return {
    products: path.join(root, "products.json"),
    vehicles: path.join(root, "vehicles.json"),
    quoteConfig: path.join(root, "quote-config.json"),
    hotspotsDir: path.join(root, "hotspots"),
  };
}
