import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    // Si hay una sesión de empleado guardada, supabase-js la recupera solo y
    // la manda en cada consulta. Si no hay, va como anónimo (páginas públicas).
    // La renueva sola antes de que expire: una cajera puede dejar la caja
    // abierta todo el turno sin que se le caiga nada.
    // Misma clave de almacenamiento que ya usa el portal de clientes: un
    // navegador tiene una sesión a la vez (empleado en caja, o cliente en su
    // portal), y así nadie pierde la que ya tenía guardada.
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

type SesionEmpleado = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
} | null | undefined;

/**
 * Se llama justo después de que el servidor validó el PIN.
 * Deja la identidad del empleado activa en el cliente de Supabase.
 * Si no llegó sesión (o falla), no pasa nada: se sigue como hasta hoy.
 */
export async function activarSesionEmpleado(session: SesionEmpleado) {
  if (!session?.access_token || !session?.refresh_token) return false;
  try {
    const { error } = await getSupabaseClient().auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Al cerrar sesión de PIN, también se cierra la identidad en Supabase. */
export async function cerrarSesionEmpleado() {
  try {
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } catch {
    // sin sesión, no hay nada que cerrar
  }
}
