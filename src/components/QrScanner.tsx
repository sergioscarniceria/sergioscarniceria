"use client";
import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Check BarcodeDetector support
        if ("BarcodeDetector" in window) {
          // @ts-ignore - BarcodeDetector is not in TS types yet
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          scanLoop(detector);
        } else {
          setError("Tu navegador no soporta escaneo QR nativo. Usa Chrome o Safari actualizado.");
        }
      } catch (err: any) {
        if (mounted) {
          if (err.name === "NotAllowedError") {
            setError("Permiso de cámara denegado. Permite el acceso a la cámara.");
          } else {
            setError("No se pudo acceder a la cámara: " + (err.message || ""));
          }
        }
      }
    }

    async function scanLoop(detector: any) {
      if (!mounted || !scanning || scannedRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0 && !scannedRef.current) {
            scannedRef.current = true;
            const value = barcodes[0].rawValue;
            // Vibrate on scan if supported
            if (navigator.vibrate) navigator.vibrate(100);
            onScan(value);
            stopCamera();
            return;
          }
        } catch (_) {
          // detect can fail on some frames, just skip
        }
      }
      animRef.current = requestAnimationFrame(() => scanLoop(detector));
    }

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.85)", zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 16, maxWidth: 400, width: "90%",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>📷 Escanear QR</span>
          <button onClick={() => { stopCamera(); onClose(); }} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 4,
          }}>✕</button>
        </div>

        <div style={{
          position: "relative", width: "100%", aspectRatio: "4/3",
          borderRadius: 12, overflow: "hidden", background: "#000",
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Scan frame overlay */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "60%", height: "60%",
            border: "3px solid #22c55e",
            borderRadius: 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
          }} />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {error ? (
          <div style={{ color: "#b42318", fontSize: 13, textAlign: "center", padding: 8 }}>{error}</div>
        ) : (
          <div style={{ color: "#666", fontSize: 13, textAlign: "center" }}>
            Apunta la cámara al código QR del ticket o cliente
          </div>
        )}
      </div>
    </div>
  );
}
