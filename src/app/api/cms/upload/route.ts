import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  mimeError,
  storeFileLocally,
  validateMime,
  validateUploadType,
  type UploadType,
} from "@/lib/cms/upload";

export const runtime = "nodejs";

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

  const result = await storeFileLocally(file, uploadType);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    return handleFormUpload(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.error("[cms/upload]", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
