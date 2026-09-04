/**
 * Funcion canonica para calcular el subtotal de un renglon de pedido.
 *
 * REGLA DE ORO (4 sep 2026, confirmada por Sergio):
 *
 *   El cliente puede PEDIR por piezas ("quiero 10 sirloins"), pero si el
 *   producto se vende por kilo, el COBRO sale del peso real que registro
 *   el carnicero. El gramaje varia, asi que las piezas son solo la cantidad
 *   solicitada, nunca la base del cobro.
 *
 *   Solo se cobra por pieza cuando el producto tiene PRECIO FIJO POR PIEZA
 *   en el catalogo (mariscos, hielo, cafe, refrescos, tacos...). Eso lo
 *   marca `is_fixed_price_piece`.
 *
 * Antes esta funcion cobraba por pieza en cuanto veia `sale_type === "pieza"`,
 * y multiplicaba las piezas por el precio del KILO. Un pedido de 10 sirloins
 * que pesaba 2.5 kg se cobraba a $3,380 en vez de $845.
 *
 * OJO: nunca devuelve 0 para un renglon por pieza sin pesar. Devuelve el
 * estimado por piezas para que el ticket no muestre $0 (regla absoluta de
 * Sergio), pero `requierePeso()` marca ese renglon para que caja lo bloquee.
 */
export type ItemCobrable = {
  kilos?: number | null;
  prepared_kilos?: number | null;
  price?: number | null;
  sale_type?: string | null;
  quantity?: number | null;
  is_fixed_price_piece?: boolean | null;
};

export function itemSubtotal(item: ItemCobrable): number {
  const price = Number(item.price || 0);

  // Producto con precio fijo por pieza: el peso no importa
  if (item.is_fixed_price_piece) {
    const qty = Number(item.quantity ?? item.kilos ?? 0);
    return qty * price;
  }

  // Producto por kilo pedido en piezas: manda la bascula
  if (item.sale_type === "pieza") {
    const pesado = Number(item.prepared_kilos ?? 0);
    if (pesado > 0) return pesado * price;

    const kg = Number(item.kilos ?? 0);
    if (kg > 0) return kg * price;

    // Todavia sin pesar: estimado por piezas para no mostrar $0.
    // requierePeso() impide que se cobre asi.
    return Number(item.quantity ?? 0) * price;
  }

  // Producto por kilo normal
  const kg = Number(item.prepared_kilos ?? item.kilos ?? 0);
  return kg * price;
}

/**
 * ¿Este renglon todavia no se puede cobrar porque falta pesarlo?
 * Cierto solo para productos POR KILO que se pidieron por piezas
 * y que nadie ha pasado por la bascula.
 */
export function requierePeso(item: ItemCobrable): boolean {
  if (item.is_fixed_price_piece) return false;
  if (item.sale_type !== "pieza") return false;
  const pesado = Number(item.prepared_kilos ?? 0);
  const kg = Number(item.kilos ?? 0);
  return pesado <= 0 && kg <= 0;
}

/** Lista de productos de un pedido que aun no se pueden cobrar por falta de peso. */
export function itemsSinPesar<T extends ItemCobrable & { product?: string | null }>(
  items: T[]
): T[] {
  return (items || []).filter(requierePeso);
}
