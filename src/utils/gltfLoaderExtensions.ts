"use client";

import * as THREE from "three";

export const MODEL_FIT_SIZE = 10;

const enhancedScenes = new WeakSet<THREE.Object3D>();

export function computeSceneFit(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitScale = maxDim > 0 ? MODEL_FIT_SIZE / maxDim : 1;

  return {
    center: [-center.x, -center.y, -center.z] as [number, number, number],
    fitScale,
  };
}

export function enhanceMeshQualityOnce(root: THREE.Object3D, maxAnisotropy: number) {
  if (enhancedScenes.has(root)) return;
  enhancedScenes.add(root);

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;

    const mesh = child as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return;

      material.envMapIntensity = 1.2;
      material.needsUpdate = true;

      [material.map, material.emissiveMap].filter(Boolean).forEach((texture) => {
        texture!.colorSpace = THREE.SRGBColorSpace;
        texture!.anisotropy = maxAnisotropy;
        texture!.needsUpdate = true;
      });
    });
  });
}

/** Clone once per viewer instance so cached useGLTF scenes are not shared in the graph. */
export function cloneModelScene(source: THREE.Group): THREE.Group {
  return source.clone(true);
}
