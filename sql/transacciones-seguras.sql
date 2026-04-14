-- ═══════════════════════════════════════════════════════════════
-- TRANSACCIONES SEGURAS PARA SERGIOS CARNICERÍA
-- Correr en Supabase SQL Editor
-- Estas funciones protegen operaciones que hacen múltiples
-- inserts/updates para que sean atómicas (todo o nada).
-- ═══════════════════════════════════════════════════════════════

-- 1. VENTA CON COBRO EN EFECTIVO (cobranza)
-- Marca el pedido como pagado Y registra el movimiento de caja
-- en una sola transacción. Si falla uno, no se hace ninguno.
CREATE OR REPLACE FUNCTION cobrar_ticket(
  p_order_id UUID,
  p_payment_method TEXT,
  p_amount NUMERIC,
  p_discount_amount NUMERIC DEFAULT 0,
  p_discount_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
  v_result JSON;
BEGIN
  -- Verificar que el pedido existe y está pendiente
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.payment_status = 'pagado' THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido ya está pagado');
  END IF;

  -- Actualizar pedido como pagado
  UPDATE orders SET
    payment_status = 'pagado',
    payment_method = p_payment_method,
    paid_at = now(),
    notes = CASE
      WHEN p_discount_notes IS NOT NULL THEN
        COALESCE(notes, '') || ' | ' || p_discount_notes
      ELSE notes
    END
  WHERE id = p_order_id;

  -- Registrar movimiento de caja
  INSERT INTO cash_movements (type, source, amount, payment_method, reference_id, created_at)
  VALUES ('venta', 'cobranza', p_amount, p_payment_method, p_order_id, now());

  RETURN json_build_object('ok', true, 'message', 'Cobro registrado');
END;
$$;

-- 2. ENVIAR A CRÉDITO (cobranza → CxC)
-- Crea nota CxC + items + actualiza pedido en una transacción
CREATE OR REPLACE FUNCTION enviar_a_credito(
  p_order_id UUID,
  p_customer_id UUID,
  p_total NUMERIC,
  p_due_date DATE,
  p_items JSONB -- array de {product, kilos, price, sale_type, quantity}
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_note_id UUID;
  v_item JSONB;
BEGIN
  -- Crear nota CxC
  INSERT INTO cxc_notes (customer_id, order_id, total, balance, status, due_date, created_at)
  VALUES (p_customer_id, p_order_id, p_total, p_total, 'pendiente', p_due_date, now())
  RETURNING id INTO v_note_id;

  -- Insertar items de la nota
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO cxc_note_items (cxc_note_id, product, kilos, price, sale_type, quantity)
    VALUES (
      v_note_id,
      v_item->>'product',
      COALESCE((v_item->>'kilos')::NUMERIC, 0),
      COALESCE((v_item->>'price')::NUMERIC, 0),
      v_item->>'sale_type',
      COALESCE((v_item->>'quantity')::INTEGER, 0)
    );
  END LOOP;

  -- Actualizar pedido
  UPDATE orders SET
    payment_status = 'credito',
    status = CASE WHEN status = 'nuevo' THEN 'proceso' ELSE status END
  WHERE id = p_order_id;

  RETURN json_build_object('ok', true, 'note_id', v_note_id);
END;
$$;

-- 3. ELIMINAR PEDIDO SEGURO
-- Borra items Y pedido en una transacción
CREATE OR REPLACE FUNCTION eliminar_pedido(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido no encontrado');
  END IF;

  IF v_order.status != 'nuevo' THEN
    RETURN json_build_object('ok', false, 'error', 'Solo se pueden eliminar pedidos nuevos');
  END IF;

  -- Borrar items primero
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Borrar pedido
  DELETE FROM orders WHERE id = p_order_id;

  RETURN json_build_object('ok', true, 'message', 'Pedido eliminado');
END;
$$;

-- 4. REGISTRAR PAGO CxC SEGURO
-- Registra pago + actualiza balance de nota + movimiento de caja
CREATE OR REPLACE FUNCTION registrar_pago_cxc(
  p_note_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_note RECORD;
  v_new_balance NUMERIC;
  v_payment_id UUID;
BEGIN
  -- Obtener nota actual
  SELECT * INTO v_note FROM cxc_notes WHERE id = p_note_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Nota no encontrada');
  END IF;

  IF p_amount > v_note.balance THEN
    RETURN json_build_object('ok', false, 'error', 'Monto excede el saldo');
  END IF;

  v_new_balance := v_note.balance - p_amount;

  -- Insertar pago
  INSERT INTO cxc_payments (cxc_note_id, customer_id, amount, payment_method, reference, notes, created_at)
  VALUES (p_note_id, p_customer_id, p_amount, p_payment_method, p_reference, p_notes, now())
  RETURNING id INTO v_payment_id;

  -- Actualizar balance de la nota
  UPDATE cxc_notes SET
    balance = v_new_balance,
    status = CASE WHEN v_new_balance <= 0 THEN 'pagada' ELSE 'pendiente' END
  WHERE id = p_note_id;

  -- Registrar en caja
  INSERT INTO cash_movements (type, source, amount, payment_method, reference_id, created_at)
  VALUES ('cxc_pago', 'cxc', p_amount, p_payment_method, v_payment_id, now());

  RETURN json_build_object('ok', true, 'payment_id', v_payment_id, 'new_balance', v_new_balance);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- LISTO. Estas funciones se llaman desde el frontend con:
-- supabase.rpc('cobrar_ticket', { p_order_id: '...', ... })
-- Si algo falla, TODO se revierte automáticamente.
-- ═══════════════════════════════════════════════════════════════
