/**
 * Funcion canonica para calcular subtotal de un item de pedido.
 *
 * Reglas:
 * - Si es PIEZA (sale_type === "pieza" O is_fixed_price_piece): subtotal = quantity × price
 *   - Si quantity es null/undefined, hace fallback a kilos (compat con carts viejos)
 * - Si es KG: subtotal = (prepared_kilos ?? kilos) × price
 *   - prepared_kilos solo aplica en cobranza/produccion (peso real preparado)
 */
export function itemSubtotal(item: {
  kilos?: number | null;
  prepared_kilos?: number | null;
  price?: number | null;
  sale_type?: string | null;
  quantity?: number | null;
  is_fixed_price_piece?: boolean | null;
}): number {
  const price = Number(item.price || 0);
  if (item.sale_type === "pieza" || item.is_fixed_price_piece) {
    const qty = Number(item.quantity ?? item.kilos ?? 0);
    return qty * price;
  }
  const kg = Number(item.prepared_kilos ?? item.kilos ?? 0);
  return kg * price;
}
