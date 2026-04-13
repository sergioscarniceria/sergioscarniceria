import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(req.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");

    if (!desde || !hasta) {
      return NextResponse.json(
        { error: "Se requieren parámetros desde y hasta" },
        { status: 400 }
      );
    }

    // Traer resúmenes diarios con datos de empleado
    const { data: resumenes, error: resumenError } = await supabase
      .from("asistencias_resumen")
      .select(`
        *,
        empleados (
          id,
          nombre,
          rol,
          horario_json,
          dias_descanso_json
        )
      `)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true });

    if (resumenError) {
      console.log(resumenError);
      return NextResponse.json(
        { error: "Error al obtener resúmenes" },
        { status: 500 }
      );
    }

    // Traer eventos detallados del rango para el desglose
    const { data: eventos, error: eventosError } = await supabase
      .from("asistencias_eventos")
      .select(`
        id,
        empleado_id,
        tipo_evento,
        timestamp_evento,
        foto_url,
        empleados (
          nombre
        )
      `)
      .gte("timestamp_evento", `${desde}T00:00:00`)
      .lte("timestamp_evento", `${hasta}T23:59:59`)
      .order("timestamp_evento", { ascending: true });

    if (eventosError) {
      console.log(eventosError);
      return NextResponse.json(
        { error: "Error al obtener eventos" },
        { status: 500 }
      );
    }

    // Traer lista de empleados activos
    const { data: empleados, error: empError } = await supabase
      .from("empleados")
      .select("id, nombre, rol, activo, horario_json, dias_descanso_json")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (empError) {
      console.log(empError);
      return NextResponse.json(
        { error: "Error al obtener empleados" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      resumenes: resumenes || [],
      eventos: eventos || [],
      empleados: empleados || [],
    });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
