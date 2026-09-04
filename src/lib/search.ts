/**
 * Normalizacion canonica para TODOS los buscadores del sistema.
 *
 * Resuelve tres problemas reales que teniamos:
 *  1. Acentos: buscar "jose" debe encontrar "José"
 *  2. Mayusculas: "MONTEBELLO" = "montebello"
 *  3. Espacios de mas: varios clientes se dieron de alta con doble espacio
 *     ("Manuel  Marin Vega"), y al escribir el nombre normal no aparecian.
 *
 * NO se limpian los nombres en la base de datos a proposito: los pedidos
 * guardan el nombre del cliente como texto, asi que renombrarlos partiria
 * el historial en dos. Se normaliza al comparar, no al guardar.
 */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, " ")            // colapsa espacios repetidos
    .trim();
}

/**
 * ¿El texto contiene lo que se busca? Tolerante a acentos y espacios.
 * Si la busqueda trae varias palabras, todas deben aparecer (en cualquier orden),
 * para que "vega manuel" tambien encuentre a "Manuel Marin Vega".
 */
export function coincide(texto: string | null | undefined, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda);
  if (!q) return true;
  const t = normalizarBusqueda(texto);
  if (!t) return false;
  if (t.includes(q)) return true;
  const palabras = q.split(" ").filter(Boolean);
  return palabras.length > 1 && palabras.every((p) => t.includes(p));
}

/** Igual que `coincide` pero contra varios campos (nombre, negocio, telefono…). */
export function coincideEnAlguno(
  campos: (string | null | undefined)[],
  busqueda: string
): boolean {
  const q = normalizarBusqueda(busqueda);
  if (!q) return true;
  if (campos.some((c) => coincide(c, busqueda))) return true;
  // Ultimo intento: concatenar todo (por si el nombre esta partido en 2 campos)
  return coincide(campos.filter(Boolean).join(" "), busqueda);
}
