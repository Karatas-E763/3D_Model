import { NextResponse } from "next/server";
import vehiclesSeed from "@/data/vehicles/vehicles.json";
import { readVehicles, writeVehicles } from "@/lib/cms/store";
import { requireAdmin } from "@/lib/auth";
import type { Vehicle } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function mergeVehicles(incoming: unknown): Vehicle[] {
  const seed = vehiclesSeed as Vehicle[];
  if (!Array.isArray(incoming)) {
    throw new Error("Formato inválido");
  }

  const byId = new Map<string, Vehicle>();
  for (const item of incoming) {
    if (typeof item !== "object" || item === null || !("id" in item)) continue;
    byId.set(String((item as Vehicle).id), item as Vehicle);
  }

  return seed.map((seedVehicle) => {
    const patch = byId.get(seedVehicle.id);
    if (!patch) return seedVehicle;

    return {
      ...seedVehicle,
      title: patch.title ?? seedVehicle.title,
      subtitle: patch.subtitle ?? seedVehicle.subtitle,
      description: patch.description ?? seedVehicle.description,
      id: seedVehicle.id,
      glbPath: seedVehicle.glbPath,
      hotspotsFile: seedVehicle.hotspotsFile,
      cameraPosition: patch.cameraPosition ?? seedVehicle.cameraPosition,
      modelScale: patch.modelScale ?? seedVehicle.modelScale,
      modelRotation: patch.modelRotation ?? seedVehicle.modelRotation,
    };
  });
}

export async function GET() {
  try {
    const data = await readVehicles();
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ error: "No se pudieron cargar las unidades" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    const merged = mergeVehicles(data);
    await writeVehicles(merged);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Formato inválido") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[cms/vehicles]", error);
    const message =
      error instanceof Error ? error.message : "Error al guardar unidades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
