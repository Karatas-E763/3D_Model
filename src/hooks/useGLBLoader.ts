"use client";

import { useGLTF } from "@react-three/drei";

let preloadQueue: Promise<void> = Promise.resolve();

/** Draco + WebP optimized GLBs — no KTX2/meshopt required. */
export function preloadGLB(url: string) {
  if (typeof window === "undefined" || !url) return;

  preloadQueue = preloadQueue.then(() => {
    useGLTF.preload(url, true, false);
  });
}

export function initGLTFLoader() {
  if (typeof window === "undefined") return;
  useGLTF.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
  );
}
