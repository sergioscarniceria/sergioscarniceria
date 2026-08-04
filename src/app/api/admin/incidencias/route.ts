import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAuthorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return auth === secret;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** GET — lista incidencias de un empleado (o todas del mes) */
export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const url = new URL(req.url);
    const empleadoId = url.searchParams.get("empleado_id");
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");

    const sb = adminClient();
    let q = sb
      .from("employee_incidents")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(500);

    if (empleadoId) q = q.eq("empleado_id", empleadoId);
    if (desde) q = q.gte("fecha", desde);
    if (hasta) q = q.lte("fecha", hasta);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST — registrar incidencia manual */
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { empleado_id, tipo, fecha, motivo, minutos_retardo, registrado_por } = body;

    if (!empleado_id || !tipo) {
      return NextResponse.json({ error: "Faltan empleado_id y tipo" }, { status: 400 });
    }
    const tiposValidos = ["retardo", "amonestacion", "falta", "enfermedad", "carta"];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const sb = adminClient();

    // Validar limite de dias de enfermedad (3 por año)
    if (tipo === "enfermedad") {
      const anio = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
      const { count } = await sb
        .from("employee_incidents")
        .select("id", { count: "exact", head: true })
        .eq("empleado_id", empleado_id)
        .eq("tipo", "enfermedad")
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`);

      if ((count || 0) >= 3) {
        return NextResponse.json(
          { error: "Este empleado ya usó sus 3 días de enfermedad del año" },
          { status: 409 }
        );
      }
    }

    const { data, error } = await sb
      .from("employee_incidents")
      .insert([{
        empleado_id,
        tipo,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        motivo: motivo || null,
        minutos_retardo: tipo === "retardo" ? (minutos_retardo || null) : null,
        origen: "manual",
        registrado_por: registrado_por || "admin",
      }])
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ incidencia: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE — eliminar incidencia */
export async function DELETE(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const sb = adminClient();
    const { error } = await sb.from("employee_incidents").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
