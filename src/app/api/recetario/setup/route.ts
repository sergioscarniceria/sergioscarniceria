import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQL_TABLES = `
-- Tabla: Recetas (marinados, preparaciones, etc.)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'marinado',
  -- type: marinado | preparacion | otro
  description TEXT,
  yield_kg NUMERIC(10,3),
  -- yield_kg: cuántos kg produce la receta
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: Ingredientes de cada receta
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  -- product_id: referencia a tabla products (puede ser null para ingredientes manuales)
  ingredient_name TEXT NOT NULL,
  -- ingredient_name: nombre del ingrediente (se llena automático si viene de products)
  quantity_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  -- quantity_kg: cantidad en kg que lleva la receta
  unit TEXT DEFAULT 'kg',
  -- unit: kg, litros, piezas, gramos
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- unit_price: precio por unidad (se jala de products.price o manual)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_all" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "recipe_ingredients_all" ON recipe_ingredients FOR ALL USING (true) WITH CHECK (true);

-- Índice para buscar ingredientes por receta rápido
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret || "")) {
    return NextResponse.json({ error: "Secret inválido", sql: SQL_TABLES }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Faltan variables", sql: SQL_TABLES, hint: "Corre el SQL manualmente" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from("recipes").select("id").limit(1);

  if (error) {
    return NextResponse.json({ error: "Tablas no existen", sql: SQL_TABLES, hint: "Corre el SQL en Supabase SQL Editor" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Tablas de recetario verificadas", tables: ["recipes", "recipe_ingredients"] });
}
