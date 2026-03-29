"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Order = {
  id: string;
  customer_name: string | null;
  status: string | null;
  delivery_status: string | null;
  delivery_started_at?: string | null;
  delivered_at?: string | null;
  delivery_address?: string | null;
  delivery_driver?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.76)",
  cardStrong: "rgba(255,255,255,0.92)",
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

function isToday(dateValue?: string | null) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function RepartidoresPage() {
  const supabase = getSupabaseClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    loadOrders(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockTick((prev) => prev + 1);
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  async function loadOrders(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        status,
        delivery_status,
        delivery_started_at,
        delivered_at,
        delivery_address,
        delivery_driver,
        notes,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      if (showLoader) {
        alert("No se pudieron cargar los pedidos para reparto");
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setOrders((data as Order[]) || []);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }

  async function markEnCamino(order: Order) {
    if (!driverName.trim()) {
      alert("Escribe el nombre del repartidor");
      return;
    }

    setSavingId(order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: "en_camino",
        delivery_started_at: new Date().toISOString(),
        delivery_driver: driverName.trim(),
      })
      .eq("id", order.id);

    if (error) {
      console.log(error);
      alert("No se pudo marcar como en camino");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadOrders(false);
  }

  async function markEntregado(order: Order) {
    setSavingId(order.id);

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: "entregado",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      console.log(error);
      alert("No se pudo marcar como entregado");
      setSavingId(null);
      return;
    }

    setSavingId(null);
    await loadOrders(false);
  }

  function minutesBetween(from?: string | null, to?: string | null) {
    if (!from || !to) return null;

    const start = new Date(from).getTime();
    const end = new Date(to).getTime();

    if (isNaN(start) || isNaN(end)) return null;

    return Math.round((end - start) / 60000);
  }

  function currentDeliveryMinutes(from?: string | null) {
    if (!from) return null;

    const start = new Date(from).getTime();
    const now = Date.now();

    if (isNaN(start)) return null;

    return Math.round((now - start) / 60000);
  }

  async function copyAddress(address?: string | null) {
    if (!address) {
      alert("Este pedido no tiene dirección");
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      alert("Dirección copiada");
    } catch (error) {
      console.log(error);
      alert("No se pudo copiar la dirección");
    }
  }

  function openMaps(address?: string | null) {
    if (!address) {
      alert("Este pedido no tiene dirección");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  }

  const activeOrders = useMemo(() => {
    return orders.filter((order) => {
      const readyToShip =
        order.status === "terminado" &&
        (!order.delivery_status || order.delivery_status === "pendiente");

      const alreadyOnTheWay = order.delivery_status === "en_camino";

      return readyToShip || alreadyOnTheWay;
    });
  }, [orders]);

  const deliveredTodayOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        order.delivery_status === "entregado" &&
        isToday(order.delivered_at || order.created_at || null)
    );
  }, [orders]);

  const stats = useMemo(() => {
    const pendientes = activeOrders.filter(
      (o) => !o.delivery_status || o.delivery_status === "pendiente"
    ).length;

    const enCamino = activeOrders.filter(
      (o) => o.delivery_status === "en_camino"
    ).length;

    const entregadosHoy = deliveredTodayOrders.length;

    return { pendientes, enCamino, entregadosHoy };
  }, [activeOrders, deliveredTodayOrders]);

  function deliveryBadgeStyle(status?: string | null): React.CSSProperties {
    if (status === "en_camino") {
      return {
        background: "rgba(166,106,16,0.12)",
        color: COLORS.warning,
      };
    }

    if (status === "entregado") {
      return {
        background: "rgba(31,122,77,0.12)",
        color: COLORS.success,
      };
    }

    return {
      background: "rgba(53,92,125,0.12)",
      color: COLORS.info,
    };
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando panel de repartidores...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Repartidores</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Pedidos activos para entrega
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={statsGridStyle}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Pendientes de salir</div>
            <div style={statValueStyle}>{stats.pendientes}</div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>En camino</div>
            <div style={statValueStyle}>{stats.enCamino}</div>
          </div>

          <div style={statCardStyle}>
            <div style={statLabelStyle}>Entregados hoy</div>
            <div style={statValueStyle}>{stats.entregadosHoy}</div>
          </div>
        </div>

        <div style={driverBarStyle}>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 800, marginBottom: 6 }}>
              Nombre del repartidor
            </div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>
              Se guarda al marcar el pedido como en camino
            </div>

            {lastUpdated ? (
              <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              placeholder="Ejemplo: Juan"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              style={inputStyle}
            />

            <button
              onClick={() => loadOrders(false)}
              style={refreshButtonStyle}
              disabled={refreshing}
            >
              {refreshing ? "..." : "Actualizar"}
            </button>
          </div>
        </div>

        <div style={sectionWrapStyle}>
          <div style={sectionTitleStyle}>Activos para reparto</div>

          {activeOrders.length === 0 ? (
            <div style={emptyBoxStyle}>No hay pedidos activos para reparto</div>
          ) : (
            <div style={gridStyle}>
              {activeOrders.map((order) => {
                const deliveryMinutes = minutesBetween(
                  order.delivery_started_at,
                  order.delivered_at
                );

                const currentMinutes = currentDeliveryMinutes(order.delivery_started_at);

                return (
                  <div key={order.id} style={cardStyle}>
                    <div style={cardTopStyle}>
                      <div>
                        <div style={customerNameStyle}>
                          {order.customer_name || "Sin nombre"}
                        </div>

                        <div
                          style={{
                            ...statusBadgeStyle,
                            ...deliveryBadgeStyle(order.delivery_status),
                          }}
                        >
                          {order.delivery_status || "pendiente"}
                        </div>
                      </div>

                      <div style={productionDoneBadgeStyle}>
                        {order.status || "sin estado"}
                      </div>
                    </div>

                    <div style={infoBoxStyle}>
                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Dirección:</span>
                        <span style={infoValueStyle}>
                          {order.delivery_address || "Sin dirección capturada"}
                        </span>
                      </div>

                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Repartidor:</span>
                        <span style={infoValueStyle}>
                          {order.delivery_driver || "Sin asignar"}
                        </span>
                      </div>

                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Creado:</span>
                        <span style={infoValueStyle}>
                          {order.created_at
                            ? new Date(order.created_at).toLocaleString()
                            : "Sin fecha"}
                        </span>
                      </div>

                      {order.delivery_started_at ? (
                        <div style={infoRowStyle}>
                          <span style={infoLabelStyle}>Salida:</span>
                          <span style={infoValueStyle}>
                            {new Date(order.delivery_started_at).toLocaleString()}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div style={addressButtonsWrapStyle}>
                      <button
                        onClick={() => openMaps(order.delivery_address)}
                        style={routeButtonStyle}
                      >
                        Abrir ruta
                      </button>

                      <button
                        onClick={() => copyAddress(order.delivery_address)}
                        style={copyButtonStyle}
                      >
                        Copiar dirección
                      </button>
                    </div>

                    {order.notes ? (
                      <div style={notesBoxStyle}>
                        <b>Notas:</b> {order.notes}
                      </div>
                    ) : null}

                    <div style={timesBoxStyle}>
                      <div style={timeCardStyle}>
                        <div style={timeLabelStyle}>Tiempo en camino</div>
                        <div style={timeValueStyle}>
                          {order.delivery_status === "en_camino"
                            ? `${currentMinutes ?? 0} min`
                            : deliveryMinutes !== null
                            ? `${deliveryMinutes} min`
                            : "--"}
                        </div>
                      </div>
                    </div>

                    <div style={buttonsWrapStyle}>
                      <button
                        onClick={() => markEnCamino(order)}
                        disabled={
                          savingId === order.id ||
                          order.delivery_status === "en_camino"
                        }
                        style={{
                          ...warningButtonStyle,
                          opacity:
                            savingId === order.id ||
                            order.delivery_status === "en_camino"
                              ? 0.6
                              : 1,
                        }}
                      >
                        En camino
                      </button>

                      <button
                        onClick={() => markEntregado(order)}
                        disabled={savingId === order.id}
                        style={{
                          ...successButtonStyle,
                          opacity: savingId === order.id ? 0.6 : 1,
                        }}
                      >
                        Pedido entregado
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={sectionWrapStyle}>
          <div style={sectionTitleStyle}>Entregados hoy</div>

          {deliveredTodayOrders.length === 0 ? (
            <div style={emptyBoxStyle}>Todavía no hay entregas registradas hoy</div>
          ) : (
            <div style={gridStyle}>
              {deliveredTodayOrders.map((order) => {
                const deliveryMinutes = minutesBetween(
                  order.delivery_started_at,
                  order.delivered_at
                );

                return (
                  <div key={order.id} style={cardStyle}>
                    <div style={cardTopStyle}>
                      <div>
                        <div style={customerNameStyle}>
                          {order.customer_name || "Sin nombre"}
                        </div>

                        <div
                          style={{
                            ...statusBadgeStyle,
                            ...deliveryBadgeStyle(order.delivery_status),
                          }}
                        >
                          {order.delivery_status || "entregado"}
                        </div>
                      </div>

                      <div style={productionDoneBadgeStyle}>
                        {order.delivery_driver || "Sin repartidor"}
                      </div>
                    </div>

                    <div style={infoBoxStyle}>
                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Dirección:</span>
                        <span style={infoValueStyle}>
                          {order.delivery_address || "Sin dirección capturada"}
                        </span>
                      </div>

                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Salida:</span>
                        <span style={infoValueStyle}>
                          {order.delivery_started_at
                            ? new Date(order.delivery_started_at).toLocaleString()
                            : "Sin registro"}
                        </span>
                      </div>

                      <div style={infoRowStyle}>
                        <span style={infoLabelStyle}>Entregado:</span>
                        <span style={infoValueStyle}>
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleString()
                            : "Sin registro"}
                        </span>
                      </div>
                    </div>

                    <div style={addressButtonsWrapStyle}>
                      <button
                        onClick={() => openMaps(order.delivery_address)}
                        style={routeButtonStyle}
                      >
                        Abrir ruta
                      </button>

                      <button
                        onClick={() => copyAddress(order.delivery_address)}
                        style={copyButtonStyle}
                      >
                        Copiar dirección
                      </button>
                    </div>

                    <div style={timesBoxStyle}>
                      <div style={timeCardStyle}>
                        <div style={timeLabelStyle}>Tiempo total</div>
                        <div style={timeValueStyle}>
                          {deliveryMinutes !== null ? `${deliveryMinutes} min` : "--"}
                        </div>
                      </div>
                    </div>

                    {order.notes ? (
                      <div style={notesBoxStyle}>
                        <b>Notas:</b> {order.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  fontFamily: "Arial, sans-serif",
};

const loadingCardStyle: React.CSSProperties = {
  padding: "18px 22px",
  borderRadius: 18,
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
  color: COLORS.text,
};

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

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const statCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const statLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const statValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 32,
  fontWeight: 800,
};

const driverBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr minmax(320px, 430px)",
  gap: 16,
  alignItems: "center",
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const sectionWrapStyle: React.CSSProperties = {
  marginBottom: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const refreshButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  minWidth: 110,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const cardTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  marginBottom: 8,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
};

const productionDoneBadgeStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  fontWeight: 700,
  textTransform: "capitalize",
};

const infoBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  marginBottom: 12,
};

const infoRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px 1fr",
  gap: 10,
  padding: "8px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const infoLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
};

const infoValueStyle: React.CSSProperties = {
  color: COLORS.text,
  wordBreak: "break-word",
};

const addressButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const routeButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(53,92,125,0.12)",
  color: COLORS.info,
  fontWeight: 700,
  cursor: "pointer",
};

const copyButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  fontWeight: 700,
  cursor: "pointer",
};

const notesBoxStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const timesBoxStyle: React.CSSProperties = {
  marginBottom: 14,
};

const timeCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const timeLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 6,
};

const timeValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 24,
  fontWeight: 800,
};

const buttonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const warningButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(166,106,16,0.12)",
  color: COLORS.warning,
  fontWeight: 700,
  cursor: "pointer",
};

const successButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(31,122,77,0.12)",
  color: COLORS.success,
  fontWeight: 700,
  cursor: "pointer",
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
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