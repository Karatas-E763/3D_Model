import fs from "fs/promises";
import os from "os";
import path from "path";

export type UploadType = "image" | "pdf" | "video";

export const UPLOAD_PREFIX: Record<UploadType, string> = {
  image: "images/products",
  pdf: "pdf",
  video: "videos",
};

const PUBLIC_PREFIX: Record<UploadType, string> = {
  image: "/assets/images/products",
  pdf: "/assets/pdf",
  video: "/assets/videos",
};

function getLocalDirs(): Record<UploadType, string> {
  if (process.env.VERCEL === "1") {
    const root = path.join(os.tmpdir(), "directtrack-uploads");
    return {
      image: path.join(root, "images", "products"),
      pdf: path.join(root, "pdf"),
      video: path.join(root, "videos"),
    };
  }

  return {
    image: path.join(process.cwd(), "public", "assets", "images", "products"),
    pdf: path.join(process.cwd(), "public", "assets", "pdf"),
    video: path.join(process.cwd(), "public", "assets", "videos"),
  };
}

export const ALLOWED_MIME: Record<UploadType, string[]> = {
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  pdf: ["application/pdf"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._\-\s]/g, "_").replace(/\s+/g, " ").trim();
}

export function buildUploadPath(type: UploadType, filename: string) {
  const safe = sanitizeFilename(filename) || "archivo";
  return `${UPLOAD_PREFIX[type]}/${Date.now()}-${safe}`;
}

export function validateUploadType(type: string): type is UploadType {
  return type === "image" || type === "pdf" || type === "video";
}

export function validateMime(type: UploadType, mime: string) {
  return ALLOWED_MIME[type].includes(mime);
}

export function mimeError(type: UploadType) {
  if (type === "image") return "Formato de imagen no permitido";
  if (type === "pdf") return "Solo se permiten archivos PDF";
  return "Solo se permiten archivos de video MP4, WebM o MOV";
}

export function useBlobStorage() {
  return false;
}

export async function storeFileLocally(
  file: File,
  type: UploadType
): Promise<{ path: string; filename: string }> {
  const dirs = getLocalDirs();
  const dir = dirs[type];
  await fs.mkdir(dir, { recursive: true });

  const filename = sanitizeFilename(file.name) || "archivo";
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return {
    path: `${PUBLIC_PREFIX[type]}/${filename}`,
    filename,
  };
}

export async function storeFileInBlob(
  file: File,
  type: UploadType
): Promise<{ path: string; filename: string }> {
  return storeFileLocally(file, type);
}
