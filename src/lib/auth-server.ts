/**
 * Autenticación de empleados del lado del servidor.
 *
 * El empleado sigue tecleando su PIN de 4 dígitos en la misma pantalla de
 * siempre. Lo que cambia es lo que pasa por detrás: el PIN se valida aquí,
 * con la llave de servidor (nunca desde el navegador), y a cambio se le da
 * una sesión real de Supabase Auth con su rol. Así la base de datos sabe
 * QUIÉN está conectado, y eso es lo que permite cerrarle la puerta a
 * cualquiera que no sea empleado.
 *
 * Cada PIN / código tiene un usuario "invisible" en Supabase Auth con un
 * correo interno que nadie usa (xxx@sergioscarniceria.local). Se crea la
 * primera vez que alguien entra con ese PIN y de ahí en adelante se reutiliza.
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

export const DOMINIO_INTERNO = "sergioscarniceria.local";

export type IdentidadEmpleado = {
  role: string;
  label: string;          // "Cajera", "Celeste", "Administrador"...
  name: string;           // nombre propio si viene de employee_codes, si no ""
  source: "app_pins" | "employee_codes";
  sourceId: string;
};

export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan credenciales de servidor de Supabase");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Busca el PIN primero en app_pins (roles genéricos) y luego en employee_codes
 * (empleados con nombre). Devuelve null si no existe o está inactivo.
 */
export async function identificarPorPin(pin: string): Promise<IdentidadEmpleado | null> {
  const sb = supabaseServidor();

  const { data: appPin } = await sb
    .from("app_pins")
    .select("id, role, label")
    .eq("pin", pin)
    .maybeSingle();

  if (appPin) {
    return {
      role: appPin.role,
      label: appPin.label || appPin.role,
      name: "",
      source: "app_pins",
      sourceId: String(appPin.id),
    };
  }

  const { data: emp } = await sb
    .from("employee_codes")
    .select("id, name, role, is_active")
    .eq("code", pin)
    .maybeSingle();

  if (emp && emp.is_active !== false) {
    return {
      role: emp.role,
      label: emp.name,
      name: emp.name,
      source: "employee_codes",
      sourceId: String(emp.id),
    };
  }

  return null;
}

/** Correo interno determinista por identidad. Nunca recibe correos. */
function correoInterno(id: IdentidadEmpleado) {
  const prefijo = id.source === "app_pins" ? "rol" : "emp";
  return `${prefijo}-${id.sourceId}@${DOMINIO_INTERNO}`;
}

/**
 * Contraseña del usuario invisible. Se DERIVA de la llave de servidor cada
 * vez, no se guarda en ningún lado. Solo el servidor puede calcularla.
 */
function passwordInterna(email: string) {
  const secreto = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createHmac("sha256", secreto).update(`empleado:${email}`).digest("hex");
}

/**
 * Garantiza que exista el usuario de Auth para esta identidad, con su rol
 * en app_metadata (que solo el servidor puede escribir), y devuelve una
 * sesión (access_token + refresh_token) lista para usarse en el navegador.
 */
export async function abrirSesionEmpleado(id: IdentidadEmpleado) {
  const sb = supabaseServidor();
  const email = correoInterno(id);
  const password = passwordInterna(email);

  const metadata = {
    app_role: id.role,
    app_name: id.name || id.label,
    app_source: id.source,
    app_source_id: id.sourceId,
    es_empleado: true,
  };

  // Intento directo de login. Si el usuario ya existe, listo.
  let { data: login, error: loginErr } = await sb.auth.signInWithPassword({ email, password });

  if (loginErr || !login?.session) {
    // No existe (o cambió la llave de servidor): crearlo o reencuadrarlo.
    const { data: lista } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existente = lista?.users?.find((u) => u.email === email);

    if (existente) {
      await sb.auth.admin.updateUserById(existente.id, {
        password,
        email_confirm: true,
        app_metadata: metadata,
      });
    } else {
      const { error: createErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: metadata,
        user_metadata: { nombre: id.name || id.label },
      });
      if (createErr) throw new Error("No se pudo crear la identidad del empleado: " + createErr.message);
    }

    ({ data: login, error: loginErr } = await sb.auth.signInWithPassword({ email, password }));
    if (loginErr || !login?.session) {
      throw new Error("No se pudo abrir la sesión del empleado: " + (loginErr?.message || "sin sesión"));
    }
  } else {
    // Mantener el rol al día por si cambió en la tabla (p. ej. cajera → admin)
    const actual = login.user?.app_metadata || {};
    if (actual.app_role !== metadata.app_role || actual.app_name !== metadata.app_name) {
      await sb.auth.admin.updateUserById(login.user!.id, { app_metadata: metadata });
    }
  }

  return {
    access_token: login.session.access_token,
    refresh_token: login.session.refresh_token,
    expires_at: login.session.expires_at,
  };
}
