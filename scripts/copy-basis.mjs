import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const sourceDir = path.join(
  projectRoot,
  "node_modules/three/examples/jsm/libs/basis"
);
const targetDir = path.join(projectRoot, "public/basis");

const files = ["basis_transcoder.js", "basis_transcoder.wasm"];

if (!fs.existsSync(sourceDir)) {
  console.warn("copy-basis: three.js basis transcoder not found, skipping");
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}

console.log(`copy-basis: copied ${files.length} files to public/basis/`);
