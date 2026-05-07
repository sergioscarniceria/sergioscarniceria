"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type MediaItem = {
  id: string;
  file_name: string;
  file_url: string;
  media_type: "image" | "video";
  target: "mostrador" | "caja" | "ambos";
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

const COLORS = {
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
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const BUCKET = "display-media";

function storageUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export default function AdminDisplayPage() {
  const supabase = getSupabaseClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"mostrador" | "caja" | "ambos">("ambos");
  const [filterTarget, setFilterTarget] = useState<"todos" | "mostrador" | "caja" | "ambos">("todos");

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    try {
      const { data, error } = await supabase
        .from("display_media")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.log(error);
      }
      setMedia((data as MediaItem[]) || []);
    } catch (err) {
      console.log("Error loading media:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isVideo = ["mp4", "webm"].includes(ext);
      const mediaType = isVideo ? "video" : "image";
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const path = `${uploadTarget}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.log(uploadError);
        alert(`Error subiendo ${file.name}: ${uploadError.message}`);
        continue;
      }

      const maxOrder = media.length > 0 ? Math.max(...media.map((m) => m.sort_order)) : 0;

      const { error: insertError } = await supabase.from("display_media").insert([
        {
          file_name: file.name,
          file_url: storageUrl(path),
          media_type: mediaType,
          target: uploadTarget,
          sort_order: maxOrder + 1,
          is_active: true,
        },
      ]);

      if (insertError) {
        console.log(insertError);
        alert(`Archivo subido pero error en BD: ${insertError.message}`);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    await loadMedia();
  }

  async function toggleActive(item: MediaItem) {
    await supabase.from("display_media").update({ is_active: !item.is_active }).eq("id", item.id);
    await loadMedia();
  }

  async function changeTarget(item: MediaItem, newTarget: "mostrador" | "caja" | "ambos") {
    await supabase.from("display_media").update({ target: newTarget }).eq("id", item.id);
    await loadMedia();
  }

  async function moveOrder(item: MediaItem, direction: "up" | "down") {
    const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((m) => m.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    await supabase.from("display_media").update({ sort_order: other.sort_order }).eq("id", item.id);
    await supabase.from("display_media").update({ sort_order: item.sort_order }).eq("id", other.id);
    await loadMedia();
  }

  async function deleteMedia(item: MediaItem) {
    if (!confirm(`Eliminar "${item.file_name}"?`)) return;

    // Extraer path del storage desde la URL
    const urlParts = item.file_url.split(`/${BUCKET}/`);
    if (urlParts.length > 1) {
      await supabase.storage.from(BUCKET).remove([urlParts[1]]);
    }

    await supabase.from("display_media").delete().eq("id", item.id);
    await loadMedia();
  }

  const filtered = filterTarget === "todos"
    ? media
    : media.filter((m) => m.target === filterTarget || m.target === "ambos");

  const targetLabel: Record<string, string> = {
    mostrador: "Mostrador",
    caja: "Caja",
    ambos: "Ambos",
  };

  const targetColor: Record<string, string> = {
    mostrador: COLORS.primary,
    caja: COLORS.success,
    ambos: COLORS.warning,
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/" style={{ color: COLORS.muted, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              ← Inicio
            </Link>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, marginTop: 4 }}>
              Pantalla del cliente
            </h1>
            <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
              Sube imágenes o videos para mostrar en los monitores de mostrador y caja
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/display/mostrador" target="_blank" style={{
              padding: "10px 16px", borderRadius: 12, background: "white",
              border: `1px solid ${COLORS.border}`, color: COLORS.primary,
              textDecoration: "none", fontWeight: 700, fontSize: 13,
            }}>
              Ver display mostrador
            </Link>
            <Link href="/display/caja" target="_blank" style={{
              padding: "10px 16px", borderRadius: 12, background: "white",
              border: `1px solid ${COLORS.border}`, color: COLORS.success,
              textDecoration: "none", fontWeight: 700, fontSize: 13,
            }}>
              Ver display caja
            </Link>
          </div>
        </div>

        {/* Upload section */}
        <div style={{
          background: COLORS.card, borderRadius: 20, padding: 24,
          border: `1px solid ${COLORS.border}`, marginBottom: 24,
          boxShadow: "0 4px 16px rgba(91,25,15,0.06)",
        }}>
          <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 16, marginBottom: 14 }}>
            Subir contenido
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4, display: "block" }}>
                Destino
              </label>
              <select
                value={uploadTarget}
                onChange={(e) => setUploadTarget(e.target.value as any)}
                style={{
                  padding: "10px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  background: "white", color: COLORS.text, fontWeight: 600, fontSize: 14,
                }}
              >
                <option value="ambos">Ambos monitores</option>
                <option value="mostrador">Solo mostrador</option>
                <option value="caja">Solo caja</option>
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4, display: "block" }}>
                Archivos (JPG, PNG, WebP, MP4, WebM)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                style={{
                  padding: "10px", borderRadius: 12, border: `1px solid ${COLORS.border}`,
                  background: "white", width: "100%", fontSize: 14,
                }}
              />
            </div>
          </div>

          {uploading && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(123,34,24,0.06)", color: COLORS.primary, fontWeight: 700, fontSize: 13 }}>
              Subiendo archivos...
            </div>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["todos", "mostrador", "caja", "ambos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterTarget(t)}
              style={{
                padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13,
                background: filterTarget === t ? COLORS.primary : "white",
                color: filterTarget === t ? "white" : COLORS.text,
              }}
            >
              {t === "todos" ? "Todos" : targetLabel[t]}
            </button>
          ))}
          <span style={{ marginLeft: "auto", color: COLORS.muted, fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            {filtered.length} archivo{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Media grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 60, borderRadius: 20,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🖼</div>
            <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Sin contenido</div>
            <div style={{ color: COLORS.muted, fontSize: 14 }}>
              Sube imágenes o videos para que aparezcan en la pantalla del cliente
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filtered.map((item) => (
              <div key={item.id} style={{
                background: COLORS.card, borderRadius: 18, overflow: "hidden",
                border: `1px solid ${COLORS.border}`,
                opacity: item.is_active ? 1 : 0.5,
                boxShadow: "0 4px 16px rgba(91,25,15,0.06)",
              }}>
                {/* Preview */}
                <div style={{ position: "relative", height: 180, background: "#1a0a08" }}>
                  {item.media_type === "video" ? (
                    <video
                      src={item.file_url}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      muted
                      playsInline
                      onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseOut={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
                    />
                  ) : (
                    <img src={item.file_url} alt={item.file_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}

                  {/* Badge tipo */}
                  <div style={{
                    position: "absolute", top: 8, left: 8,
                    padding: "4px 10px", borderRadius: 8,
                    background: "rgba(0,0,0,0.6)", color: "white",
                    fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)",
                  }}>
                    {item.media_type === "video" ? "VIDEO" : "IMAGEN"}
                  </div>

                  {/* Badge target */}
                  <div style={{
                    position: "absolute", top: 8, right: 8,
                    padding: "4px 10px", borderRadius: 8,
                    background: `${targetColor[item.target]}20`,
                    color: targetColor[item.target],
                    fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)",
                    border: `1px solid ${targetColor[item.target]}30`,
                  }}>
                    {targetLabel[item.target]}
                  </div>

                  {!item.is_active && (
                    <div style={{
                      position: "absolute", bottom: 8, left: 8,
                      padding: "4px 10px", borderRadius: 8,
                      background: "rgba(180,35,24,0.8)", color: "white",
                      fontSize: 11, fontWeight: 700,
                    }}>
                      INACTIVO
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.file_name}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <select
                      value={item.target}
                      onChange={(e) => changeTarget(item, e.target.value as any)}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                        background: "white", fontSize: 12, fontWeight: 600, color: COLORS.text,
                      }}
                    >
                      <option value="ambos">Ambos</option>
                      <option value="mostrador">Mostrador</option>
                      <option value="caja">Caja</option>
                    </select>

                    <button onClick={() => moveOrder(item, "up")} title="Subir"
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>
                      ↑
                    </button>
                    <button onClick={() => moveOrder(item, "down")} title="Bajar"
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>
                      ↓
                    </button>

                    <button onClick={() => toggleActive(item)}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 700,
                        background: item.is_active ? "rgba(180,35,24,0.08)" : "rgba(31,122,77,0.08)",
                        color: item.is_active ? COLORS.danger : COLORS.success,
                      }}>
                      {item.is_active ? "Desactivar" : "Activar"}
                    </button>

                    <button onClick={() => deleteMedia(item)}
                      style={{
                        padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 700, background: "rgba(180,35,24,0.08)", color: COLORS.danger,
                        marginLeft: "auto",
                      }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
