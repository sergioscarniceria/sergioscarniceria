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

/** POST /api/admin/empleados-docs — sube archivo al bucket empleados-documentos via service_role */
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const empId = (form.get("emp_id") as string | null) || `nuevo-${Date.now()}`;
    const tipo = (form.get("tipo") as string | null) || "doc";

    if (!file) {
      return NextResponse.json({ error: "Falta archivo" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo excede 10 MB" }, { status: 413 });
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const fileName = `${empId}/${Date.now()}-${tipo}.${ext}`;

    const sb = adminClient();
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from("empleados-documentos")
      .upload(fileName, buf, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const { data: urlData } = sb.storage
      .from("empleados-documentos")
      .getPublicUrl(fileName);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: fileName,
      name: file.name,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/admin/empleados-docs — elimina archivo por path */
export async function DELETE(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const path = body.path as string | undefined;
    if (!path) {
      return NextResponse.json({ error: "Falta path" }, { status: 400 });
    }
    const sb = adminClient();
    const { error } = await sb.storage.from("empleados-documentos").remove([path]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
