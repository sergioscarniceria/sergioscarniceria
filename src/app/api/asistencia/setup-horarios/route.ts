import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de Supabase admin");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/* Horarios de cierre por día (general para toda la carnicería) */
const CIERRE: Record<string, string> = {
  lunes: "15:30",
  martes: "15:30",
  miercoles: "15:00",
  jueves: "15:30",
  viernes: "15:30",
  sabado: "15:30",
  domingo: "15:00",
};

const DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

type Config = { entrada: string; descanso: string[] };

/* Horarios por empleado (nombre en minúsculas para hacer match) */
const EMPLEADOS_CONFIG: Record<string, Config> = {
  carlos:   { entrada: "06:30", descanso: ["domingo"] },
  manuel:   { entrada: "06:30", descanso: ["miercoles"] },
  ricardo:  { entrada: "06:30", descanso: ["lunes"] },
  juanito:  { entrada: "06:30", descanso: ["lunes"] },
  "don luis": { entrada: "06:30", descanso: ["jueves"] },
  beto:     { entrada: "07:00", descanso: ["domingo"] },
  esther:   { entrada: "07:00", descanso: ["sabado"] },
  pablo:    { entrada: "07:00", descanso: [] },
  jessy:    { entrada: "07:00", descanso: ["viernes", "sabado"] },
  celeste:  { entrada: "07:00", descanso: [] },
  kari:     { entrada: "08:30", descanso: ["domingo"] },
  kariana:  { entrada: "08:30", descanso: ["domingo"] },
};

function buildHorarioJson(entrada: string, descanso: string[]) {
  const horario: Record<string, { entrada: string; salida: string } | null> = {};
  for (const dia of DIAS_SEMANA) {
    if (descanso.includes(dia)) {
      horario[dia] = null;
    } else {
      horario[dia] = { entrada, salida: CIERRE[dia] };
    }
  }
  return horario;
}

function matchEmpleado(nombre: string): Config | null {
  const lower = nombre.toLowerCase().trim();
  // Exact match first
  if (EMPLEADOS_CONFIG[lower]) return EMPLEADOS_CONFIG[lower];
  // Partial match (nombre contains key or key contains nombre)
  for (const [key, config] of Object.entries(EMPLEADOS_CONFIG)) {
    if (lower.includes(key) || key.includes(lower)) return config;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // Simple auth check - require a secret or just allow it (one-time use)
    const body = await req.json().catch(() => ({}));
    const secret = body?.secret || "";
    if (secret !== "sergios2026") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: empleados, error } = await supabase
      .from("empleados")
      .select("id, nombre, horario_json, dias_descanso_json")
      .eq("activo", true);

    if (error || !empleados) {
      return NextResponse.json({ error: "No se pudieron cargar empleados" }, { status: 500 });
    }

    const results: { nombre: string; matched: boolean; entrada?: string; descanso?: string[] }[] = [];

    for (const emp of empleados) {
      const config = matchEmpleado(emp.nombre);
      if (!config) {
        results.push({ nombre: emp.nombre, matched: false });
        continue;
      }

      const horario_json = buildHorarioJson(config.entrada, config.descanso);
      const dias_descanso_json = config.descanso;

      const { error: updateError } = await supabase
        .from("empleados")
        .update({ horario_json, dias_descanso_json })
        .eq("id", emp.id);

      if (updateError) {
        results.push({ nombre: emp.nombre, matched: true, entrada: config.entrada, descanso: config.descanso });
        console.log(`Error updating ${emp.nombre}:`, updateError);
      } else {
        results.push({ nombre: emp.nombre, matched: true, entrada: config.entrada, descanso: config.descanso });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Horarios actualizados",
      results,
    });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
