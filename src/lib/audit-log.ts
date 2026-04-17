import { getSupabaseClient } from "@/lib/supabase";

export type AuditAction =
  | "cobro_efectivo"
  | "cobro_tarjeta"
  | "cobro_transferencia"
  | "cobro_credito"
  | "cancelar_ticket"
  | "apertura_caja"
  | "cierre_caja"
  | "reconteo"
  | "gasto_registrado"
  | "retiro_caja"
  | "venta_manual"
  | "pin_changed"
  | "cxc_pago"
  | "cxc_nota_creada"
  | "orden_creada"
  | "orden_editada"
  | "reimpresion";

type AuditEntry = {
  action: AuditAction;
  user_role?: string;
  user_label?: string;
  entity_type?: string; // "order", "cash_movement", "cxc_note", etc.
  entity_id?: string;
  amount?: number;
  details?: Record<string, unknown>;
  ip?: string;
};

/**
 * Log an audit entry to the audit_log table.
 * Fire-and-forget: never blocks the main flow.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("audit_log").insert({
      action: entry.action,
      user_role: entry.user_role || null,
      user_label: entry.user_label || null,
      entity_type: entry.entity_type || null,
      entity_id: entry.entity_id || null,
      amount: entry.amount || null,
      details: entry.details || null,
      ip: entry.ip || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Never let audit failures break the main flow
    console.error("Audit log error:", err);
  }
}
