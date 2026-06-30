import { NextResponse } from "next/server";
import { readQuoteConfig, writeQuoteConfig } from "@/lib/cms/store";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  try {
    const data = await readQuoteConfig();
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la configuración" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    await writeQuoteConfig(data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[cms/quote-config]", error);
    const message =
      error instanceof Error ? error.message : "Error al guardar configuración";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
