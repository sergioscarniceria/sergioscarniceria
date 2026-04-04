import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("asistencias_eventos")
      .select(`
        *,
        empleados (
          nombre
        )
      `)
      .order("timestamp_evento", { ascending: false })
      .limit(100);

    if (error) {
      console.log(error);
      return NextResponse.json(
        { error: "Error al obtener asistencias" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}