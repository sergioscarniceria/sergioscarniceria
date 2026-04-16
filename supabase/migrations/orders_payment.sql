-- Mercado Pago — columnas de pago en orders
-- Ejecuta en Supabase SQL Editor para habilitar pagos online.
alter table public.orders
  add column if not exists payment_method text default 'efectivo',
  add column if not exists payment_status text default 'pendiente',
  add column if not exists mp_preference_id text,
  add column if not exists mp_payment_id text,
  add column if not exists paid_at timestamptz;
