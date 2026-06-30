import path from "path";

export const SEED_PATHS = {
  products: path.join(process.cwd(), "src", "data", "products", "products.json"),
  vehicles: path.join(process.cwd(), "src", "data", "vehicles", "vehicles.json"),
  quoteConfig: path.join(process.cwd(), "src", "data", "quote-config.json"),
  hotspotsDir: path.join(process.cwd(), "src", "data", "hotspots"),
} as const;

/** Committed JSON files tracked in git under data/cms. */
export function getCmsRoot() {
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
