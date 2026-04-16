-- Fase 2 — Órdenes de compra
-- Ejecuta este bloque en Supabase (SQL Editor) para habilitar el módulo de Compras.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text,
  supplier text,
  purchase_date date not null default current_date,
  total_amount numeric not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  applied boolean not null default true
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_type text not null check (item_type in ('bodega', 'complemento')),
  item_id uuid not null,
  item_name text not null,
  quantity numeric not null,
  unit text,
  unit_cost numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_date on public.purchase_orders (purchase_date desc);
create index if not exists idx_purchase_order_items_order on public.purchase_order_items (purchase_order_id);
create index if not exists idx_purchase_order_items_item on public.purchase_order_items (item_type, item_id);
