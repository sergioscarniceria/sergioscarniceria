import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/proveedores/setup?secret=<ADMIN_SECRET>
 * Inserta proveedores iniciales y datos base.
 * Las tablas deben crearse primero en Supabase SQL Editor.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseClient();

  const defaults = [
    { name: "Sergio Vega Marín", type: "interno", phone: null, notes: "Reembolsos y gastos personales por la empresa" },
    { name: "Pepe", type: "puerco", phone: null, notes: null },
    { name: "Tello", type: "puerco", phone: null, notes: null },
    { name: "Octavio", type: "res", phone: null, notes: null },
    { name: "Emanuel Pedraza", type: "res", phone: null, notes: null },
  ];

  const { data, error } = await supabase
    .from("suppliers")
    .upsert(defaults, { onConflict: "name" })
    .select();

  if (error) {
    return NextResponse.json({
      error: error.message,
      sql: SQL_TABLES,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, suppliers: data, message: "Proveedores configurados correctamente" });
}

const SQL_TABLES = `
-- Ejecutar en Supabase SQL Editor ANTES de llamar este endpoint:

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('interno', 'puerco', 'res')),
  phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS livestock_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folio text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  date date NOT NULL,
  animal_type text NOT NULL CHECK (animal_type IN ('puerco', 'res')),
  animal_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pesado', 'completo')),
  price_per_kg_live numeric NOT NULL,
  live_weight_kg numeric,
  total_live numeric,
  canal_weight_kg numeric,
  slaughter_cost numeric DEFAULT 0,
  freight_cost numeric DEFAULT 0,
  total_cost numeric,
  yield_pct numeric,
  cost_per_kg_canal numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folio text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  date date NOT NULL,
  concept text NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folio text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  date date NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'transferencia', 'otro')),
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);
`;
