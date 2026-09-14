import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  // Necesario para que las rutas relativas (og:image, canonical) se vuelvan absolutas
  metadataBase: new URL("https://sergioscarniceria.com"),
  alternates: { canonical: "/" },
  title: {
    default:
      "Carnicería en Ezequiel Montes | Sergio's Carnicería — Carne para asar y cortes premium",
    template: "%s | Sergio's Carnicería",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  description:
    "Carnicería en Ezequiel Montes, Querétaro con más de 50 años. Arrachera, rib eye, carne para asar, res, cerdo, pollo y marinados. Pedidos en línea, entrega a domicilio y venta a mayoreo para restaurantes y eventos.",
  keywords: [
    "carnicería Ezequiel Montes",
    "carnicería Querétaro",
    "carne para asar Ezequiel Montes",
    "arrachera",
    "rib eye",
    "cortes premium",
    "carne marinada",
    "carne al mayoreo",
    "carnicería a domicilio",
    "res cerdo pollo",
    "Tequisquiapan",
    "Bernal",
  ],
  openGraph: {
    title: "Sergio's Carnicería | Carnes de calidad en Ezequiel Montes, Qro.",
    description:
      "Cortes de carne premium, marinados y productos frescos con entrega a domicilio.",
    url: "https://sergioscarniceria.com",
    siteName: "Sergio's Carnicería",
    locale: "es_MX",
    type: "website",
    // Sin esto, al compartir el link por WhatsApp o Facebook no aparecía imagen
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Sergio's Carnicería — Carne de calidad desde 1976, Ezequiel Montes, Querétaro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sergio's Carnicería | Carnes de calidad en Ezequiel Montes, Qro.",
    description:
      "Cortes de carne premium, marinados y productos frescos con entrega a domicilio.",
    images: ["/og-image.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "FoodEstablishment"],
  name: "Sergio's Carnicería",
  url: "https://sergioscarniceria.com",
  logo: "https://sergioscarniceria.com/logo.png",
  image: "https://sergioscarniceria.com/og-image.jpg",
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
    latitude: 20.6649555,
    longitude: -99.8990919,
  },
  telephone: "+524411153314",
  email: "contacto@sergioscarniceria.com",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contacto@sergioscarniceria.com",
      telephone: "+524411153314",
      areaServed: "MX",
      availableLanguage: "Spanish",
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "cotizaciones@sergioscarniceria.com",
      telephone: "+524411185767",
      areaServed: "MX",
      availableLanguage: "Spanish",
    },
  ],
  sameAs: [
    "https://www.instagram.com/sergioscarniceria",
    "https://www.facebook.com/share/1RS83jZX6D/",
  ],
  servesCuisine: "Carnicería mexicana",
  priceRange: "$$",
  areaServed: [
    { "@type": "City", name: "Ezequiel Montes" },
    { "@type": "City", name: "Tequisquiapan" },
    { "@type": "City", name: "Bernal" },
    { "@type": "City", name: "Cadereyta de Montes" },
    { "@type": "State", name: "Querétaro" },
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Catálogo de carnes",
    itemListElement: [
      "Cortes de res",
      "Cortes de cerdo",
      "Pollo",
      "Carne marinada y preparada",
      "Carne para asar",
      "Arrachera",
      "Rib eye",
      "Mariscos",
      "Carnes frías y abarrotes",
      "Venta a mayoreo para restaurantes y eventos",
    ].map((nombre) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: nombre },
    })),
  },
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
        <link rel="preload" href="/logo-sm.png" as="image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
