import type { HotspotInput } from "@/utils/hotspotPositions";
import transporteCarga from "@/data/hotspots/transporte-carga.json";
import transportePasajeros from "@/data/hotspots/transporte-pasajeros.json";
import vehiculosLigeros from "@/data/hotspots/vehiculos-ligeros.json";
import maquinariaPesada from "@/data/hotspots/maquinaria-pesada.json";
import equiposManejo from "@/data/hotspots/equipos-manejo.json";
import motocicletas from "@/data/hotspots/motocicletas.json";
import unidadesEspecializadas from "@/data/hotspots/unidades-especializadas.json";
import activosSinMotor from "@/data/hotspots/activos-sin-motor.json";
import solucionesEspeciales from "@/data/hotspots/soluciones-especiales.json";

const hotspotMap: Record<string, { hotspots: HotspotInput[] }> = {
  "transporte-carga": transporteCarga as { hotspots: HotspotInput[] },
  "transporte-pasajeros": transportePasajeros as { hotspots: HotspotInput[] },
  "vehiculos-ligeros": vehiculosLigeros as { hotspots: HotspotInput[] },
  "maquinaria-pesada": maquinariaPesada as { hotspots: HotspotInput[] },
  "equipos-manejo": equiposManejo as { hotspots: HotspotInput[] },
  motocicletas: motocicletas as { hotspots: HotspotInput[] },
  "unidades-especializadas": unidadesEspecializadas as { hotspots: HotspotInput[] },
  "activos-sin-motor": activosSinMotor as { hotspots: HotspotInput[] },
  "soluciones-especiales": solucionesEspeciales as { hotspots: HotspotInput[] },
};

export function getHotspots(vehicleId: string): { hotspots: HotspotInput[] } {
  return hotspotMap[vehicleId] ?? { hotspots: [] };
}
