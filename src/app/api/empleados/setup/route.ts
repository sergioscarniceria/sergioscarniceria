import { NextResponse } from "next/server";

export async function GET() {
  const sql = `
-- ============================================
-- CÓDIGOS DE EMPLEADOS (cajeras + carniceros)
-- ============================================

CREATE TABLE IF NOT EXISTS employee_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employee_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_codes_all" ON employee_codes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_emp_codes_code ON employee_codes(code);
CREATE INDEX IF NOT EXISTS idx_emp_codes_role ON employee_codes(role);

-- Cajeras (código para identificarse en caja y salidas de inventario)
INSERT INTO employee_codes (name, role, code) VALUES
  ('Jessi', 'cajera', '1001'),
  ('Celeste', 'cajera', '1002'),
  ('Kari', 'cajera', '1003');

-- Carniceros / Mostrador (para identificarse en ventas)
INSERT INTO employee_codes (name, role, code) VALUES
  ('Manuel', 'carnicero', '2001'),
  ('Ricardo', 'carnicero', '2002'),
  ('Juanito', 'carnicero', '2003'),
  ('Carlos', 'carnicero', '2004'),
  ('Don Luis', 'carnicero', '2005'),
  ('Sergio', 'carnicero', '2006');

-- ============================================
-- VENTAS EN ESPERA (hold)
-- ============================================

CREATE TABLE IF NOT EXISTS held_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  employee_id UUID REFERENCES employee_codes(id),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE held_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "held_sales_all" ON held_sales FOR ALL USING (true) WITH CHECK (true);

-- Agregar columna de cajera y empleado a orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS attendant_name TEXT;

-- Agregar columna de cajera a cash_movements
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cashier_name TEXT;

-- Historial de salidas manuales: ya existe inventory_movements, agregar columna de autorización
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS authorized_by TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS auth_code TEXT;
  `;

  return NextResponse.json({
    message: "Copia y pega este SQL en Supabase SQL Editor",
    sql,
  });
}
