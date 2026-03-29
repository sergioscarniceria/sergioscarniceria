"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  credit_enabled?: boolean | null;
  credit_limit?: number | null;
  credit_days?: number | null;
};

type Product = {
  id: string;
  name: string;
  price: number | null;
  is_active?: boolean | null;
  is_excluded_from_discount?: boolean | null;
};

type NoteItem = {
  product_id: string;
  product: string;
  quantity: string;
  unit: string;
  price: string;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
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

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateString: string, days: number) {
  const base = new Date(`${dateString}T12:00:00`);
  if (isNaN(base.getTime())) return dateString;
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = `${base.getMonth() + 1}`.padStart(2, "0");
  const day = `${base.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return Number(value || 0).toFixed(2);
}

function makeNoteNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  const seconds = `${now.getSeconds()}`.padStart(2, "0");
  return `NC-${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export default function NuevaNotaCxcPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [noteDate, setNoteDate] = useState(todayDateString());
  const [dueDate, setDueDate] = useState(todayDateString());
  const [noteNumber, setNoteNumber] = useState(makeNoteNumber());
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [showCustomerCatalog, setShowCustomerCatalog] = useState(false);
  const [showProductCatalog, setShowProductCatalog] = useState(false);

  const [items, setItems] = useState<NoteItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, name, phone, email, credit_enabled, credit_limit, credit_days")
      .order("name", { ascending: true });

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, is_active, is_excluded_from_discount")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (customersError) {
      console.log(customersError);
      alert("No se pudieron cargar los clientes");
      setLoading(false);
      return;
    }

    if (productsError) {
      console.log(productsError);
      alert("No se pudieron cargar los productos");
      setLoading(false);
      return;
    }

    setCustomers((customersData as Customer[]) || []);
    setProducts((productsData as Product[]) || []);
    setLoading(false);
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setShowCustomerCatalog(false);

    const creditDays = Number(customer.credit_days || 0);
    const safeDays = creditDays > 0 ? creditDays : 7;
    setDueDate(addDaysToDate(noteDate, safeDays));
  }

  function removeCustomer() {
    setSelectedCustomer(null);
    setCustomerSearch("");
  }

  function addProduct(product: Product) {
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product: product.name,
        quantity: "1",
        unit: "kg",
        price: String(Number(product.price || 0)),
      },
    ]);

    setProductSearch("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof NoteItem, value: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  const searchedCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return [];
    return customers
      .filter((customer) => {
        return (
          (customer.name || "").toLowerCase().includes(q) ||
          (customer.phone || "").toLowerCase().includes(q) ||
          (customer.email || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const searchedProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return [];
    return products
      .filter((product) => (product.name || "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, productSearch]);

  const customerCatalog = useMemo(() => {
    if (!showCustomerCatalog) return [];
    return customers.filter((customer) => Boolean(customer.credit_enabled));
  }, [customers, showCustomerCatalog]);

  const productCatalog = useMemo(() => {
    if (!showProductCatalog) return [];
    return products;
  }, [products, showProductCatalog]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return acc + quantity * price;
    }, 0);
  }, [items]);

  const discount = Math.max(0, Number(discountAmount || 0));
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (!selectedCustomer) return;
    const creditDays = Number(selectedCustomer.credit_days || 0);
    const safeDays = creditDays > 0 ? creditDays : 7;
    setDueDate(addDaysToDate(noteDate, safeDays));
  }, [noteDate, selectedCustomer]);

  async function saveNote() {
    if (!selectedCustomer) {
      alert("Selecciona un cliente");
      return;
    }

    if (items.length === 0) {
      alert("Agrega al menos un producto");
      return;
    }

    const validItems = items.every((item) => {
      return (
        item.product.trim() &&
        Number(item.quantity) > 0 &&
        Number(item.price) >= 0
      );
    });

    if (!validItems) {
      alert("Revisa cantidades, nombres y precios de los productos");
      return;
    }

    setSaving(true);

    const finalNoteNumber = noteNumber.trim() || makeNoteNumber();

    const { data: insertedNote, error: noteError } = await supabase
      .from("cxc_notes")
      .insert([
        {
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          note_number: finalNoteNumber,
          note_date: noteDate,
          due_date: dueDate,
          source_type: "manual",
          subtotal: Number(subtotal.toFixed(2)),
          discount_amount: Number(discount.toFixed(2)),
          total_amount: Number(total.toFixed(2)),
          balance_due: Number(total.toFixed(2)),
          status: total > 0 ? "abierta" : "pagada",
          notes: notes.trim() || null,
        },
      ])
      .select("*")
      .single();

    if (noteError || !insertedNote) {
      console.log(noteError);
      alert("No se pudo guardar la nota");
      setSaving(false);
      return;
    }

    const itemsPayload = items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);

      return {
        cxc_note_id: insertedNote.id,
        product: item.product.trim(),
        quantity: Number(quantity.toFixed(3)),
        unit: item.unit.trim() || "kg",
        price: Number(price.toFixed(2)),
        line_total: Number((quantity * price).toFixed(2)),
      };
    });

    const { error: itemsError } = await supabase
      .from("cxc_note_items")
      .insert(itemsPayload);

    if (itemsError) {
      console.log(itemsError);
      alert("La nota se creó, pero fallaron los renglones");
      setSaving(false);
      return;
    }

    alert("Nota a crédito guardada");

    setSelectedCustomer(null);
    setCustomerSearch("");
    setProductSearch("");
    setItems([]);
    setDiscountAmount("0");
    setNotes("");
    setNoteDate(todayDateString());
    setDueDate(todayDateString());
    setNoteNumber(makeNoteNumber());
    setShowCustomerCatalog(false);
    setShowProductCatalog(false);
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando nueva nota...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Nueva nota a crédito</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Captura manual preparada para futura integración con pedidos y caja
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>Volver a CxC</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={leftColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>1. Cliente</h2>
                  <p style={panelSubtitleStyle}>Selecciona un cliente con crédito</p>
                </div>
              </div>

              <div style={searchBarRowStyle}>
                <input
                  placeholder="Buscar cliente"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />

                <button
                  onClick={() => setShowCustomerCatalog((prev) => !prev)}
                  style={catalogButtonStyle}
                >
                  {showCustomerCatalog ? "Ocultar cartera" : "Ver cartera"}
                </button>
              </div>

              {selectedCustomer ? (
                <div style={selectedBoxStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={selectedTitleStyle}>{selectedCustomer.name}</div>
                    <div style={metaTextStyle}>
                      Crédito: <b>{selectedCustomer.credit_enabled ? "Sí" : "No"}</b>
                    </div>
                    <div style={metaTextStyle}>
                      Días: <b>{selectedCustomer.credit_days || 7}</b>
                    </div>
                    <div style={metaTextStyle}>
                      Límite: <b>${money(Number(selectedCustomer.credit_limit || 0))}</b>
                    </div>
                    {selectedCustomer.phone ? (
                      <div style={metaTextStyle}>Tel: {selectedCustomer.phone}</div>
                    ) : null}
                  </div>

                  <button onClick={removeCustomer} style={dangerSoftButtonStyle}>
                    Quitar
                  </button>
                </div>
              ) : null}

              {customerSearch.trim() ? (
                <div style={{ marginTop: 16 }}>
                  <div style={miniTitleStyle}>Resultados</div>

                  {searchedCustomers.length === 0 ? (
                    <div style={emptyBoxStyle}>No encontramos clientes</div>
                  ) : (
                    <div style={listWrapStyle}>
                      {searchedCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          style={searchRowStyle}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={searchRowTitleStyle}>{customer.name}</div>
                            <div style={searchRowMetaStyle}>
                              {customer.phone || "Sin teléfono"}
                            </div>
                          </div>

                          <div style={badgeStyle}>
                            {customer.credit_enabled ? "Crédito" : "Contado"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showCustomerCatalog ? (
                <div style={{ marginTop: 18 }}>
                  <div style={miniTitleStyle}>Clientes con crédito</div>

                  <div style={catalogListStyle}>
                    {customerCatalog.length === 0 ? (
                      <div style={emptyBoxStyle}>No hay clientes con crédito activo</div>
                    ) : (
                      customerCatalog.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          style={searchRowStyle}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={searchRowTitleStyle}>{customer.name}</div>
                            <div style={searchRowMetaStyle}>
                              {customer.phone || "Sin teléfono"}
                            </div>
                          </div>

                          <div style={badgeStyle}>
                            {customer.credit_days || 7} días
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>2. Datos de la nota</h2>
                  <p style={panelSubtitleStyle}>Folio, fechas y observaciones</p>
                </div>
              </div>

              <div style={formGridStyle}>
                <div>
                  <div style={fieldLabelStyle}>Folio</div>
                  <input
                    value={noteNumber}
                    onChange={(e) => setNoteNumber(e.target.value)}
                    style={inputStyle}
                    placeholder="Ejemplo: NC-20260329-123000"
                  />
                </div>

                <div>
                  <div style={fieldLabelStyle}>Fecha de nota</div>
                  <input
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={fieldLabelStyle}>Vencimiento</div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={fieldLabelStyle}>Descuento total</div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div style={fieldLabelStyle}>Notas</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={textareaStyle}
                placeholder="Observaciones de la nota o condiciones del crédito"
              />
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>3. Productos</h2>
                  <p style={panelSubtitleStyle}>Agrégalos desde el catálogo actual</p>
                </div>
              </div>

              <div style={searchBarRowStyle}>
                <input
                  placeholder="Buscar producto"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />

                <button
                  onClick={() => setShowProductCatalog((prev) => !prev)}
                  style={catalogButtonStyle}
                >
                  {showProductCatalog ? "Ocultar catálogo" : "Ver catálogo"}
                </button>
              </div>

              {productSearch.trim() ? (
                <div style={{ marginTop: 16 }}>
                  <div style={miniTitleStyle}>Resultados</div>

                  {searchedProducts.length === 0 ? (
                    <div style={emptyBoxStyle}>No encontramos productos</div>
                  ) : (
                    <div style={listWrapStyle}>
                      {searchedProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addProduct(product)}
                          style={searchRowStyle}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={searchRowTitleStyle}>{product.name}</div>
                            <div style={searchRowMetaStyle}>
                              ${money(Number(product.price || 0))}
                            </div>
                          </div>

                          <div style={badgeStyle}>Agregar</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showProductCatalog ? (
                <div style={{ marginTop: 18 }}>
                  <div style={miniTitleStyle}>Catálogo</div>

                  <div style={catalogListStyle}>
                    {productCatalog.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        style={searchRowStyle}
                      >
                        <div style={{ textAlign: "left", minWidth: 0 }}>
                          <div style={searchRowTitleStyle}>{product.name}</div>
                          <div style={searchRowMetaStyle}>
                            ${money(Number(product.price || 0))}
                          </div>
                        </div>

                        <div style={badgeStyle}>Agregar</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {items.length === 0 ? (
                <div style={{ ...emptyBoxStyle, marginTop: 16 }}>
                  Todavía no agregas productos a la nota
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <div style={miniTitleStyle}>Renglones de la nota</div>

                  <div style={itemListStyle}>
                    {items.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const price = Number(item.price || 0);
                      const lineTotal = quantity * price;

                      return (
                        <div key={`${item.product_id}-${index}`} style={itemCardStyle}>
                          <div style={itemTopRowStyle}>
                            <div style={{ minWidth: 0 }}>
                              <div style={itemTitleStyle}>{item.product}</div>
                              <div style={searchRowMetaStyle}>
                                Importe: ${money(lineTotal)}
                              </div>
                            </div>

                            <button
                              onClick={() => removeItem(index)}
                              style={dangerSoftButtonStyle}
                            >
                              Quitar
                            </button>
                          </div>

                          <div style={itemGridStyle}>
                            <div>
                              <div style={fieldLabelStyle}>Cantidad</div>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(index, "quantity", e.target.value)
                                }
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <div style={fieldLabelStyle}>Unidad</div>
                              <input
                                value={item.unit}
                                onChange={(e) =>
                                  updateItem(index, "unit", e.target.value)
                                }
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <div style={fieldLabelStyle}>Precio</div>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.price}
                                onChange={(e) =>
                                  updateItem(index, "price", e.target.value)
                                }
                                style={inputStyle}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={rightColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Resumen</h2>
                  <p style={panelSubtitleStyle}>Revisa antes de guardar</p>
                </div>
              </div>

              {!selectedCustomer ? (
                <div style={emptyBoxStyle}>Primero selecciona un cliente</div>
              ) : (
                <div style={selectedBoxStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={selectedTitleStyle}>{selectedCustomer.name}</div>
                    <div style={metaTextStyle}>
                      Crédito a {selectedCustomer.credit_days || 7} días
                    </div>
                    <div style={metaTextStyle}>
                      Vence: <b>{dueDate}</b>
                    </div>
                  </div>
                </div>
              )}

              <div style={summaryStackStyle}>
                <div style={summaryRowStyle}>
                  <span>Renglones</span>
                  <b>{items.length}</b>
                </div>

                <div style={summaryRowStyle}>
                  <span>Subtotal</span>
                  <b>${money(subtotal)}</b>
                </div>

                <div style={summaryRowStyle}>
                  <span>Descuento</span>
                  <b>${money(discount)}</b>
                </div>

                <div style={totalBoxStyle}>
                  <span>Total / saldo inicial</span>
                  <span>${money(total)}</span>
                </div>
              </div>

              <button
                onClick={saveNote}
                disabled={saving}
                style={{ ...primaryButtonStyle, width: "100%" }}
              >
                {saving ? "Guardando..." : "Guardar nota a crédito"}
              </button>
            </div>
          </div>
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
  maxWidth: 1450,
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

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(360px, 0.85fr)",
  gap: 20,
  alignItems: "start",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
  fontWeight: 700,
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
  marginBottom: 12,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
  resize: "vertical",
};

const searchBarRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const catalogButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "rgba(123, 34, 24, 0.12)",
  color: COLORS.primary,
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const selectedBoxStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginTop: 12,
};

const selectedTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 18,
};

const dangerSoftButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 700,
  flexShrink: 0,
};

const miniTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  marginBottom: 10,
  fontSize: 18,
};

const listWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const catalogListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 420,
  overflowY: "auto",
  paddingRight: 4,
};

const searchRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bgSoft,
  cursor: "pointer",
};

const searchRowTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  color: COLORS.text,
};

const searchRowMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  textTransform: "capitalize",
  flexShrink: 0,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const itemListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const itemCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const itemTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const itemTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
};

const itemGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
};

const summaryStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
  marginBottom: 14,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const totalBoxStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  borderRadius: 18,
  background: COLORS.primary,
  color: "white",
  fontWeight: 700,
  fontSize: 18,
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

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
  cursor: "pointer",
};