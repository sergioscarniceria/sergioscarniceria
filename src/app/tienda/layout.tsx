import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sergio's Carnicería | Pide en línea",
  description: "Pide tus cortes frescos directo de la carnicería. Entrega rápida.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sergio's",
  },
};

export const viewport: Viewport = {
  themeColor: "#7b2218",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
