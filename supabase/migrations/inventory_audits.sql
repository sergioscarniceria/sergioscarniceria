-- Fase 3 — Auditorías de inventario
-- Ejecuta este bloque en Supabase (SQL Editor) para habilitar el módulo de Auditoría.

create table if not exists public.inventory_audits (
  id uuid primary key default gen_random_uuid(),
  audit_number text,
  audit_date date not null default current_date,
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  total_items integer not null default 0,
  total_difference_units numeric not null default 0,
  total_loss_amount numeric not null default 0,
  total_surplus_amount numeric not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);

create table if not exists public.inventory_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.inventory_audits(id) on delete cascade,
  item_type text not null check (item_type in ('bodega', 'complemento')),
  item_id uuid not null,
  item_name text not null,
  unit text,
  system_stock numeric not null default 0,
  counted_stock numeric,
  difference numeric not null default 0,
  unit_cost numeric not null default 0,
  loss_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_audits_date on public.inventory_audits (audit_date desc);
create index if not exists idx_audits_status on public.inventory_audits (status);
create index if not exists idx_audit_items_audit on public.inventory_audit_items (audit_id);
create index if not exists idx_audit_items_item on public.inventory_audit_items (item_type, item_id);
