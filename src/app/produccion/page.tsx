"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import ScaleButton from "@/components/ScaleButton";
import { getScale } from "@/lib/scale";

type OrderItem = {
  id: string;
  product: string;
  kilos: number;
  price: number;
  sale_type?: "kg" | "pieza" | null;
  quantity?: number | null;
  prepared_kilos?: number | null;
  is_ready?: boolean | null;
};

type Order = {
  id: string;
  customer_name: string;
  status: string;
  notes: string;
  payment_status?: string | null;
  butcher_name?: string | null;
  prepared_by?: string | null;
  created_at?: string;
  delivery_date?: string | null;
  order_items?: OrderItem[];
};

type Butcher = {
  id: string;
  name: string;
  is_active: boolean;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.74)",
  cardStrong: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ProduccionPage() {
   const [orders, setOrders] = useState<Order[]>([]);
  const [butchers, setButchers] = useState<Butcher[]>([]);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [preparedKilosDrafts, setPreparedKilosDrafts] = useState<Record<string, string>>({});

  // Báscula Torrey
  const [scaleWeight, setScaleWeight] = useState<number>(0);
  const [scaleStable, setScaleStable] = useState<boolean>(false);
  const [scaleConnected, setScaleConnected] = useState<boolean>(false);

  async function loadData() {
    const supabase = getSupabaseClient();

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("delivery_date", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: butchersData } = await supabase
      .from("butchers")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!ordersError) {
      const activeOrders = ((ordersData as Order[]) || []).filter((o) => {
  const hasItems = (o.order_items || []).length > 0;
  const isActive = o.status === "nuevo" || o.status === "proceso";
  return hasItems && isActive;
});

      setOrders(activeOrders);
    } else {
      console.log(ordersError);
    }

    setButchers((butchersData as Butcher[]) || []);
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Suscripción a báscula Torrey
  useEffect(() => {
    const scale = getScale();
    setScaleConnected(scale.isConnected);

    const unsub = scale.onWeight((w, _unit, s) => {
      setScaleWeight(w);
      setScaleStable(s);
      setScaleConnected(scale.isConnected);
    });

    const checkInterval = setInterval(() => {
      setScaleConnected(scale.isConnected);
    }, 2000);

    return () => {
      unsub();
      clearInterval(checkInterval);
    };
  }, []);

  async function updateStatus(id: string, status: string, currentStatus?: string) {
    // Validar transición: nuevo → proceso → terminado
    if (status === "terminado" && currentStatus && currentStatus !== "proceso") {
      alert("El pedido debe estar en proceso antes de marcarlo como terminado");
      return;
    }

    const supabase = getSupabaseClient();
    setChangingId(id);

    const payload: any = { status };

    if (status === "terminado") {
      payload.prepared_at = new Date().toISOString();
    }

    const { error } = await supabase.from("orders").update(payload).eq("id", id);

    if (error) {
      console.log(error);
      alert("Error al actualizar estado: " + error.message);
    }

    if (status === "terminado") {
      await supabase.rpc("apply_loyalty_points", { p_order_id: id });
    }

    setChangingId(null);
    loadData();
  }

  async function assignButcher(orderId: string, butcherName: string) {
    const supabase = getSupabaseClient();
    setChangingId(orderId);

    await supabase
      .from("orders")
      .update({
        butcher_name: butcherName,
        prepared_by: butcherName,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    setChangingId(null);
    loadData();
  }
  async function savePreparedKilos(itemId: string) {
    const supabase = getSupabaseClient();
    const rawValue = preparedKilosDrafts[itemId];

    if (!rawValue?.trim()) {
      alert("Escribe los kilos reales.");
      return;
    }

    const preparedKilos = Number(rawValue);

    if (!preparedKilos || preparedKilos <= 0) {
      alert("Escribe un peso válido.");
      return;
    }

    setSavingItemId(itemId);

    const { error } = await supabase
      .from("order_items")
      .update({ prepared_kilos: preparedKilos })
      .eq("id", itemId);

    if (error) {
      console.log(error);
      alert("No se pudieron guardar los kilos reales.");
      setSavingItemId(null);
      return;
    }

    setSavingItemId(null);
    loadData();
  }

  async function toggleItemReady(itemId: string, nextValue: boolean) {
    const supabase = getSupabaseClient();
    setSavingItemId(itemId);

    const { error } = await supabase
      .from("order_items")
      .update({ is_ready: nextValue })
      .eq("id", itemId);

    if (error) {
      console.log(error);
      alert("No se pudo actualizar el estado del producto.");
      setSavingItemId(null);
      return;
    }

    setSavingItemId(null);
    loadData();
  }

  function getItemDisplayTotal(item: OrderItem) {
    if (item.sale_type === "pieza") {
      const prepared = Number(item.prepared_kilos || 0);
      if (!prepared) return null;
      return prepared * Number(item.price || 0);
    }

    // Para kg: usar prepared_kilos si existe (peso real ajustado), si no, kilos original
    const kg = Number(item.prepared_kilos || item.kilos || 0);
    return kg * Number(item.price || 0);
  }
  async function deleteOrder(id: string) {
  const supabase = getSupabaseClient();

  const order = orders.find((o) => o.id === id);

  if (!order) {
    alert("No se encontró el pedido.");
    return;
  }

  if (order.status !== "nuevo") {
    alert("Solo se pueden eliminar pedidos nuevos.");
    return;
  }

  const firstConfirm = window.confirm(
    `¿Seguro que quieres eliminar el pedido de ${order.customer_name}?`
  );

  if (!firstConfirm) return;

  const secondConfirm = window.confirm(
    "Esta acción no se puede deshacer. ¿Eliminar definitivamente el pedido?"
  );

  if (!secondConfirm) return;

  setChangingId(id);

  const { error: itemsError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", id);

  if (itemsError) {
    console.log(itemsError);
    alert("No se pudieron borrar los productos del pedido.");
    setChangingId(null);
    return;
  }

  const { error: orderError } = await supabase
    .from("orders")
    .delete()
    .eq("id", id);

  if (orderError) {
    console.log(orderError);
    alert("No se pudo eliminar el pedido.");
    setChangingId(null);
    return;
  }

  setChangingId(null);
  loadData();
}

      function total(order: Order) {
    return (order.order_items || []).reduce((acc, item) => {
      if (item.sale_type === "pieza") {
        return acc + Number(item.prepared_kilos || 0) * Number(item.price || 0);
      }

      // Para kg: usar prepared_kilos si existe, si no kilos original
      const kg = Number(item.prepared_kilos || item.kilos || 0);
      return acc + kg * Number(item.price || 0);
    }, 0);
  }

  function statusBadgeStyle(status: string): React.CSSProperties {
    if (status === "nuevo") {
      return {
        background: "rgba(53,92,125,0.12)",
        color: COLORS.info,
      };
    }

    if (status === "proceso") {
      return {
        background: "rgba(166,106,16,0.12)",
        color: COLORS.warning,
      };
    }

    return {
      background: "rgba(31,122,77,0.12)",
      color: COLORS.success,
    };
  }
  function paymentBadgeStyle(paymentStatus?: string | null): React.CSSProperties {
  if (paymentStatus === "pagado") {
    return {
      background: "rgba(31,122,77,0.12)",
      color: COLORS.success,
    };
  }

  if (paymentStatus === "credito" || paymentStatus === "credito_autorizado") {
    return {
      background: "rgba(166,106,16,0.12)",
      color: COLORS.warning,
    };
  }

  if (paymentStatus === "cancelado") {
    return {
      background: "rgba(180,35,24,0.10)",
      color: COLORS.danger,
    };
  }

  return {
    background: "rgba(53,92,125,0.12)",
    color: COLORS.info,
  };
}
function isOrderReady(o: Order) {
  return (o.order_items || []).every((item) => {
    if (!item.is_ready) return false;

    // Tanto piezas como kilos deben tener peso preparado capturado
    if (Number(item.prepared_kilos || 0) <= 0) return false;

    return true;
  });
}
  const butcherStats = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const b of butchers) {
      counts[b.name] = 0;
    }

    for (const o of orders) {
      const key = o.butcher_name || "Sin asignar";
      counts[key] = (counts[key] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders, butchers]);

  const today = getTodayDateString();

  const todayOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = o.delivery_date || today;
      return orderDate === today;
    });
  }, [orders]);

  const upcomingOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = o.delivery_date || today;
      return orderDate > today;
    });
  }, [orders]);

  return (
    <div style={pageStyle}>
      <ScaleButton />
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img
              src="/logo.png"
              alt="Sergios Carnicería"
              style={{ width: 96, maxWidth: "100%", height: "auto", display: "block" }}
            />
            <div>
              <h1 style={{ margin: 0, color: COLORS.text }}>Producción</h1>
              <p style={{ color: COLORS.muted, margin: "6px 0 0 0" }}>
                Hoy y próximos
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <NotificationBell />
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/repartidores" style={repartidoresButtonStyle}>Repartidores</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={statsWrapStyle}>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos de hoy</div>
            <div style={heroValueStyle}>{todayOrders.length}</div>
            <div style={heroMetaStyle}>Solo los que deben salir hoy</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos próximos</div>
            <div style={heroValueStyle}>{upcomingOrders.length}</div>
            <div style={heroMetaStyle}>Programados para fechas futuras</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Conteo por carnicero</div>
            <div style={butcherMiniGridStyle}>
              {butcherStats.map((b) => (
                <div key={b.name} style={butcherMiniCardStyle}>
                  <div style={{ fontWeight: 700, color: COLORS.text }}>{b.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.primary }}>
                    {b.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

                <Section
          title="Producción de hoy"
          subtitle="Estos son los pedidos que deben trabajarse hoy"
          orders={todayOrders}
          butchers={butchers}
          changingId={changingId}
          savingItemId={savingItemId}
          preparedKilosDrafts={preparedKilosDrafts}
          setPreparedKilosDrafts={setPreparedKilosDrafts}
          assignButcher={assignButcher}
          updateStatus={updateStatus}
          deleteOrder={deleteOrder}
          savePreparedKilos={savePreparedKilos}
          toggleItemReady={toggleItemReady}
          getItemDisplayTotal={getItemDisplayTotal}
          total={total}
          statusBadgeStyle={statusBadgeStyle}
          paymentBadgeStyle={paymentBadgeStyle}
          isOrderReady={isOrderReady}
          scaleWeight={scaleWeight}
          scaleStable={scaleStable}
          scaleConnected={scaleConnected}
        />

        <div style={{ height: 24 }} />

                <Section
          title="Pedidos próximos"
          subtitle="Pedidos futuros apartados para no revolver la operación del día"
          orders={upcomingOrders}
          butchers={butchers}
          changingId={changingId}
          savingItemId={savingItemId}
          preparedKilosDrafts={preparedKilosDrafts}
          setPreparedKilosDrafts={setPreparedKilosDrafts}
          assignButcher={assignButcher}
          updateStatus={updateStatus}
          deleteOrder={deleteOrder}
          savePreparedKilos={savePreparedKilos}
          toggleItemReady={toggleItemReady}
          getItemDisplayTotal={getItemDisplayTotal}
          total={total}
          statusBadgeStyle={statusBadgeStyle}
          paymentBadgeStyle={paymentBadgeStyle}
          isOrderReady={isOrderReady}
          scaleWeight={scaleWeight}
          scaleStable={scaleStable}
          scaleConnected={scaleConnected}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  orders,
  butchers,
  changingId,
  savingItemId,
  preparedKilosDrafts,
  setPreparedKilosDrafts,
  assignButcher,
  updateStatus,
  deleteOrder,
  savePreparedKilos,
  toggleItemReady,
  getItemDisplayTotal,
  total,
  statusBadgeStyle,
  paymentBadgeStyle,
  isOrderReady,
  scaleWeight,
  scaleStable,
  scaleConnected,
}: {
  title: string;
  subtitle: string;
  orders: Order[];
  butchers: Butcher[];
  changingId: string | null;
  savingItemId: string | null;
  preparedKilosDrafts: Record<string, string>;
  setPreparedKilosDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  assignButcher: (orderId: string, butcherName: string) => void;
  updateStatus: (id: string, status: string, currentStatus?: string) => void;
  deleteOrder: (id: string) => void;
  savePreparedKilos: (itemId: string) => void;
  toggleItemReady: (itemId: string, nextValue: boolean) => void;
  getItemDisplayTotal: (item: OrderItem) => number | null;
  total: (order: Order) => number;
  statusBadgeStyle: (status: string) => React.CSSProperties;
    paymentBadgeStyle: (paymentStatus?: string | null) => React.CSSProperties;
    isOrderReady: (o: Order) => boolean;
    scaleWeight: number;
    scaleStable: boolean;
    scaleConnected: boolean;
}) {
  return (
    <div style={sectionCardStyle}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: COLORS.text }}>{title}</h2>
        <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>{subtitle}</p>
      </div>

      {orders.length === 0 ? (
        <div style={emptyBigStyle}>No hay pedidos en esta sección</div>
      ) : (
        <div style={ordersGridStyle}>
          {orders.map((o) => (
            <div key={o.id} style={orderCardStyle}>
              <div style={orderHeaderStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={customerNameStyle}>{o.customer_name}</div>
                  <div
                    style={{
                      ...statusPillStyle,
                      ...statusBadgeStyle(o.status),
                    }}
                  >
                    {o.status}
                  </div>
                  <div
  style={{
    ...statusPillStyle,
    ...paymentBadgeStyle(o.payment_status),
    marginTop: 8,
  }}
>
  pago: {o.payment_status || "pendiente"}
</div>
                </div>

                                <div style={totalBadgeStyle}>
                  {(o.order_items || []).some(
                    (item) => item.sale_type === "pieza" && !item.prepared_kilos
                  )
                    ? "Por pesar"
                    : `$${total(o).toFixed(2)}`}
                </div>
              </div>

              {o.delivery_date ? (
                <div style={{ color: COLORS.muted, marginBottom: 10, fontSize: 14 }}>
                  Entrega: <b>{o.delivery_date}</b>
                </div>
              ) : null}

                                        <div style={itemsBoxStyle}>
                {(o.order_items || []).map((item) => {
                  const itemTotal = getItemDisplayTotal(item);

                  return (
                    <div key={item.id} style={itemCardStyle}>
                      <div style={itemTopRowStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: COLORS.text, fontWeight: 800 }}>
                            {item.product}
                          </div>

                          <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
                            {item.sale_type === "pieza"
                              ? `${Number(item.quantity || 0)} pieza${Number(item.quantity || 0) === 1 ? "" : "s"}`
                              : `${item.kilos} kg`}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={itemReadyBadgeStyle(item.is_ready)}>
                            {item.is_ready ? "✅ Listo" : "Pendiente"}
                          </div>

                          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 6 }}>
                            {itemTotal === null ? "Por pesar" : `$${itemTotal.toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      {item.sale_type === "pieza" ? (
                        <div style={pieceControlsWrapStyle}>
                          <div style={preparedRowStyle}>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="Kilos reales"
                              value={
                                preparedKilosDrafts[item.id] ??
                                (item.prepared_kilos != null ? String(item.prepared_kilos) : "")
                              }
                              onChange={(e) =>
                                setPreparedKilosDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={preparedInputStyle}
                            />

                            {scaleConnected && (
                              <button
                                onClick={() => {
                                  if (scaleWeight > 0) {
                                    setPreparedKilosDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: scaleWeight.toFixed(3),
                                    }));
                                  }
                                }}
                                disabled={scaleWeight <= 0}
                                style={{
                                  ...miniActionButtonStyle,
                                  background: scaleStable && scaleWeight > 0
                                    ? "rgba(31,122,77,0.15)"
                                    : "rgba(166,106,16,0.12)",
                                  color: scaleStable && scaleWeight > 0 ? COLORS.success : COLORS.warning,
                                  opacity: scaleWeight > 0 ? 1 : 0.6,
                                  whiteSpace: "nowrap",
                                }}
                                title="Tomar peso de báscula"
                              >
                                ⚖ {scaleWeight.toFixed(3)}
                              </button>
                            )}

                            <button
                              onClick={() => savePreparedKilos(item.id)}
                              disabled={savingItemId === item.id}
                              style={{
                                ...miniActionButtonStyle,
                                background: "rgba(53,92,125,0.12)",
                                color: COLORS.info,
                                opacity: savingItemId === item.id ? 0.6 : 1,
                              }}
                            >
                              {savingItemId === item.id ? "Guardando..." : "Guardar peso"}
                            </button>
                          </div>

                          {item.prepared_kilos ? (
                            <div style={preparedHintStyle}>
                              Peso real guardado: <b>{item.prepared_kilos} kg</b>
                            </div>
                          ) : (
                            <div style={preparedHintStyle}>
                              Falta capturar el peso real.
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Ajustar peso real para items por kilo */}
                      {item.sale_type === "kg" ? (
                        <div style={pieceControlsWrapStyle}>
                          <div style={preparedRowStyle}>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder={`Pedido: ${item.kilos} kg`}
                              value={
                                preparedKilosDrafts[item.id] ??
                                (item.prepared_kilos != null ? String(item.prepared_kilos) : "")
                              }
                              onChange={(e) =>
                                setPreparedKilosDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={preparedInputStyle}
                            />

                            {scaleConnected && (
                              <button
                                onClick={() => {
                                  if (scaleWeight > 0) {
                                    setPreparedKilosDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: scaleWeight.toFixed(3),
                                    }));
                                  }
                                }}
                                disabled={scaleWeight <= 0}
                                style={{
                                  ...miniActionButtonStyle,
                                  background: scaleStable && scaleWeight > 0
                                    ? "rgba(31,122,77,0.15)"
                                    : "rgba(166,106,16,0.12)",
                                  color: scaleStable && scaleWeight > 0 ? COLORS.success : COLORS.warning,
                                  opacity: scaleWeight > 0 ? 1 : 0.6,
                                  whiteSpace: "nowrap",
                                }}
                                title="Tomar peso de báscula"
                              >
                                ⚖ {scaleWeight.toFixed(3)}
                              </button>
                            )}

                            <button
                              onClick={() => savePreparedKilos(item.id)}
                              disabled={savingItemId === item.id}
                              style={{
                                ...miniActionButtonStyle,
                                background: "rgba(166,106,16,0.12)",
                                color: COLORS.warning,
                                opacity: savingItemId === item.id ? 0.6 : 1,
                              }}
                            >
                              {savingItemId === item.id ? "Guardando..." : "Ajustar peso"}
                            </button>
                          </div>

                          {item.prepared_kilos ? (
                            <div style={preparedHintStyle}>
                              Peso ajustado: <b>{item.prepared_kilos} kg</b> (pedido original: {item.kilos} kg)
                            </div>
                          ) : (
                            <div style={preparedHintStyle}>
                              Peso original: {item.kilos} kg — ajusta si el peso real es diferente
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div style={itemBottomActionsStyle}>
                        <button
                          onClick={() => toggleItemReady(item.id, !item.is_ready)}
                          disabled={savingItemId === item.id}
                          style={{
                            ...miniActionButtonStyle,
                            background: item.is_ready
                              ? "rgba(180,35,24,0.10)"
                              : "rgba(31,122,77,0.12)",
                            color: item.is_ready ? COLORS.danger : COLORS.success,
                            opacity: savingItemId === item.id ? 0.6 : 1,
                          }}
                        >
                          {item.is_ready ? "Quitar check" : "Marcar listo"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {o.notes ? (
                <div style={notesBoxStyle}>
                  <b>Notas:</b> {o.notes}
                </div>
              ) : null}

              <div style={assignedRowStyle}>
                <span style={{ color: COLORS.muted }}>Carnicero asignado:</span>
                <b style={{ color: COLORS.text }}>
                  {o.butcher_name || "Sin asignar"}
                </b>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={subLabelStyle}>Asignar carnicero</div>

                <div style={butchersWrapStyle}>
                  {butchers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => assignButcher(o.id, b.name)}
                      disabled={changingId === o.id}
                      style={{
                        ...butcherButtonStyle,
                        background: o.butcher_name === b.name ? COLORS.primary : "white",
                        color: o.butcher_name === b.name ? "white" : COLORS.text,
                        border:
                          o.butcher_name === b.name
                            ? "none"
                            : `1px solid ${COLORS.border}`,
                        opacity: changingId === o.id ? 0.7 : 1,
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={actionButtonsWrapStyle}>
                <button
                  onClick={() => updateStatus(o.id, "proceso")}
                  disabled={changingId === o.id}
                  style={{
                    ...actionButtonStyle,
                    background: "rgba(166,106,16,0.12)",
                    color: COLORS.warning,
                  }}
                >
                  En proceso
                </button>

                <button
  onClick={() => updateStatus(o.id, "terminado", o.status)}
  disabled={changingId === o.id || !isOrderReady(o) || o.status !== "proceso"}
  style={{
    ...actionButtonStyle,
    background: isOrderReady(o)
      ? "rgba(31,122,77,0.12)"
      : "rgba(122,90,82,0.10)",
    color: isOrderReady(o) ? COLORS.success : COLORS.muted,
    cursor: isOrderReady(o) ? "pointer" : "not-allowed",
    opacity: changingId === o.id || !isOrderReady(o) ? 0.6 : 1,
  }}
  title={!isOrderReady(o) ? "Faltan productos por preparar o pesar" : ""}
>
  Terminado
</button>

                <button
  onClick={() => deleteOrder(o.id)}
  disabled={changingId === o.id || o.status !== "nuevo"}
  style={{
    ...actionButtonStyle,
    background: o.status === "nuevo" ? "rgba(180,35,24,0.10)" : "rgba(122,90,82,0.10)",
    color: o.status === "nuevo" ? COLORS.danger : COLORS.muted,
    cursor: changingId === o.id || o.status !== "nuevo" ? "not-allowed" : "pointer",
    opacity: changingId === o.id || o.status !== "nuevo" ? 0.6 : 1,
  }}
  title={o.status !== "nuevo" ? "Solo se pueden eliminar pedidos nuevos" : "Eliminar pedido"}
>
  Eliminar
</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: 16,
  position: "relative",
  overflow: "hidden",
  fontFamily: "Arial, sans-serif",
};

const glowTopLeft: React.CSSProperties = {
  position: "absolute",
  top: -120,
  left: -100,
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(123, 34, 24, 0.08)",
  filter: "blur(45px)",
};

const glowTopRight: React.CSSProperties = {
  position: "absolute",
  top: -80,
  right: -60,
  width: 280,
  height: 280,
  borderRadius: "50%",
  background: "rgba(217, 201, 163, 0.35)",
  filter: "blur(45px)",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const statsWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const smallLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 10,
};

const heroValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 6,
  lineHeight: 1.1,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
};

const butcherMiniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const butcherMiniCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 14,
};

const sectionCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const ordersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
};

const orderCardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const orderHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const customerNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 8,
  lineHeight: 1.2,
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
};

const totalBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 18,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const itemsBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};
const itemCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  marginBottom: 10,
};

const itemTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const pieceControlsWrapStyle: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 8,
};

const preparedRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const preparedInputStyle: React.CSSProperties = {
  flex: "1 1 160px",
  minWidth: 140,
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  outline: "none",
  fontSize: 14,
};

const miniActionButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const preparedHintStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
};

const itemBottomActionsStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};
function itemReadyBadgeStyle(isReady?: boolean | null): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: isReady ? "rgba(31,122,77,0.12)" : "rgba(166,106,16,0.12)",
    color: isReady ? COLORS.success : COLORS.warning,
  };
}
const notesBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  marginBottom: 14,
};

const assignedRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  padding: "10px 0",
  flexWrap: "wrap",
};

const subLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const butchersWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const butcherButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const actionButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const actionButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBigStyle: React.CSSProperties = {
  padding: 26,
  borderRadius: 24,
  background: COLORS.cardStrong,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
  textAlign: "center",
  boxShadow: COLORS.shadow,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const repartidoresButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};