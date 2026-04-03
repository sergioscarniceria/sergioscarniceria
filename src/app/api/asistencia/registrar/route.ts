import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Empleado = {
  id: string;
  nombre: string;
  pin: string;
  rol: string;
  horario_json: Record<string, any>;
  dias_descanso_json: string[];
  activo: boolean;
};

type Evento = {
  id: string;
  empleado_id: string;
  tipo_evento: "entrada" | "salida" | "break_out" | "break_in";
  timestamp_evento: string;
  foto_url: string | null;
  dispositivo_id: string | null;
  created_at: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !key) {
    throw new Error("Faltan variables de Supabase admin");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getMexicoDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  const fecha = `${parts.year}-${parts.month}-${parts.day}`;

  const weekdayMap: Record<string, string> = {
    monday: "lunes",
    tuesday: "martes",
    wednesday: "miercoles",
    thursday: "jueves",
    friday: "viernes",
    saturday: "sabado",
    sunday: "domingo",
  };

  const weekdayEnglish = String(parts.weekday || "").toLowerCase();
  const dia = weekdayMap[weekdayEnglish] || "lunes";

  return {
    fecha,
    dia,
    hora: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function minutesDiff(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de foto inválido");
  }

  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function buildSummary(
  empleado: Empleado,
  fecha: string,
  eventos: Evento[]
) {
  const sorted = [...eventos].sort(
    (a, b) =>
      new Date(a.timestamp_evento).getTime() - new Date(b.timestamp_evento).getTime()
  );

  const entrada = sorted.find((e) => e.tipo_evento === "entrada") || null;

  const salida =
    [...sorted].reverse().find((e) => e.tipo_evento === "salida") || null;

  let minutosFuera = 0;
  let breakOpenAt: Date | null = null;
  let totalEventos = sorted.length;

  for (const ev of sorted) {
    const ts = new Date(ev.timestamp_evento);

    if (ev.tipo_evento === "break_out") {
      breakOpenAt = ts;
    }

    if (ev.tipo_evento === "break_in" && breakOpenAt) {
      minutosFuera += Math.max(0, minutesDiff(ts, breakOpenAt));
      breakOpenAt = null;
    }
  }

  const totalBreaks = sorted.filter((e) => e.tipo_evento === "break_out").length;

  const horarioDia = empleado.horario_json?.[fechaToDayName(fecha)] || null;

  let minutosRetardo = 0;
  let minutosExtra = 0;
  let estatus = "jornada incompleta";

  if (!horarioDia) {
    estatus = "día no laborable";
  } else {
    const entradaEsperada = horarioDia?.entrada;
    const salidaEsperada = horarioDia?.salida;

    if (entrada && entradaEsperada) {
      const entradaEsperadaDate = new Date(`${fecha}T${entradaEsperada}:00`);
      const entradaReal = new Date(entrada.timestamp_evento);
      minutosRetardo = Math.max(0, minutesDiff(entradaReal, entradaEsperadaDate));
    }

    if (salida && salidaEsperada) {
      const salidaEsperadaDate = new Date(`${fecha}T${salidaEsperada}:00`);
      const salidaReal = new Date(salida.timestamp_evento);
      minutosExtra = Math.max(0, minutesDiff(salidaReal, salidaEsperadaDate));
    }

    if (!entrada || !salida) {
      estatus = "jornada incompleta";
    } else if (minutosRetardo > 0) {
      estatus = "retardo";
    } else if (minutosFuera > 45) {
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
    total_eventos: totalEventos,
    total_salidas: totalBreaks,
    estatus,
  };
}

function fechaToDayName(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  const day = d.getDay();

  switch (day) {
    case 0:
      return "domingo";
    case 1:
      return "lunes";
    case 2:
      return "martes";
    case 3:
      return "miercoles";
    case 4:
      return "jueves";
    case 5:
      return "viernes";
    default:
      return "sabado";
  }
}

function isAllowedSequence(lastType: string | null, nextType: string) {
  if (!lastType) {
    return nextType === "entrada";
  }

  const allowed: Record<string, string[]> = {
    entrada: ["break_out", "salida"],
    break_out: ["break_in"],
    break_in: ["break_out", "salida"],
    salida: ["entrada"],
  };

  return (allowed[lastType] || []).includes(nextType);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const empleadoId = String(body?.empleado_id || "");
    const pin = String(body?.pin || "");
    const tipoEvento = String(body?.tipo_evento || "") as
      | "entrada"
      | "salida"
      | "break_out"
      | "break_in";
    const fotoBase64 = String(body?.foto_base64 || "");
    const dispositivoId = String(body?.dispositivo_id || "");

    if (!empleadoId) {
      return NextResponse.json({ error: "Empleado requerido" }, { status: 400 });
    }

    if (!["entrada", "salida", "break_out", "break_in"].includes(tipoEvento)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }

    if (!pin || pin.length !== 4) {
      return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
    }

    if (!fotoBase64.startsWith("data:image/")) {
      return NextResponse.json({ error: "La foto es obligatoria" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: empleadoData, error: empleadoError } = await supabase
      .from("empleados")
      .select("*")
      .eq("id", empleadoId)
      .eq("activo", true)
      .single();

    if (empleadoError || !empleadoData) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const empleado = empleadoData as Empleado;

    if (String(empleado.pin) !== pin) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    const { fecha, dia } = getMexicoDateParts(new Date());

    const descanso = Array.isArray(empleado.dias_descanso_json)
      ? empleado.dias_descanso_json.includes(dia)
      : false;

    const horarioDia = empleado.horario_json?.[dia] || null;

    if (descanso || !horarioDia) {
      return NextResponse.json(
        { error: "Hoy es día no laborable para este empleado" },
        { status: 400 }
      );
    }

    const dayStart = `${fecha}T00:00:00.000Z`;
    const dayEnd = `${fecha}T23:59:59.999Z`;

    const { data: eventosDiaData, error: eventosDiaError } = await supabase
      .from("asistencias_eventos")
      .select("*")
      .eq("empleado_id", empleado.id)
      .gte("timestamp_evento", dayStart)
      .lte("timestamp_evento", dayEnd)
      .order("timestamp_evento", { ascending: true });

    if (eventosDiaError) {
      console.log(eventosDiaError);
      return NextResponse.json(
        { error: "No se pudo validar la secuencia del día" },
        { status: 500 }
      );
    }

    const eventosDia = ((eventosDiaData as Evento[]) || []);
    const ultimoEvento = eventosDia.length > 0 ? eventosDia[eventosDia.length - 1] : null;

    if (!isAllowedSequence(ultimoEvento?.tipo_evento || null, tipoEvento)) {
      return NextResponse.json(
        { error: "Secuencia no permitida para este movimiento" },
        { status: 400 }
      );
    }

    const { buffer } = dataUrlToBuffer(fotoBase64);
    const timestamp = new Date().toISOString();
    const filePath = `${empleado.id}/${fecha}/${timestamp.replaceAll(":", "-")}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("asistencias-fotos")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.log(uploadError);
      return NextResponse.json(
        { error: "No se pudo subir la foto" },
        { status: 500 }
      );
    }

    const { data: signedData } = await supabase.storage
      .from("asistencias-fotos")
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);

    const fotoUrl = signedData?.signedUrl || null;

    const { error: insertError } = await supabase
      .from("asistencias_eventos")
      .insert([
        {
          empleado_id: empleado.id,
          tipo_evento: tipoEvento,
          timestamp_evento: timestamp,
          foto_url: fotoUrl,
          dispositivo_id: dispositivoId || null,
        },
      ]);

    if (insertError) {
      console.log(insertError);
      return NextResponse.json(
        { error: "No se pudo guardar el evento" },
        { status: 500 }
      );
    }

    const { data: eventosActualizadosData, error: eventosActualizadosError } =
      await supabase
        .from("asistencias_eventos")
        .select("*")
        .eq("empleado_id", empleado.id)
        .gte("timestamp_evento", dayStart)
        .lte("timestamp_evento", dayEnd)
        .order("timestamp_evento", { ascending: true });

    if (eventosActualizadosError) {
      console.log(eventosActualizadosError);
      return NextResponse.json(
        { error: "Evento guardado, pero no se pudo recalcular resumen" },
        { status: 500 }
      );
    }

    const resumen = buildSummary(
      empleado,
      fecha,
      (eventosActualizadosData as Evento[]) || []
    );

    const { error: resumenError } = await supabase
      .from("asistencias_resumen")
      .upsert(
        [
          {
            empleado_id: empleado.id,
            fecha,
            hora_entrada: resumen.hora_entrada,
            hora_salida: resumen.hora_salida,
            minutos_retardo: resumen.minutos_retardo,
            minutos_fuera: resumen.minutos_fuera,
            minutos_extra: resumen.minutos_extra,
            total_eventos: resumen.total_eventos,
            estatus: resumen.estatus,
            updated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "empleado_id,fecha",
        }
      );

    if (resumenError) {
      console.log(resumenError);
      return NextResponse.json(
        { error: "Evento guardado, pero falló resumen" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Asistencia registrada correctamente",
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error inesperado en asistencia" },
      { status: 500 }
    );
  }
}