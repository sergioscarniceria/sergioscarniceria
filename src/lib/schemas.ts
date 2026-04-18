import { z } from "zod";

// ── Auth ──
export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN debe ser de 4 dígitos"),
});

export const updatePinSchema = z.object({
  role: z.string().min(1, "role requerido"),
  pin: z.string().regex(/^\d{4}$/, "PIN debe ser de 4 dígitos"),
});

// ── Orders / Ventas ──
export const orderItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  product_name: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  weight_kg: z.number().min(0).optional(),
  sell_by: z.enum(["kg", "pieza"]).optional(),
});

export const createOrderSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, "Se requiere al menos un producto"),
  notes: z.string().optional().nullable(),
  delivery_date: z.string().optional().nullable(),
  type: z.enum(["mostrador", "pedido", "manual"]).optional(),
});

// ── Caja ──
export const cashMovementSchema = z.object({
  type: z.enum(["apertura", "ingreso", "gasto", "retiro", "cierre", "reconteo"]),
  amount: z.number(),
  description: z.string().optional().nullable(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia"]).optional(),
});

// ── CxC ──
export const cxcPaymentSchema = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().positive("Monto debe ser positivo"),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia"]),
  notes: z.string().optional().nullable(),
});

// ── Recetario ──
export const recipeIngredientSchema = z.object({
  ingredient_name: z.string().min(1),
  quantity_kg: z.number().positive(),
  unit: z.string().min(1),
  unit_price: z.number().min(0),
});

export const createRecipeSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  type: z.enum(["marinado", "preparacion", "otro"]),
  description: z.string().optional().nullable(),
  yield_kg: z.number().positive().optional().nullable(),
  ingredients: z.array(recipeIngredientSchema).optional(),
});

// ── Portal ──
export const portalRegistroSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional().nullable(),
});

// ── Mercado Pago Webhook ──
export const mpWebhookSchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.union([z.string(), z.number()]).optional(),
  }).optional(),
}).passthrough(); // MP sends extra fields

/**
 * Helper to validate request body with a Zod schema.
 * Returns { data } on success or { error, status: 400 } on failure.
 */
export function validateBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join(", ");
    return { error: msg };
  }
  return { data: result.data };
}
