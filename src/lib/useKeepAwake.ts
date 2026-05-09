"use client";
/**
 * Hook agresivo para evitar que la pantalla se apague — especialmente Fire TV.
 *
 * Combina varias técnicas porque el Silk Browser del Fire TV ignora Wake Lock API:
 * 1. Wake Lock API (navegadores modernos)
 * 2. Video silencioso en loop (NoSleep.js)
 * 3. Auto-reload de la página cada 4 minutos (antes del screensaver de 5min del Fire OS)
 * 4. Eventos sintéticos de actividad (mousemove, keypress) cada 20 segundos
 * 5. Modificación del DOM cada segundo (mantiene el rendering activo)
 *
 * Uso: agregar `useKeepAwake();` al inicio de cualquier página que deba quedarse encendida.
 */
import { useEffect, useRef } from "react";

// MP4 mínimo silencioso embebido (1 frame, ~1KB)
const SILENT_MP4 =
  "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAGF21kYXTeBAAAbGliZmFhYyAxLjI4AABCAJMgBDIARwAAArEGBf//rdxF6b3m2Ui3lizYINkj7v3JMYfBcwsTfaT6/wj8gNXEbmJj4Hnq2IvSXFLqkP2C0+xS3RqPtKB1FAVYcyStSUgvlYKKyWl5WYuD9ndaBmWEPGEyHGBZbgAAA1gZYiCgABFAAB+AAAfwAACgkA39//u9xz/eXwj4y//+78z70nIw/vUuUyiNMYkS//H/v+5N7/EmsAAAAAAAACAAACAAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAAAAAAAAA";

const RELOAD_AFTER_MS = 4 * 60 * 1000; // 4 minutos (antes del screensaver de 5min)
const ACTIVITY_INTERVAL_MS = 20_000; // simular actividad cada 20s
const DOM_TICK_MS = 1000; // tick visual cada 1s

type WakeLockSentinelLike = { release: () => Promise<void> };

export function useKeepAwake() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let active = true;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
        };
        if (typeof navigator !== "undefined" && nav.wakeLock) {
          const lock = await nav.wakeLock.request("screen");
          wakeLockRef.current = lock;
        }
      } catch {
        // fallback to video / activity
      }
    };

    // ─── 1. Video silencioso oculto ───
    const v = document.createElement("video");
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.src = SILENT_MP4;
    v.style.position = "fixed";
    v.style.bottom = "0";
    v.style.right = "0";
    v.style.width = "1px";
    v.style.height = "1px";
    v.style.opacity = "0.01";
    v.style.pointerEvents = "none";
    v.style.zIndex = "-1";
    document.body.appendChild(v);
    videoRef.current = v;

    const playVideo = () => {
      v.play().catch(() => {});
    };
    playVideo();
    requestWakeLock();

    // ─── 2. Tick del DOM (mantiene render activo) ───
    // Crea un elemento invisible que cambia cada segundo
    const tickEl = document.createElement("div");
    tickEl.id = "__keepawake_tick";
    tickEl.style.position = "fixed";
    tickEl.style.bottom = "0";
    tickEl.style.left = "0";
    tickEl.style.width = "1px";
    tickEl.style.height = "1px";
    tickEl.style.opacity = "0.01";
    tickEl.style.pointerEvents = "none";
    tickEl.style.zIndex = "-1";
    document.body.appendChild(tickEl);

    let tickCounter = 0;
    const domTick = setInterval(() => {
      if (!active) return;
      tickCounter++;
      tickEl.textContent = String(tickCounter);
      // Forzar repaint con transform mínimo
      tickEl.style.transform = `translate(${tickCounter % 2}px, 0)`;
    }, DOM_TICK_MS);

    // ─── 3. Eventos sintéticos de actividad (engaña al detector de idle) ───
    const fireActivity = () => {
      try {
        // Mousemove sintético
        const evt = new MouseEvent("mousemove", {
          bubbles: true,
          cancelable: true,
          clientX: Math.random() * 10,
          clientY: Math.random() * 10,
        });
        document.dispatchEvent(evt);
        // Pequeño scroll y volver
        const y = window.scrollY;
        window.scrollTo(0, y + 1);
        window.scrollTo(0, y);
      } catch {}
    };

    const activityTimer = setInterval(() => {
      if (!active) return;
      fireActivity();
      if (v.paused) playVideo();
      if (!wakeLockRef.current) requestWakeLock();
    }, ACTIVITY_INTERVAL_MS);

    // ─── 4. Re-activar al volver a primer plano ───
    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "visible") {
        requestWakeLock();
        playVideo();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // ─── 5. Auto-reload cada 4 minutos (lo más efectivo en Fire TV) ───
    const reloadTimer = setTimeout(() => {
      if (active) {
        try {
          window.location.reload();
        } catch {}
      }
    }, RELOAD_AFTER_MS);

    return () => {
      active = false;
      clearInterval(domTick);
      clearInterval(activityTimer);
      clearTimeout(reloadTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
      }
      if (tickEl.parentNode) tickEl.parentNode.removeChild(tickEl);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);
}
