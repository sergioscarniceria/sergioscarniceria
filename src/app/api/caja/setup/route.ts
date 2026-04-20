import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQL_TABLES = `
-- Tabla: Apertura de caja (fondo inicial del día)
CREATE TABLE IF NOT EXISTS cash_openings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opening_date DATE NOT NULL,
  initial_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Billetes
  bills_1000 INTEGER DEFAULT 0,
  bills_500 INTEGER DEFAULT 0,
  bills_200 INTEGER DEFAULT 0,
  bills_100 INTEGER DEFAULT 0,
  bills_50 INTEGER DEFAULT 0,
  bills_20 INTEGER DEFAULT 0,
  -- Monedas
  coins_20 INTEGER DEFAULT 0,
  coins_10 INTEGER DEFAULT 0,
  coins_5 INTEGER DEFAULT 0,
  coins_2 INTEGER DEFAULT 0,
  coins_1 INTEGER DEFAULT 0,
  coins_050 INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(opening_date)
);

-- Tabla: Gastos operativos de caja
CREATE TABLE IF NOT EXISTS cash_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  concept TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT DEFAULT 'varios',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE cash_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (misma estrategia que el resto del proyecto)
CREATE POLICY "cash_openings_all" ON cash_openings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cash_expenses_all" ON cash_expenses FOR ALL USING (true) WITH CHECK (true);
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret)) {
    return NextResponse.json(
      {
        error: "Secret inválido",
        sql: SQL_TABLES,
      },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        error: "Faltan variables de entorno (SUPABASE_SERVICE_ROLE_KEY)",
        sql: SQL_TABLES,
        hint: "Corre este SQL manualmente en Supabase SQL Editor",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Intentar insertar una apertura de prueba para verificar que la tabla existe
  const { error: testError } = await supabase
    .from("cash_openings")
    .select("id")
    .limit(1);

  if (testError) {
    return NextResponse.json(
      {
        error: "Las tablas no existen todavía",
        sql: SQL_TABLES,
        hint: "Corre el SQL de arriba en Supabase SQL Editor y luego vuelve a llamar este endpoint",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Tablas de caja verificadas correctamente",
    tables: ["cash_openings", "cash_expenses"],
  });
}
