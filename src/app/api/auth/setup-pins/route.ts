import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * POST /api/auth/setup-pins?secret=sergios2026
 * Crea la tabla app_pins e inserta los 3 roles con PINs por defecto.
 * Solo ejecutar UNA vez.
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== "sergios2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseClient();

  // Crear tabla si no existe
  const { error: createError } = await supabase.rpc("exec_sql", {
    query: `
      CREATE TABLE IF NOT EXISTS app_pins (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        role text UNIQUE NOT NULL,
        pin text NOT NULL,
        label text NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `,
  });

  // Si no existe la función exec_sql, intentar con SQL directo vía REST
  if (createError) {
    // Fallback: insertar directamente (la tabla debería crearse desde Supabase dashboard)
    console.log("Nota: crear la tabla manualmente en Supabase si no existe.", createError.message);
  }

  // Insertar PINs por defecto (upsert para no duplicar)
  const defaults = [
    { role: "admin", pin: "0000", label: "Administrador" },
    { role: "cajera", pin: "1111", label: "Cajera" },
    { role: "empleado", pin: "2222", label: "Empleado" },
  ];

  const { error: upsertError } = await supabase
    .from("app_pins")
    .upsert(defaults, { onConflict: "role" });

  if (upsertError) {
    return NextResponse.json(
      { error: upsertError.message, hint: "Si la tabla no existe, créala manualmente en Supabase con: CREATE TABLE app_pins (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, role text UNIQUE NOT NULL, pin text NOT NULL, label text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "PINs configurados: admin=0000, cajera=1111, empleado=2222. ¡Cámbialos desde el panel admin!" });
}
