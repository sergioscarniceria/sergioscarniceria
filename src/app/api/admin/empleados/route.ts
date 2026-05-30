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

/** GET /api/admin/empleados — lista TODOS los empleados (activos e inactivos) */
export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const sb = adminClient();
    const { data, error } = await sb
      .from("empleados")
      .select("*")
      .order("nombre", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/empleados — crear empleado */
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const sb = adminClient();

    // Verificar PIN único
    if (body.pin) {
      const { data: exists } = await sb
        .from("empleados")
        .select("id")
        .eq("pin", body.pin)
        .maybeSingle();
      if (exists) {
        return NextResponse.json({ error: "Ese PIN ya está en uso" }, { status: 400 });
      }
    }

    const { data, error } = await sb
      .from("empleados")
      .insert([body])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Sincronizar con employee_codes si hay PIN
    if (body.pin) {
      const roleMap: Record<string, string> = {
        caja: "cajera",
        carniceria: "carnicero",
        administracion: "admin",
        mostrador: "mostrador",
      };
      const codeRole = roleMap[body.rol] || body.rol;
      await sb.from("employee_codes").upsert(
        { name: body.nombre, role: codeRole, code: body.pin, is_active: body.activo ?? true },
        { onConflict: "code" }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT /api/admin/empleados — actualizar empleado { id, ...campos } */
export async function PUT(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const sb = adminClient();

    // Verificar PIN único (excluyendo el actual)
    if (updates.pin) {
      const { data: exists } = await sb
        .from("empleados")
        .select("id")
        .eq("pin", updates.pin)
        .neq("id", id)
        .maybeSingle();
      if (exists) {
        return NextResponse.json({ error: "Ese PIN ya está en uso por otro empleado" }, { status: 400 });
      }
    }

    const { data, error } = await sb
      .from("empleados")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Sincronizar con employee_codes
    if (updates.pin) {
      const roleMap: Record<string, string> = {
        caja: "cajera",
        carniceria: "carnicero",
        administracion: "admin",
        mostrador: "mostrador",
      };
      const codeRole = roleMap[updates.rol] || updates.rol;
      const { data: existCode } = await sb
        .from("employee_codes")
        .select("id")
        .eq("code", updates.pin)
        .maybeSingle();
      if (existCode) {
        await sb.from("employee_codes")
          .update({ name: updates.nombre, role: codeRole, is_active: updates.activo ?? true })
          .eq("id", existCode.id);
      } else {
        await sb.from("employee_codes")
          .insert([{ name: updates.nombre, role: codeRole, code: updates.pin, is_active: updates.activo ?? true }]);
      }
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/empleados — desactivar/reactivar { id, activo } */
export async function PATCH(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id, activo } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const sb = adminClient();
    const { data: emp } = await sb.from("empleados").select("pin").eq("id", id).single();
    const { error } = await sb.from("empleados").update({ activo }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (emp?.pin) {
      await sb.from("employee_codes").update({ is_active: activo }).eq("code", emp.pin);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
