import type { MetadataRoute } from "next";

const BASE = "https://sergioscarniceria.com";

// Solo las páginas públicas. Las rutas internas (admin, caja, cobranza,
// pedidos, etc.) se quedan fuera a propósito: no deben indexarse.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/tienda`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}
