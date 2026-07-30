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

/**
 * DELETE /api/admin/productos
 * Body: { product_id }
 * Elimina un producto SOLO si no tiene ventas historicas.
 * Si tiene ventas, devuelve error explicando por que no se puede.
 */
export async function DELETE(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const productId = body.product_id as string | undefined;
    if (!productId) {
      return NextResponse.json({ error: "Falta product_id" }, { status: 400 });
    }

    const sb = adminClient();

    // Buscar el producto
    const { data: product, error: findErr } = await sb
      .from("products")
      .select("id, name")
      .eq("id", productId)
      .single();

    if (findErr || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Verificar si tiene ventas historicas (por nombre, que es como se guarda en order_items)
    const { count: ventasCount } = await sb
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product", product.name);

    // Verificar si hay OTROS productos con el mismo nombre (duplicados)
    const { data: mismosNombre } = await sb
      .from("products")
      .select("id")
      .eq("name", product.name);
    const esDuplicado = (mismosNombre?.length || 0) > 1;

    // Si tiene ventas Y no es duplicado, no se puede borrar (perderiamos historial)
    if ((ventasCount || 0) > 0 && !esDuplicado) {
      return NextResponse.json(
        {
          error: `No se puede eliminar "${product.name}": tiene ${ventasCount} venta(s) en el historial. Desactívalo en su lugar para conservar los reportes.`,
          ventas: ventasCount,
        },
        { status: 409 }
      );
    }

    // Limpiar referencias de inventario vinculado
    await sb.from("products").update({ inventory_link_product_id: null }).eq("inventory_link_product_id", productId);

    // Borrar movimientos de inventario asociados
    await sb.from("inventory_movements").delete().eq("item_id", productId);

    // Borrar el producto
    const { error: delErr } = await sb.from("products").delete().eq("id", productId);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted: product.name,
      era_duplicado: esDuplicado,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
