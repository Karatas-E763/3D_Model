import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbDir = path.join(__dirname, "../public/assets/glb");
const MIN_BYTES = 1024 * 1024;

if (!fs.existsSync(glbDir)) {
  console.error("verify-glb-assets: missing public/assets/glb directory");
  process.exit(1);
}

const files = fs.readdirSync(glbDir).filter((file) => file.endsWith(".glb"));
const invalid = [];

for (const file of files) {
  const filePath = path.join(glbDir, file);
  const size = fs.statSync(filePath).size;

  if (size < MIN_BYTES) {
    const preview = fs.readFileSync(filePath, "utf8").slice(0, 120);
    invalid.push({ file, size, preview });
  }
}

if (invalid.length > 0) {
  console.error("\nverify-glb-assets: GLB files are not deployable model binaries.\n");
  for (const { file, size, preview } of invalid) {
    console.error(`  - ${file} (${size} bytes)`);
    console.error(`    ${preview.replace(/\s+/g, " ")}`);
  }
  console.error(
    "\nThese look like Git LFS pointer files. Vercel cannot render them.\n" +
      "Fix locally:\n" +
      "  1. git lfs pull\n" +
      "  2. git lfs untrack \"*.glb\"\n" +
      "  3. git add --renormalize public/assets/glb/\n" +
      "  4. commit and push the real .glb files\n"
  );
  process.exit(1);
}

console.log(`verify-glb-assets: OK (${files.length} GLB files)`);
