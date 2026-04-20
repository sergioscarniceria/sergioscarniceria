/**
 * Secret compartido para autenticación admin.
 * Usado por las páginas del admin para llamar a las API protegidas.
 *
 * NOTA: Este valor ya es público (NEXT_PUBLIC_), así que no hay
 * riesgo adicional al tenerlo aquí. La protección real del admin
 * es el PIN/password de entrada.
 */
export function getAdminSecret(): string {
  // Intentar env var primero, fallback a valor directo
  return process.env.NEXT_PUBLIC_ADMIN_SECRET || "sergios2026";
}
