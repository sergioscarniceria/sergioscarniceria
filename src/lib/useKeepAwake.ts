"use client";
/**
 * Hook para evitar que el Fire TV active el fondo ambiental.
 *
 * Técnica probada: reproducir un video MP4 REAL HOSTEADO (no base64) con audio track.
 * El Fire TV NO activa el fondo ambiental mientras detecta video activo en el navegador.
 */
import { useEffect, useRef } from "react";

const KEEP_AWAKE_VIDEO_URL =
  "https://wtyxkekfcupzfjxmdyvv.supabase.co/storage/v1/object/public/display-media/keep-awake.mp4";

const RELOAD_AFTER_MS = 4 * 60 * 1000;
const HEARTBEAT_MS = 10_000;

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
      } catch {}
    };

    // Video MP4 real con audio track — visible (no display:none) para que el sistema lo cuente como reproducción
    const v = document.createElement("video");
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.preload = "auto";
    v.src = KEEP_AWAKE_VIDEO_URL;
    v.crossOrigin = "anonymous";
    // Visible pero imperceptible — NO usar display:none ni visibility:hidden (el OS no lo contaría)
    v.style.position = "fixed";
    v.style.bottom = "2px";
    v.style.right = "2px";
    v.style.width = "2px";
    v.style.height = "2px";
    v.style.opacity = "0.01";
    v.style.pointerEvents = "none";
    v.style.zIndex = "2147483647";
    document.body.appendChild(v);
    videoRef.current = v;

    const playVideo = () => {
      v.play().catch(() => {
        // Si autoplay bloqueado, esperar primer click del usuario
        const onceClick = () => {
          v.play().catch(() => {});
          document.removeEventListener("click", onceClick);
          document.removeEventListener("keydown", onceClick);
        };
        document.addEventListener("click", onceClick, { once: true });
        document.addEventListener("keydown", onceClick, { once: true });
      });
    };
    playVideo();
    requestWakeLock();

    const heartbeat = setInterval(() => {
      if (!active) return;
      if (v.paused || v.ended || v.readyState < 2) {
        playVideo();
      }
      if (!wakeLockRef.current) requestWakeLock();
    }, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "visible") {
        requestWakeLock();
        playVideo();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Auto-reload cada 4 minutos como respaldo final
    const reloadTimer = setTimeout(() => {
      if (active) {
        try { window.location.reload(); } catch {}
      }
    }, RELOAD_AFTER_MS);

    return () => {
      active = false;
      clearInterval(heartbeat);
      clearTimeout(reloadTimer);
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
