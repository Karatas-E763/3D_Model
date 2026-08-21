// /**
//  * GLB Optimization Script
//  * Run: node scripts/optimize-glb.mjs
//  *
//  * Compresses GLB files using Draco mesh compression and texture resizing
//  * to significantly reduce file size and improve loading times.
//  */

// import { NodeIO } from "@gltf-transform/core";
// import { KHRDracoMeshCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
// import { draco } from "draco3dgltf";
// import {
//   dedup,
//   prune,
//   flatten,
//   join,
//   weld,
//   simplify,
//   resample,
//   textureCompress,
// } from "@gltf-transform/functions";
// import { MeshoptSimplifier } from "meshoptimizer";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const INPUT_DIR = path.join(__dirname, "../public/assets/glb");
// const OUTPUT_DIR = path.join(__dirname, "../public/assets/glb-optimized");

// async function optimizeGLB(inputPath, outputPath) {
//   const io = new NodeIO()
//     .registerExtensions([KHRDracoMeshCompression, KHRMeshQuantization])
//     .registerDependencies({
//       "draco3d.decoder": await draco.createDecoderModule(),
//       "draco3d.encoder": await draco.createEncoderModule(),
//     });

//   const document = await io.read(inputPath);

//   await document.transform(
//     dedup(),
//     prune(),
//     weld(),
//     simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.01 }),
//     resample(),
//     flatten(),
//     join(),
//     textureCompress({ resize: [1024, 1024] })
//   );

//   await io.write(outputPath, document);

//   const inputSize = fs.statSync(inputPath).size;
//   const outputSize = fs.statSync(outputPath).size;
//   const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);

//   console.log(
//     `✓ ${path.basename(inputPath)}: ${(inputSize / 1e6).toFixed(1)}MB → ${(outputSize / 1e6).toFixed(1)}MB (${reduction}% reduction)`
//   );
// }

// async function main() {
//   if (!fs.existsSync(OUTPUT_DIR)) {
//     fs.mkdirSync(OUTPUT_DIR, { recursive: true });
//   }

//   const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".glb"));
//   console.log(`Optimizing ${files.length} GLB files...\n`);

//   for (const file of files) {
//     try {
//       await optimizeGLB(
//         path.join(INPUT_DIR, file),
//         path.join(OUTPUT_DIR, file)
//       );
//     } catch (err) {
//       console.error(`✗ Failed: ${file}`, err.message);
//     }
//   }

//   console.log("\nDone! Update glbPath in vehicles.json to use /assets/glb-optimized/ if desired.");
// }

// main();
