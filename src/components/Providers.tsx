"use client";

import { ReactNode } from "react";
import { ToastProvider } from "./Toast";
import ConnectionBanner from "./ConnectionBanner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConnectionBanner />
      {children}
    </ToastProvider>
  );
}
