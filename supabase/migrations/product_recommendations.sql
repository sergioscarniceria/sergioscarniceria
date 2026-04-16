-- Recomendaciones manuales por producto
-- Permite definir qu\u00e9 productos sugerir cuando el cliente agrega este al carrito.
alter table public.products
  add column if not exists recommended_with uuid[] default '{}';
