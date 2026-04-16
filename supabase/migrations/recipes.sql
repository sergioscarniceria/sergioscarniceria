-- Recetario — Recetas de marinados, preparaciones y cálculo de costos
-- Ejecuta este bloque en Supabase (SQL Editor) para habilitar el módulo de Recetario.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'marinado' check (type in ('marinado', 'preparacion', 'otro')),
  description text,
  yield_kg numeric,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  ingredient_name text not null,
  quantity_kg numeric not null default 0,
  unit text not null default 'kg',
  unit_price numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_recipes_type on public.recipes (type);
create index if not exists idx_recipes_active on public.recipes (is_active);
create index if not exists idx_recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);
create index if not exists idx_recipe_ingredients_product on public.recipe_ingredients (product_id);
