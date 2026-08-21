import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Box3, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_DIR = path.join(__dirname, "../public/assets/glb");

function fitAndMeasure(scene) {
  const box = new Box3().setFromObject(scene);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  scene.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 10 / maxDim;
  scene.scale.multiplyScalar(scale);
  scene.updateMatrixWorld(true);
  const fitted = new Box3().setFromObject(scene);
  return {
    rawSize: size,
    fittedMin: fitted.min.toArray().map((v) => +v.toFixed(3)),
    fittedMax: fitted.max.toArray().map((v) => +v.toFixed(3)),
    fittedSize: fitted.getSize(new Vector3()).toArray().map((v) => +v.toFixed(3)),
  };
}

const loader = new GLTFLoader();
const files = fs.readdirSync(GLB_DIR).filter((f) => f.endsWith(".glb"));

for (const file of files) {
  const buffer = fs.readFileSync(path.join(GLB_DIR, file));
  await new Promise((resolve) => {
    loader.parse(buffer.buffer, "", (gltf) => {
      const m = fitAndMeasure(gltf.scene);
      console.log(`\n${file}:`);
      console.log(`  raw size: ${m.rawSize.x.toFixed(2)} x ${m.rawSize.y.toFixed(2)} x ${m.rawSize.z.toFixed(2)}`);
      console.log(`  fitted min: [${m.fittedMin}]`);
      console.log(`  fitted max: [${m.fittedMax}]`);
      console.log(`  fitted size: [${m.fittedSize}]`);
      resolve(null);
    });
  });
}
