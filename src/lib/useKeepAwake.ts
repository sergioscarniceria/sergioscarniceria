"use client";
/**
 * Hook que evita que la pantalla se apague (Fire TV, tablets, etc).
 *
 * Combina dos técnicas:
 * 1. Wake Lock API (navegadores modernos)
 * 2. Video silencioso en loop (técnica NoSleep.js) — funciona en Fire TV/Android donde
 *    el sistema operativo no apaga la pantalla mientras hay video reproduciéndose.
 *
 * Uso: agregar `useKeepAwake();` al inicio de cualquier página que deba quedarse encendida.
 */
import { useEffect, useRef } from "react";

// MP4 mínimo silencioso (1 frame, ~1KB) — el video corto se reproduce en loop
const SILENT_MP4 =
  "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAGF21kYXTeBAAAbGliZmFhYyAxLjI4AABCAJMgBDIARwAAArEGBf//rdxF6b3m2Ui3lizYINkj7v3JMYfBcwsTfaT6/wj8gNXEbmJj4Hnq2IvSXFLqkP2C0+xS3RqPtKB1FAVYcyStSUgvlYKKyWl5WYuD9ndaBmWEPGEyHGBZbgAAA1gZYiCgABFAAB+AAAfwAACgkA39//u9xz/eXwj4y//+78z70nIw/vUuUyiNMYkS//H/v+5N7/EmsAAAAAAAACAAACAAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAACAAAAAAAAAA";

declare global {
  interface Navigator {
    wakeLock?: {
      request: (type: "screen") => Promise<{
        release: () => Promise<void>;
        addEventListener: (type: "release", cb: () => void) => void;
      }>;
    };
  }
}

export function useKeepAwake() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    let active = true;

    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.wakeLock) {
          const lock = await navigator.wakeLock.request("screen");
          wakeLockRef.current = lock;
        }
      } catch {
        // Silently fall back to video technique
      }
    };

    // Crear video oculto en loop (técnica NoSleep.js para Fire TV/Android)
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
      v.play().catch(() => {
        // Algunos navegadores bloquean autoplay sin interacción
      });
    };
    playVideo();
    requestWakeLock();

    // Re-activar al volver a primer plano
    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "visible") {
        requestWakeLock();
        playVideo();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // "Heartbeat" cada 30s para asegurar que el video sigue reproduciéndose
    const heartbeat = setInterval(() => {
      if (!active) return;
      if (v.paused) playVideo();
      // Re-pedir wake lock si se perdió
      if (!wakeLockRef.current) requestWakeLock();
    }, 30_000);

    return () => {
      active = false;
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);
}
