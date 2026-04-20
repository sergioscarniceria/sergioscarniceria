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

/* ── Timezone helpers ── */

function toMexicoMinutes(isoTimestamp: string): number {
  const date = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function toMexicoDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // YYYY-MM-DD
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fechaToDayName(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  const day = d.getDay();
  const names = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return names[day];
}

const TOLERANCIA_BREAK_MIN = 30;
const TOLERANCIA_EXTRA_MIN = 30;

type Empleado = {
  id: string;
  nombre: string;
  horario_json: Record<string, any>;
  dias_descanso_json: string[];
};

type Evento = {
  id: string;
  empleado_id: string;
  tipo_evento: "entrada" | "salida" | "break_out" | "break_in";
  timestamp_evento: string;
};

function buildSummary(empleado: Empleado, fecha: string, eventos: Evento[]) {
  const sorted = [...eventos].sort(
    (a, b) => new Date(a.timestamp_evento).getTime() - new Date(b.timestamp_evento).getTime()
  );

  const entrada = sorted.find((e) => e.tipo_evento === "entrada") || null;
  const salida = [...sorted].reverse().find((e) => e.tipo_evento === "salida") || null;

  let minutosFuera = 0;
  let breakOpenAt: Date | null = null;

  for (const ev of sorted) {
    const ts = new Date(ev.timestamp_evento);
    if (ev.tipo_evento === "break_out") breakOpenAt = ts;
    if (ev.tipo_evento === "break_in" && breakOpenAt) {
      minutosFuera += Math.max(0, Math.round((ts.getTime() - breakOpenAt.getTime()) / 60000));
      breakOpenAt = null;
    }
  }

  const totalBreaks = sorted.filter((e) => e.tipo_evento === "break_out").length;
  const horarioDia = empleado.horario_json?.[fechaToDayName(fecha)] || null;

  let minutosRetardo = 0;
  let minutosExtra = 0;
  let estatus = "jornada incompleta";

  const minutosFueraDescontable = Math.max(0, minutosFuera - TOLERANCIA_BREAK_MIN);

  if (!horarioDia) {
    estatus = "día no laborable";
  } else {
    const entradaEsperada = horarioDia?.entrada;
    const salidaEsperada = horarioDia?.salida;

    if (entrada && entradaEsperada) {
      const realMin = toMexicoMinutes(entrada.timestamp_evento);
      const expectedMin = timeStrToMinutes(entradaEsperada);
      minutosRetardo = Math.max(0, realMin - expectedMin);
    }

    if (salida && salidaEsperada) {
      const realMin = toMexicoMinutes(salida.timestamp_evento);
      const expectedMin = timeStrToMinutes(salidaEsperada);
      const extraBruto = Math.max(0, realMin - expectedMin);
      minutosExtra = Math.max(0, extraBruto - TOLERANCIA_EXTRA_MIN);
    }

    if (!entrada || !salida) {
      estatus = "jornada incompleta";
    } else if (minutosRetardo > 0) {
      estatus = "retardo";
    } else if (minutosFueraDescontable > 0) {
      estatus = "tiempo fuera excedido";
    } else {
      estatus = "puntual";
    }
  }

  return {
    fecha,
    hora_entrada: entrada?.timestamp_evento || null,
    hora_salida: salida?.timestamp_evento || null,
    minutos_retardo: minutosRetardo,
    minutos_fuera: minutosFuera,
    minutos_extra: minutosExtra,
    total_eventos: sorted.length,
    total_salidas: totalBreaks,
    estatus,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(body?.secret || "")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get all active employees with their schedules
    const { data: empleados, error: empError } = await supabase
      .from("empleados")
      .select("id, nombre, horario_json, dias_descanso_json")
      .eq("activo", true);

    if (empError || !empleados) {
      return NextResponse.json({ error: "No se pudieron cargar empleados" }, { status: 500 });
    }

    // 2. Get ALL events
    const { data: allEventos, error: evError } = await supabase
      .from("asistencias_eventos")
      .select("id, empleado_id, tipo_evento, timestamp_evento")
      .order("timestamp_evento", { ascending: true });

    if (evError || !allEventos) {
      return NextResponse.json({ error: "No se pudieron cargar eventos" }, { status: 500 });
    }

    // 3. Group events by empleado_id + fecha (Mexico City date)
    const grouped: Record<string, Record<string, Evento[]>> = {};
    for (const ev of allEventos as Evento[]) {
      const fecha = toMexicoDate(ev.timestamp_evento);
      if (!grouped[ev.empleado_id]) grouped[ev.empleado_id] = {};
      if (!grouped[ev.empleado_id][fecha]) grouped[ev.empleado_id][fecha] = [];
      grouped[ev.empleado_id][fecha].push(ev);
    }

    // 4. Recalculate all summaries
    const empMap = new Map(empleados.map((e: any) => [e.id, e as Empleado]));
    let totalUpserted = 0;
    let totalSkipped = 0;

    for (const [empId, fechas] of Object.entries(grouped)) {
      const empleado = empMap.get(empId);
      if (!empleado) {
        totalSkipped += Object.keys(fechas).length;
        continue;
      }

      for (const [fecha, eventos] of Object.entries(fechas)) {
        const resumen = buildSummary(empleado, fecha, eventos);

        const { error: upsertError } = await supabase
          .from("asistencias_resumen")
          .upsert(
            [{
              empleado_id: empId,
              fecha,
              hora_entrada: resumen.hora_entrada,
              hora_salida: resumen.hora_salida,
              minutos_retardo: resumen.minutos_retardo,
              minutos_fuera: resumen.minutos_fuera,
              minutos_extra: resumen.minutos_extra,
              total_eventos: resumen.total_eventos,
              estatus: resumen.estatus,
              updated_at: new Date().toISOString(),
            }],
            { onConflict: "empleado_id,fecha" }
          );

        if (upsertError) {
          console.log(`Error upsert ${empleado.nombre} ${fecha}:`, upsertError);
          totalSkipped++;
        } else {
          totalUpserted++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Recalculación completa: ${totalUpserted} resúmenes actualizados, ${totalSkipped} omitidos`,
      totalUpserted,
      totalSkipped,
      totalEmpleados: empleados.length,
    });
  } catch (err) {
    console.log(err);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}
