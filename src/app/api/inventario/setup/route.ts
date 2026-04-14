import { NextResponse } from "next/server";

export async function GET() {
  const sql = `
-- ============================================
-- INVENTARIO: Complementos + Bodega
-- ============================================

-- 1. Agregar stock y min_stock a products (para complementos por pieza)
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;

-- 2. Tabla de insumos de bodega
CREATE TABLE IF NOT EXISTS bodega_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'piezas',
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Movimientos de inventario (para ambos)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER DEFAULT 0,
  new_stock INTEGER DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permisos RLS
ALTER TABLE bodega_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bodega_items_all" ON bodega_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "inventory_movements_all" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inv_mov_item ON inventory_movements(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_date ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bodega_active ON bodega_items(is_active);
  `;

  return NextResponse.json({
    message: "Copia y pega este SQL en Supabase SQL Editor",
    sql,
  });
}
