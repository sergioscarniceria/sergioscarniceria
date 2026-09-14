import type { MetadataRoute } from "next";

const BASE = "https://sergioscarniceria.com";

// Google solo debe indexar la página pública y la tienda.
// Todo lo operativo e interno queda bloqueado: ahí hay datos de clientes,
// precios de costo, nómina y cuentas por cobrar.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/tienda"],
        disallow: [
          "/admin",
          "/api",
          "/caja",
          "/cliente",
          "/cobranza",
          "/cxc",
          "/display",
          "/inventario",
          "/pedidos",
          "/produccion",
          "/repartidores",
          "/ventas",
          "/asistencia",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
