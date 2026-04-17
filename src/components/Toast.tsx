"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "✅" },
  error:   { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: "❌" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "⚠️" },
  info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", icon: "ℹ️" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxWidth: 400,
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => {
            const c = COLORS[t.type];
            return (
              <div
                key={t.id}
                onClick={() => removeToast(t.id)}
                style={{
                  pointerEvents: "auto",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderRadius: 14,
                  background: c.bg,
                  border: `1.5px solid ${c.border}`,
                  color: c.text,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Arial, sans-serif",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  animation: "slideIn 0.3s ease-out",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                <span>{t.message}</span>
              </div>
            );
          })}
        </div>
      )}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: if used outside provider, use alert (backward compatible)
    return {
      toast: (message: string) => {
        alert(message);
      },
    };
  }
  return ctx;
}
