import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getCutoffIso(days: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString();
}

function extractStoragePathFromSignedUrl(url: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Ejemplo:
    // /storage/v1/object/sign/asistencias-fotos/<path>?token=...
    const marker = "/storage/v1/object/sign/asistencias-fotos/";
    const idx = parsed.pathname.indexOf(marker);

    if (idx === -1) return null;

    const encodedPath = parsed.pathname.slice(idx + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Permite ejecución manual local sin secret, pero en producción exige secret si existe
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getSupabaseAdmin();
    const cutoffIso = getCutoffIso(20);

    const { data: oldRows, error: fetchError } = await supabase
      .from("asistencias_eventos")
      .select("id, foto_url, timestamp_evento")
      .not("foto_url", "is", null)
      .lt("timestamp_evento", cutoffIso)
      .limit(1000);

    if (fetchError) {
      console.log(fetchError);
      return NextResponse.json(
        { error: "No se pudieron consultar fotos antiguas" },
        { status: 500 }
      );
    }

    const rows = oldRows || [];

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay fotos para limpiar",
        deletedFiles: 0,
        updatedRows: 0,
      });
    }

    const filesToDelete = rows
      .map((row) => extractStoragePathFromSignedUrl(row.foto_url))
      .filter(Boolean) as string[];

    let deletedFiles = 0;

    if (filesToDelete.length > 0) {
      const { data: removedData, error: removeError } = await supabase.storage
        .from("asistencias-fotos")
        .remove(filesToDelete);

      if (removeError) {
        console.log(removeError);
        return NextResponse.json(
          { error: "No se pudieron borrar archivos del bucket" },
          { status: 500 }
        );
      }

      deletedFiles = removedData?.length || filesToDelete.length;
    }

    const rowIds = rows.map((row) => row.id);

    const { error: updateError } = await supabase
      .from("asistencias_eventos")
      .update({
        foto_url: null,
      })
      .in("id", rowIds);

    if (updateError) {
      console.log(updateError);
      return NextResponse.json(
        { error: "Se borraron archivos, pero falló actualizar la base" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Limpieza completada",
      deletedFiles,
      updatedRows: rowIds.length,
      cutoffIso,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error inesperado al limpiar fotos" },
      { status: 500 }
    );
  }
}