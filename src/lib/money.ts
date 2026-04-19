/**
 * Utilidades de dinero para todo el sistema.
 * - Siempre redondeamos hacia arriba (ceil) al entero más cercano.
 * - Nunca mostramos decimales en cantidades de dinero al cliente.
 * - Guardamos la diferencia de redondeo para donación.
 */

/** Redondea hacia arriba al entero más cercano */
export function moneyRound(amount: number): number {
  return Math.ceil(amount);
}

/** Muestra dinero sin decimales: "$526" */
export function moneyDisplay(amount: number): string {
  return `$${Math.ceil(amount)}`;
}

/** Calcula la diferencia de redondeo (lo que se cobra de más) */
export function roundingDiff(rawAmount: number): number {
  const rounded = Math.ceil(rawAmount);
  return Number((rounded - rawAmount).toFixed(2));
}

/**
 * Formatea dinero sin símbolo, sin decimales: "526"
 * Útil cuando ya tienes el "$" en el JSX.
 */
export function moneyInt(amount: number): string {
  return String(Math.ceil(amount));
}
