-- 19 oct 2026 — Corrección de datos: productos por pieza capturados como kilos
--
-- La venta manual en Caja guardaba hielo, tacos, refrescos, etc. como
-- sale_type = 'kg' con las piezas en la columna kilos. Eso hacía que
-- "Ventas por producto" y "Análisis por categoría" los contaran como
-- kilos de carne y que los conteos de piezas salieran bajos
-- (ej. Hielo: 13 en octubre cuando en realidad fueron 27).
--
-- Este script pasa esas líneas a pieza. El importe no cambia
-- (kilos * precio == quantity * precio). Solo toca líneas con número
-- entero en kilos; las 13 con decimales se dejan tal cual.
--
-- Cómo correrlo: Supabase → SQL Editor → pegar → Run.
-- Primero el SELECT para ver cuántas; luego el UPDATE.

-- 1) Vista previa (debe dar ~2,190 líneas)
SELECT COUNT(*) AS lineas_a_corregir
FROM order_items oi
JOIN products p
  ON LOWER(TRIM(p.name)) = LOWER(TRIM(oi.product)) AND p.fixed_piece_price > 0
WHERE COALESCE(oi.sale_type, 'kg') = 'kg'
  AND COALESCE(oi.is_fixed_price_piece, false) = false
  AND oi.kilos IS NOT NULL AND oi.kilos = ROUND(oi.kilos) AND oi.kilos > 0;

-- 2) Corrección
UPDATE order_items oi
SET sale_type = 'pieza',
    is_fixed_price_piece = true,
    quantity = oi.kilos,
    kilos = NULL
FROM products p
WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(oi.product))
  AND p.fixed_piece_price > 0
  AND COALESCE(oi.sale_type, 'kg') = 'kg'
  AND COALESCE(oi.is_fixed_price_piece, false) = false
  AND oi.kilos IS NOT NULL AND oi.kilos = ROUND(oi.kilos) AND oi.kilos > 0;

-- 3) Comprobar: Hielo de octubre debe dar 27 piezas
SELECT product, piezas, kilos, revenue
FROM ventas_por_producto('2026-10-01', '2026-10-31')
WHERE product ILIKE '%hielo%';
