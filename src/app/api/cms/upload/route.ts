import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  ALLOWED_MIME,
  mimeError,
  storeFileInBlob,
  storeFileLocally,
  UPLOAD_PREFIX,
  useBlobStorage,
  validateMime,
  validateUploadType,
  type UploadType,
} from "@/lib/cms/upload";
import { cmsStorageUnavailableMessage } from "@/lib/cms/blob-auth";

export const runtime = "nodejs";

function parseClientPayload(clientPayload: string | null) {
  if (!clientPayload) return null;
  try {
    const parsed = JSON.parse(clientPayload) as { type?: string };
    if (!parsed.type || !validateUploadType(parsed.type)) return null;
    return parsed.type;
  } catch {
    return null;
  }
}

async function handleBlobClientUpload(request: Request) {
  if (!useBlobStorage()) {
    return NextResponse.json(
      {
        error: cmsStorageUnavailableMessage(),
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const type = parseClientPayload(clientPayload ?? null);
      if (!type) {
        throw new Error("Tipo de archivo inválido");
      }

      const prefix = UPLOAD_PREFIX[type];
      if (!pathname.startsWith(`${prefix}/`)) {
        throw new Error("Ruta de subida inválida");
      }

      return {
        allowedContentTypes: ALLOWED_MIME[type],
        maximumSizeInBytes: 100 * 1024 * 1024,
        tokenPayload: clientPayload,
      };
    },
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(jsonResponse);
}

async function handleFormUpload(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!(file instanceof File) || !validateUploadType(String(type))) {
    return NextResponse.json({ error: "Archivo o tipo inválido" }, { status: 400 });
  }

  const uploadType = type as UploadType;

  if (!validateMime(uploadType, file.type)) {
    return NextResponse.json({ error: mimeError(uploadType) }, { status: 400 });
  }

  if (useBlobStorage()) {
    const result = await storeFileInBlob(file, uploadType);
    return NextResponse.json(result);
  }

  if (process.env.VERCEL === "1") {
    return NextResponse.json({ error: cmsStorageUnavailableMessage() }, { status: 503 });
  }

  const result = await storeFileLocally(file, uploadType);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return handleBlobClientUpload(request);
    }

    return handleFormUpload(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.error("[cms/upload]", error);

    if (error instanceof Error) {
      if (error.message.includes("read-only") || error.message.includes("EROFS")) {
        return NextResponse.json(
          {
            error:
              "No se puede escribir en el servidor. Conecta Vercel Blob al proyecto para subir archivos en producción.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
