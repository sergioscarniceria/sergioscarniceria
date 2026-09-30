/**
 * Verifica un código de empleado (4 dígitos) preguntándole al servidor.
 *
 * Reemplaza las consultas directas a la tabla `employee_codes` que hacían
 * las pantallas desde el navegador. La forma de uso es la misma: devuelve
 * { name, code, role } si el código es válido, o null si no.
 *
 * `roles` es opcional: si se pasa, el código debe ser de uno de esos roles
 * (un admin siempre pasa).
 */
export async function verificarCodigoEmpleado(
  code: string,
  roles?: string[]
): Promise<{ name: string; code: string; role: string } | null> {
  const limpio = String(code || "").trim();
  if (!/^\d{4}$/.test(limpio)) return null;

  try {
    const res = await fetch("/api/auth/verify-employee-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: limpio, roles }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { name: String(data.name || ""), code: limpio, role: String(data.role || "") };
  } catch {
    return null;
  }
}
