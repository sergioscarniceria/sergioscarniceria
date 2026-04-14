import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sergio's Carnicería | Carnes de calidad en Ezequiel Montes, Qro.",
    template: "%s | Sergio's Carnicería",
  },
  description:
    "Cortes de carne premium, marinados y productos frescos con entrega a domicilio. Pide en línea o visita nuestra sucursal en Ezequiel Montes, Querétaro.",
  keywords: [
    "carnicería",
    "carnes",
    "cortes premium",
    "marinados",
    "Ezequiel Montes",
    "Querétaro",
    "pedidos en línea",
    "entrega a domicilio",
  ],
  openGraph: {
    title: "Sergio's Carnicería | Carnes de calidad en Ezequiel Montes, Qro.",
    description:
      "Cortes de carne premium, marinados y productos frescos con entrega a domicilio.",
    url: "https://sergioscarniceria.com",
    siteName: "Sergio's Carnicería",
    locale: "es_MX",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "FoodEstablishment"],
  name: "Sergio's Carnicería",
  url: "https://sergioscarniceria.com",
  logo: "https://sergioscarniceria.com/logo.png",
  image: "https://sergioscarniceria.com/logo.png",
  description:
    "Cortes de carne premium, marinados y productos frescos con entrega a domicilio en Ezequiel Montes, Querétaro.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "H. Colegio Militar No. 122",
    addressLocality: "Ezequiel Montes",
    addressRegion: "Querétaro",
    addressCountry: "MX",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 20.6627,
    longitude: -99.9871,
  },
  telephone: "+524421234567",
  servesCuisine: "Carnicería mexicana",
  priceRange: "$$",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
      opens: "07:30",
      closes: "15:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Wednesday", "Sunday"],
      opens: "07:30",
      closes: "15:00",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
