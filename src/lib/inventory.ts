import type { SupabaseClient } from "@supabase/supabase-js";

export type SaleItemForInventory = {
  product?: string | null;
  sale_type?: string | null;
  quantity?: number | null;
  kilos?: number | null;
  is_fixed_price_piece?: boolean | null;
};

export type InventoryDiscountResult = {
  descontados: { product: string; qty: number; from: number; to: number }[];
  omitidos: { product: string; motivo: string }[];
};

/**
 * Descuenta inventario para los items de una venta.
 *
 * Reglas:
 * - Solo descuenta productos de categoria "Complementos" o con fixed_piece_price > 0
 * - Respeta inventory_link_product_id (inventario unificado, ej. cabezas)
 * - Match de producto por nombre normalizado (case-insensitive, sin espacios extra)
 * - Registra cada movimiento en inventory_movements
 * - NO permite stock por debajo de cero cuando la venta viene de un flujo automatico
 *
 * Es idempotente por llamada: si el mismo ticket se procesa dos veces, descontara dos veces.
 * Por eso solo debe llamarse en el momento en que la venta se completa.
 */
export async function descontarInventarioDeVenta(
  supabase: SupabaseClient,
  items: SaleItemForInventory[],
  opts: {
    referencia: string;          // ej. "ticket a1b2c3" o "nota NC-2026..."
    createdBy?: string | null;   // cajera/usuario
    permitirNegativo?: boolean;  // default true (para no bloquear ventas)
  }
): Promise<InventoryDiscountResult> {
  const result: InventoryDiscountResult = { descontados: [], omitidos: [] };
  const permitirNegativo = opts.permitirNegativo !== false;

  for (const item of items) {
    const rawName = (item.product || "").trim();
    if (!rawName) {
      result.omitidos.push({ product: "(sin nombre)", motivo: "item sin producto" });
      continue;
    }

    // Cantidad a descontar: quantity si es pieza, si no kilos
    const esPieza = item.sale_type === "pieza" || !!item.is_fixed_price_piece;
    const qty = Number(esPieza ? (item.quantity ?? item.kilos ?? 0) : (item.kilos ?? 0));
    if (!qty || qty <= 0) {
      continue; // nada que descontar
    }

    // Buscar producto por nombre exacto primero, luego case-insensitive
    type ProdRow = {
      id: string;
      name: string;
      stock: number | null;
      category: string | null;
      fixed_piece_price: number | null;
      inventory_link_product_id: string | null;
    };
    let prod: ProdRow | null = null;

    const { data: exact } = await supabase
      .from("products")
      .select("id, name, stock, category, fixed_piece_price, inventory_link_product_id")
      .eq("name", rawName)
      .limit(1);

    if (exact && exact.length > 0) {
      prod = exact[0] as unknown as ProdRow;
    } else {
      const { data: ilike } = await supabase
        .from("products")
        .select("id, name, stock, category, fixed_piece_price, inventory_link_product_id")
        .ilike("name", rawName)
        .limit(1);
      if (ilike && ilike.length > 0) prod = ilike[0] as unknown as ProdRow;
    }

    if (!prod) {
      result.omitidos.push({ product: rawName, motivo: "producto no existe en catalogo" });
      continue;
    }

    // Solo llevan inventario los complementos / productos por pieza con precio fijo
    const llevaInventario =
      prod.category === "Complementos" ||
      (prod.fixed_piece_price !== null && Number(prod.fixed_piece_price) > 0);

    if (!llevaInventario) {
      continue; // carne a granel no lleva stock por pieza
    }

    // Resolver inventario unificado
    let targetId = prod.id;
    let targetName = prod.name;
    let prevStock = Number(prod.stock || 0);

    if (prod.inventory_link_product_id) {
      const { data: master } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", prod.inventory_link_product_id)
        .limit(1);
      if (master && master.length > 0) {
        const m = master[0] as unknown as { id: string; name: string; stock: number | null };
        targetId = m.id;
        targetName = m.name;
        prevStock = Number(m.stock || 0);
      }
    }

    const rawNew = prevStock - qty;
    const newStock = permitirNegativo ? rawNew : Math.max(0, rawNew);

    const { error: updErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", targetId);

    if (updErr) {
      result.omitidos.push({ product: rawName, motivo: `error al actualizar stock: ${updErr.message}` });
      continue;
    }

    await supabase.from("inventory_movements").insert({
      item_type: "complemento",
      item_id: targetId,
      movement_type: "salida",
      quantity: qty,
      previous_stock: prevStock,
      new_stock: newStock,
      notes:
        prod.id === targetId
          ? `Venta ${opts.referencia}`
          : `Venta ${opts.referencia} (vendido como ${prod.name})`,
      created_by: opts.createdBy || "sistema",
    });

    result.descontados.push({
      product: targetName,
      qty,
      from: prevStock,
      to: newStock,
    });
  }

  return result;
}

/**
 * Devuelve al inventario los items de una venta que se cancela.
 *
 * Es el espejo exacto de descontarInventarioDeVenta: mismas reglas de match,
 * mismo respeto a inventory_link_product_id, mismo filtro de que productos
 * llevan stock. Registra el movimiento como "entrada".
 *
 * IMPORTANTE: solo debe llamarse UNA vez por cancelacion. Si se llama dos
 * veces devolvera el doble.
 */
export async function reponerInventarioDeVenta(
  supabase: SupabaseClient,
  items: SaleItemForInventory[],
  opts: {
    referencia: string;
    createdBy?: string | null;
  }
): Promise<InventoryDiscountResult> {
  const result: InventoryDiscountResult = { descontados: [], omitidos: [] };

  for (const item of items) {
    const rawName = (item.product || "").trim();
    if (!rawName) continue;

    const esPieza = item.sale_type === "pieza" || !!item.is_fixed_price_piece;
    const qty = Number(esPieza ? (item.quantity ?? item.kilos ?? 0) : (item.kilos ?? 0));
    if (!qty || qty <= 0) continue;

    type ProdRow = {
      id: string;
      name: string;
      stock: number | null;
      category: string | null;
      fixed_piece_price: number | null;
      inventory_link_product_id: string | null;
    };
    let prod: ProdRow | null = null;

    const { data: exact } = await supabase
      .from("products")
      .select("id, name, stock, category, fixed_piece_price, inventory_link_product_id")
      .eq("name", rawName)
      .limit(1);

    if (exact && exact.length > 0) {
      prod = exact[0] as unknown as ProdRow;
    } else {
      const { data: ilike } = await supabase
        .from("products")
        .select("id, name, stock, category, fixed_piece_price, inventory_link_product_id")
        .ilike("name", rawName)
        .limit(1);
      if (ilike && ilike.length > 0) prod = ilike[0] as unknown as ProdRow;
    }

    if (!prod) {
      result.omitidos.push({ product: rawName, motivo: "producto no existe en catalogo" });
      continue;
    }

    const llevaInventario =
      prod.category === "Complementos" ||
      (prod.fixed_piece_price !== null && Number(prod.fixed_piece_price) > 0);

    if (!llevaInventario) continue;

    let targetId = prod.id;
    let targetName = prod.name;
    let prevStock = Number(prod.stock || 0);

    if (prod.inventory_link_product_id) {
      const { data: master } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", prod.inventory_link_product_id)
        .limit(1);
      if (master && master.length > 0) {
        const m = master[0] as unknown as { id: string; name: string; stock: number | null };
        targetId = m.id;
        targetName = m.name;
        prevStock = Number(m.stock || 0);
      }
    }

    const newStock = prevStock + qty;

    const { error: updErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", targetId);

    if (updErr) {
      result.omitidos.push({ product: rawName, motivo: `error al reponer stock: ${updErr.message}` });
      continue;
    }

    await supabase.from("inventory_movements").insert({
      item_type: "complemento",
      item_id: targetId,
      movement_type: "entrada",
      quantity: qty,
      previous_stock: prevStock,
      new_stock: newStock,
      notes:
        prod.id === targetId
          ? `Devolucion por cancelacion ${opts.referencia}`
          : `Devolucion por cancelacion ${opts.referencia} (vendido como ${prod.name})`,
      created_by: opts.createdBy || "sistema",
    });

    result.descontados.push({ product: targetName, qty, from: prevStock, to: newStock });
  }

  return result;
}
