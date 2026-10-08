"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type Insight = {
  id: string;
  customer_id: string | null;
  phone: string;
  whatsapp_name: string | null;
  summary: string | null;
  favorite_products: string[] | null;
  preferences: string | null;
  order_patterns: string | null;
  delivery_notes: string | null;
  business_info: string | null;
  personal_notes: string | null;
  payment_notes: string | null;
  complaints: string | null;
  opportunities: string | null;
  first_contact: string | null;
  last_contact: string | null;
  msg_count: number | null;
  source_phones: string[] | null;
  manual_notes: string | null;
  updated_at: string | null;
};

type Customer = { id: string; name: string; phone: string | null; customer_type: string | null; business_name?: string | null };

type Msg = { id: string; ts: number; from_me: boolean; type: string; body: string; sender: string | null };

const C = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(92,27,17,0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91,25,15,0.08)",
};

function normPhone(p?: string | null) {
  if (!p) return "";
  let d = p.replace(/\D/g, "");
  if (d.startsWith("521")) d = d.slice(3);
  else if (d.startsWith("52")) d = d.slice(2);
  return d.slice(-10);
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d + (d.length === 10 ? "T12:00:00" : ""));
  if (isNaN(x.getTime())) return d;
  return x.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTs(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

const TYPE_LABEL: Record<string, string> = {
  image: "📷 Imagen", video: "🎥 Video", document: "📄 Documento", audio: "🎤 Audio", ptt: "🎤 Nota de voz",
  sticker: "🙂 Sticker", call_log: "📞 Llamada", location: "📍 Ubicación", vcard: "👤 Contacto", gif: "🎞 GIF",
  notification_template: "ℹ️ Notificación", revoked: "🚫 Mensaje eliminado",
};

export default function AdminCrmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#7a5a52" }}>Cargando CRM...</div>}>
      <AdminCrmInner />
    </Suspense>
  );
}

function AdminCrmInner() {
  const supabase = getSupabaseClient();
  const params = useSearchParams();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "clientes" | "sin_cliente" | "mayoreo">("todos");
  const [selected, setSelected] = useState<Insight | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [msgsLimit, setMsgsLimit] = useState(80);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ins }, { data: cus }] = await Promise.all([
        supabase.from("customer_insights").select("*").order("last_contact", { ascending: false, nullsFirst: false }).range(0, 4999),
        supabase.from("customers").select("id, name, phone, customer_type, business_name").range(0, 4999),
      ]);
      setInsights((ins as Insight[]) || []);
      setCustomers((cus as Customer[]) || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Preselect from ?phone= or ?customer_id=
  useEffect(() => {
    if (!insights.length) return;
    const ph = params.get("phone");
    const cid = params.get("customer_id");
    let target: Insight | undefined;
    if (cid) target = insights.find((i) => i.customer_id === cid);
    if (!target && ph) target = insights.find((i) => i.phone === normPhone(ph));
    if (target) setSelected(target);
  }, [insights, params]);

  const customerById = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach((c) => { m[c.id] = c; });
    return m;
  }, [customers]);

  const customerByPhone = useMemo(() => {
    const m: Record<string, Customer> = {};
    customers.forEach((c) => { const p = normPhone(c.phone); if (p) m[p] = c; });
    return m;
  }, [customers]);

  const list = useMemo(() => {
    const q = search.toLowerCase().trim();
    return insights.filter((i) => {
      const cust = i.customer_id ? customerById[i.customer_id] : customerByPhone[i.phone];
      if (filter === "clientes" && !cust) return false;
      if (filter === "sin_cliente" && cust) return false;
      if (filter === "mayoreo" && cust?.customer_type !== "mayoreo") return false;
      if (!q) return true;
      const hay = [i.whatsapp_name, i.phone, cust?.name, cust?.business_name, i.summary, (i.favorite_products || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [insights, search, filter, customerById, customerByPhone]);

  // Load messages when selecting
  useEffect(() => {
    if (!selected) { setMsgs([]); return; }
    setNotes(selected.manual_notes || "");
    setMsgsLimit(80);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setMsgsLoading(true);
      try {
        // whatsapp_chats.phone is normalized 10 digits
        const { data: chats } = await supabase.from("whatsapp_chats").select("id").eq("phone", selected.phone);
        const ids = (chats || []).map((c: { id: string }) => c.id);
        if (!ids.length) { if (!cancelled) setMsgs([]); return; }
        const { data } = await supabase
          .from("whatsapp_messages")
          .select("id, ts, from_me, type, body, sender")
          .in("chat_id", ids)
          .order("ts", { ascending: false })
          .limit(msgsLimit);
        if (!cancelled) setMsgs(((data as Msg[]) || []).slice().reverse());
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, msgsLimit]);

  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    try {
      await supabase.from("customer_insights").update({ manual_notes: notes, updated_at: new Date().toISOString() }).eq("id", selected.id);
      setInsights((prev) => prev.map((i) => (i.id === selected.id ? { ...i, manual_notes: notes } : i)));
    } finally {
      setSavingNotes(false);
    }
  }

  async function linkToCustomer(customerId: string) {
    if (!selected) return;
    setLinking(true);
    try {
      await supabase.from("customer_insights").update({ customer_id: customerId }).eq("id", selected.id);
      setInsights((prev) => prev.map((i) => (i.id === selected.id ? { ...i, customer_id: customerId } : i)));
      setSelected({ ...selected, customer_id: customerId });
    } finally {
      setLinking(false);
    }
  }

  const selCustomer = selected ? (selected.customer_id ? customerById[selected.customer_id] : customerByPhone[selected.phone]) : null;

  const stats = useMemo(() => {
    const total = insights.length;
    const linked = insights.filter((i) => i.customer_id || customerByPhone[i.phone]).length;
    const msgsTotal = insights.reduce((a, i) => a + (i.msg_count || 0), 0);
    return { total, linked, msgsTotal };
  }, [insights, customerByPhone]);

  return (
    <div style={pageStyle}>
      <style>{`
        @media (max-width: 900px) { .crm-grid { grid-template-columns: 1fr !important; } .crm-list { max-height: 40vh !important; } }
      `}</style>
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: C.text }}>CRM de clientes</h1>
            <p style={{ margin: "6px 0 0 0", color: C.muted }}>
              Lo que sabemos de cada cliente según WhatsApp
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/clientes" style={secondaryButtonStyle}>Clientes</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={statsRowStyle}>
          <div style={statCardStyle}><div style={statLabelStyle}>Contactos con historial</div><div style={statValueStyle}>{stats.total}</div></div>
          <div style={statCardStyle}><div style={statLabelStyle}>Vinculados a cliente</div><div style={statValueStyle}>{stats.linked}</div></div>
          <div style={statCardStyle}><div style={statLabelStyle}>Mensajes analizados</div><div style={statValueStyle}>{stats.msgsTotal.toLocaleString("es-MX")}</div></div>
        </div>

        <div className="crm-grid" style={gridStyle}>
          {/* ─── Lista ─── */}
          <div style={panelStyle}>
            <input
              placeholder="Buscar nombre, teléfono, producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {([["todos", "Todos"], ["clientes", "Clientes"], ["mayoreo", "Mayoreo"], ["sin_cliente", "Sin registro"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ ...chipStyle, background: filter === k ? C.primary : "white", color: filter === k ? "white" : C.text }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="crm-list" style={listStyle}>
              {loading ? (
                <div style={emptyStyle}>Cargando...</div>
              ) : list.length === 0 ? (
                <div style={emptyStyle}>Sin resultados</div>
              ) : (
                list.map((i) => {
                  const cust = i.customer_id ? customerById[i.customer_id] : customerByPhone[i.phone];
                  const active = selected?.id === i.id;
                  return (
                    <button key={i.id} onClick={() => setSelected(i)} style={{ ...rowStyle, background: active ? "rgba(123,34,24,0.08)" : "white", borderColor: active ? C.primary : C.border }}>
                      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cust?.name || i.whatsapp_name || i.phone}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {i.whatsapp_name && cust && i.whatsapp_name !== cust.name ? `WA: ${i.whatsapp_name} · ` : ""}
                          {i.phone} · {i.msg_count || 0} msgs
                        </div>
                        {i.favorite_products && i.favorite_products.length > 0 && (
                          <div style={{ fontSize: 12, color: C.primary, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {i.favorite_products.slice(0, 4).join(" · ")}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        {cust ? (
                          <span style={{ ...badgeStyle, background: cust.customer_type === "mayoreo" ? "rgba(166,106,16,0.12)" : "rgba(31,122,77,0.12)", color: cust.customer_type === "mayoreo" ? C.warning : C.success }}>
                            {cust.customer_type === "mayoreo" ? "Mayoreo" : "Cliente"}
                          </span>
                        ) : (
                          <span style={{ ...badgeStyle, background: "rgba(122,90,82,0.10)", color: C.muted }}>Sin registro</span>
                        )}
                        <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(i.last_contact)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── Detalle ─── */}
          <div style={panelStyle}>
            {!selected ? (
              <div style={emptyStyle}>Selecciona un contacto para ver su perfil</div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>
                      {selCustomer?.name || selected.whatsapp_name || selected.phone}
                    </div>
                    <div style={{ color: C.muted, marginTop: 4, fontSize: 14 }}>
                      {selected.whatsapp_name && selCustomer && selected.whatsapp_name !== selCustomer.name ? `En WhatsApp: ${selected.whatsapp_name} · ` : ""}
                      📱 {selected.phone}
                      {selCustomer?.business_name ? ` · ${selCustomer.business_name}` : ""}
                    </div>
                    <div style={{ color: C.muted, marginTop: 4, fontSize: 13 }}>
                      Primer contacto: <b>{fmtDate(selected.first_contact)}</b> · Último: <b>{fmtDate(selected.last_contact)}</b> · {selected.msg_count || 0} mensajes
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a href={`https://wa.me/52${selected.phone}`} target="_blank" rel="noreferrer" style={waButtonStyle}>WhatsApp</a>
                    {selCustomer && (
                      <Link href={`/cxc/estado-cuenta?customer_id=${selCustomer.id}`} style={secondaryButtonStyle}>Estado de cuenta</Link>
                    )}
                  </div>
                </div>

                {!selCustomer && (
                  <div style={{ ...noticeStyle, marginTop: 12 }}>
                    Este contacto no está registrado como cliente.{" "}
                    <select
                      disabled={linking}
                      onChange={(e) => e.target.value && linkToCustomer(e.target.value)}
                      defaultValue=""
                      style={{ ...inputStyle, width: "auto", display: "inline-block", padding: "6px 10px", marginLeft: 6 }}
                    >
                      <option value="">Vincular a cliente existente...</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {selected.summary && (
                  <div style={summaryBoxStyle}>{selected.summary}</div>
                )}

                {selected.favorite_products && selected.favorite_products.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={sectionLabelStyle}>Productos que pide</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {selected.favorite_products.map((p, idx) => (
                        <span key={idx} style={productChipStyle}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={infoGridStyle}>
                  <InfoCard label="Cómo le gusta" value={selected.preferences} />
                  <InfoCard label="Patrón de pedidos" value={selected.order_patterns} />
                  <InfoCard label="Entrega / dirección" value={selected.delivery_notes} />
                  <InfoCard label="Negocio / quién es" value={selected.business_info} />
                  <InfoCard label="Pagos y crédito" value={selected.payment_notes} />
                  <InfoCard label="Datos personales útiles" value={selected.personal_notes} />
                  <InfoCard label="Quejas / problemas" value={selected.complaints} color={C.danger} />
                  <InfoCard label="Oportunidades" value={selected.opportunities} color={C.success} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={sectionLabelStyle}>Notas manuales</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agrega notas propias sobre este cliente..."
                    style={textareaStyle}
                  />
                  <button onClick={saveNotes} disabled={savingNotes || notes === (selected.manual_notes || "")} style={primaryButtonStyle}>
                    {savingNotes ? "Guardando..." : "Guardar notas"}
                  </button>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={sectionLabelStyle}>Historial de WhatsApp</div>
                  {msgsLoading && msgs.length === 0 ? (
                    <div style={emptyStyle}>Cargando mensajes...</div>
                  ) : msgs.length === 0 ? (
                    <div style={emptyStyle}>Sin mensajes cargados</div>
                  ) : (
                    <div style={chatBoxStyle}>
                      {msgs.length >= msgsLimit && (
                        <button onClick={() => setMsgsLimit((n) => n + 150)} style={{ ...chipStyle, alignSelf: "center", marginBottom: 8 }}>
                          {msgsLoading ? "Cargando..." : "Cargar anteriores"}
                        </button>
                      )}
                      {msgs.map((m) => (
                        <div key={m.id} style={{ display: "flex", justifyContent: m.from_me ? "flex-end" : "flex-start" }}>
                          <div style={{ ...bubbleStyle, background: m.from_me ? "rgba(31,122,77,0.12)" : "white", borderColor: m.from_me ? "rgba(31,122,77,0.25)" : C.border }}>
                            <div style={{ fontSize: 14, color: C.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {m.body?.trim() ? m.body : (TYPE_LABEL[m.type] || `[${m.type}]`)}
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textAlign: "right" }}>
                              {m.from_me ? "Tú" : (m.sender || "Cliente")} · {fmtTs(m.ts)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  if (!value) return null;
  return (
    <div style={{ ...infoCardStyle, borderLeft: `4px solid ${color || C.primary}` }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: color || C.primary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

/* ─── Styles ─── */
const pageStyle: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" };
const shellStyle: React.CSSProperties = { maxWidth: 1440, margin: "0 auto" };
const topBarStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 };
const statsRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 };
const statCardStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, boxShadow: C.shadow };
const statLabelStyle: React.CSSProperties = { color: C.muted, fontSize: 13, marginBottom: 4 };
const statValueStyle: React.CSSProperties = { color: C.text, fontSize: 26, fontWeight: 800 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(300px, 0.8fr) minmax(0, 1.4fr)", gap: 16, alignItems: "start" };
const panelStyle: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 16, boxShadow: C.shadow };
const inputStyle: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, boxSizing: "border-box", outline: "none", background: "white", color: C.text, fontSize: 15 };
const chipStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const listStyle: React.CSSProperties = { display: "grid", gap: 8, marginTop: 12, maxHeight: "calc(100vh - 320px)", overflowY: "auto", paddingRight: 4 };
const rowStyle: React.CSSProperties = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, cursor: "pointer" };
const badgeStyle: React.CSSProperties = { display: "inline-block", padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800 };
const emptyStyle: React.CSSProperties = { padding: 16, borderRadius: 14, background: C.bgSoft, border: `1px dashed ${C.border}`, color: C.muted, textAlign: "center" };
const noticeStyle: React.CSSProperties = { padding: 12, borderRadius: 14, background: "rgba(166,106,16,0.08)", border: "1px solid rgba(166,106,16,0.2)", color: C.text, fontSize: 14 };
const summaryBoxStyle: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 16, background: "rgba(123,34,24,0.06)", border: "1px solid rgba(123,34,24,0.15)", color: C.text, fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" };
const sectionLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };
const productChipStyle: React.CSSProperties = { padding: "6px 12px", borderRadius: 999, background: "rgba(123,34,24,0.10)", color: C.primary, fontWeight: 700, fontSize: 13 };
const infoGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 14 };
const infoCardStyle: React.CSSProperties = { background: "white", border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 };
const textareaStyle: React.CSSProperties = { width: "100%", minHeight: 90, padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, boxSizing: "border-box", outline: "none", background: "white", color: C.text, fontSize: 14, resize: "vertical", marginBottom: 8 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "none", background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, color: "white", cursor: "pointer", fontWeight: 700 };
const secondaryButtonStyle: React.CSSProperties = { display: "inline-block", padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.8)", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14 };
const waButtonStyle: React.CSSProperties = { display: "inline-block", padding: "10px 16px", borderRadius: 12, border: "none", background: "#25D366", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 14 };
const chatBoxStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflowY: "auto", padding: 12, borderRadius: 16, background: "#efe7dc", border: `1px solid ${C.border}` };
const bubbleStyle: React.CSSProperties = { maxWidth: "78%", padding: "8px 12px", borderRadius: 14, border: "1px solid", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" };
