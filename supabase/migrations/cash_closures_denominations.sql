-- Fase 1 Caja — Cierre con denominaciones + ticket imprimible
-- Agrega columnas de denominaciones al cierre de caja para contar billete por billete.

alter table public.cash_closures
  add column if not exists bills_1000 integer default 0,
  add column if not exists bills_500  integer default 0,
  add column if not exists bills_200  integer default 0,
  add column if not exists bills_100  integer default 0,
  add column if not exists bills_50   integer default 0,
  add column if not exists bills_20   integer default 0,
  add column if not exists coins_20   integer default 0,
  add column if not exists coins_10   integer default 0,
  add column if not exists coins_5    integer default 0,
  add column if not exists coins_2    integer default 0,
  add column if not exists coins_1    integer default 0,
  add column if not exists coins_050  integer default 0,
  add column if not exists total_expenses numeric default 0,
  add column if not exists initial_amount numeric default 0,
  add column if not exists closed_by text;
