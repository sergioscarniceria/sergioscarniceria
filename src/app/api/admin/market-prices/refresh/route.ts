import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Mapping: our product names → search terms for scraping
const PRODUCT_MAP: Record<string, { search: string[]; category: string }> = {
  "Bistec de res": { search: ["bistec", "bistec de res"], category: "Res" },
  "Arrachera": { search: ["arrachera"], category: "Carne para asar" },
  "Molida de Res": { search: ["molida", "carne molida"], category: "Res" },
  "Filete de Res": { search: ["filete", "filete de res"], category: "Res" },
  "Costilla para caldo": { search: ["costilla caldo", "costilla res"], category: "Res" },
  "Chambarete": { search: ["chambarete"], category: "Res" },
  "Falda de Res": { search: ["falda"], category: "Res" },
  "Cecina": { search: ["cecina"], category: "Res" },
  "Milanesa empalizada": { search: ["milanesa"], category: "Res" },
  "Hamburguesa": { search: ["hamburguesa", "carne hamburguesa"], category: "Res" },
  "Costilla de cerdo": { search: ["costilla cerdo", "costilla de cerdo"], category: "Cerdo" },
  "Chuleta de cerdo": { search: ["chuleta cerdo", "chuleta de cerdo"], category: "Cerdo" },
  "Pierna de cerdo": { search: ["pierna cerdo", "pierna de cerdo"], category: "Cerdo" },
  "Lomo": { search: ["lomo cerdo", "lomo de cerdo"], category: "Cerdo" },
  "Bistec de Cerdo": { search: ["bistec cerdo", "bistec de cerdo"], category: "Cerdo" },
  "Pastor": { search: ["pastor", "carne al pastor"], category: "Cerdo" },
  "Rib eye": { search: ["rib eye", "ribeye"], category: "Carne para asar" },
  "New York": { search: ["new york"], category: "Carne para asar" },
  "T-Bone": { search: ["t-bone", "tbone"], category: "Carne para asar" },
  "Picaña": { search: ["picaña", "picanha"], category: "Carne para asar" },
  "Chorizo ranchero": { search: ["chorizo"], category: "Embutidos" },
  "Longaniza": { search: ["longaniza"], category: "Embutidos" },
  "Pollo": { search: ["pollo"], category: "Complementos" },
};

type ScrapedPrice = { name: string; price: number; source: string };

/**
 * Scrape CarnesRamos (Shopify) — prices are in static HTML
 */
async function scrapeCarnesRamos(): Promise<ScrapedPrice[]> {
  const results: ScrapedPrice[] = [];
  const urls = [
    "https://tienda.carnesramos.com.mx/collections/carniceria",
    "https://tienda.carnesramos.com.mx/collections/cortes-de-cerdo",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Parse Shopify product grid
      // Pattern: <h2 class="ProductItem__Title..."><a...>PRODUCT NAME</a></h2>
      // followed by <span class="ProductItem__Price...">$ PRICE</span>
      const productPattern = /ProductItem__Title[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?ProductItem__Price[^>]*>\s*\$\s*([\d,.]+)/gi;
      let match;
      while ((match = productPattern.exec(html)) !== null) {
        const name = match[1].trim().toLowerCase();
        const priceStr = match[2].replace(/,/g, "").trim();
        const price = parseFloat(priceStr);
        if (name && price > 0) {
          results.push({ name, price, source: "Carnes Ramos" });
        }
      }
    } catch {
      // Source unavailable, continue
    }
  }

  return results;
}

/**
 * Scrape Calimax (structured HTML)
 */
async function scrapeCalimax(): Promise<ScrapedPrice[]> {
  const results: ScrapedPrice[] = [];
  const urls = [
    "https://tienda.calimax.com.mx/carnes-pescados-y-mariscos/res",
    "https://tienda.calimax.com.mx/carnes-pescados-y-mariscos/carne-de-cerdo",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Calimax uses various patterns — try to find product+price pairs
      // Pattern: product title followed by price like $XXX.XX
      const pricePattern = /class="[^"]*product[^"]*name[^"]*"[^>]*>([^<]+)<[\s\S]*?\$\s*([\d,.]+)/gi;
      let match;
      while ((match = pricePattern.exec(html)) !== null) {
        const name = match[1].trim().toLowerCase();
        const price = parseFloat(match[2].replace(/,/g, ""));
        if (name && price > 0) {
          results.push({ name, price, source: "Calimax" });
        }
      }

      // Also try JSON-LD structured data
      const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let jsonMatch;
      while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          if (data["@type"] === "Product" || data["@type"] === "ItemList") {
            const items = data.itemListElement || [data];
            for (const item of items) {
              const product = item.item || item;
              if (product.name && product.offers?.price) {
                results.push({
                  name: product.name.toLowerCase(),
                  price: parseFloat(product.offers.price),
                  source: "Calimax",
                });
              }
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    } catch {
      // Source unavailable
    }
  }

  return results;
}

/**
 * Match scraped prices to our products
 */
function matchPrices(
  scraped: ScrapedPrice[],
  productName: string,
  searchTerms: string[]
): { prices: number[]; sources: Set<string> } {
  const prices: number[] = [];
  const sources = new Set<string>();

  for (const item of scraped) {
    const itemName = item.name.toLowerCase();
    for (const term of searchTerms) {
      if (itemName.includes(term.toLowerCase())) {
        // Normalize to per-kg price
        let pricePerKg = item.price;

        // If product mentions grams, convert to kg price
        const gramsMatch = itemName.match(/(\d+)\s*g(?:r|ram)?/i);
        if (gramsMatch) {
          const grams = parseInt(gramsMatch[1]);
          if (grams > 0 && grams < 1000) {
            pricePerKg = (item.price / grams) * 1000;
          }
        }

        // If product mentions kg amount > 1
        const kgMatch = itemName.match(/([\d.]+)\s*kg/i);
        if (kgMatch) {
          const kg = parseFloat(kgMatch[1]);
          if (kg > 1) {
            pricePerKg = item.price / kg;
          }
        }

        // Sanity check — skip if price seems too low or too high
        if (pricePerKg > 20 && pricePerKg < 1500) {
          prices.push(Math.round(pricePerKg));
          sources.add(item.source);
        }
        break;
      }
    }
  }

  return { prices, sources };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret } = body;

    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = getSupabase();

    // 1. Get our current product prices
    const { data: products } = await supabase
      .from("products")
      .select("name, price, category")
      .eq("is_active", true);

    const ourPrices: Record<string, number> = {};
    if (products) {
      for (const p of products) {
        ourPrices[p.name] = Number(p.price || 0);
      }
    }

    // 2. Scrape sources in parallel
    const [carnesRamosData, calimaxData] = await Promise.all([
      scrapeCarnesRamos(),
      scrapeCalimax(),
    ]);

    const allScraped = [...carnesRamosData, ...calimaxData];
    const scrapedCount = allScraped.length;

    // 3. Match and update each tracked product
    let updated = 0;
    const results: { product: string; prices_found: number; avg: number; sources: string }[] = [];

    for (const [productName, config] of Object.entries(PRODUCT_MAP)) {
      const matched = matchPrices(allScraped, productName, config.search);

      // Get existing market price data
      const { data: existing } = await supabase
        .from("market_prices")
        .select("*")
        .eq("product_name", productName)
        .maybeSingle();

      const ourPrice = ourPrices[productName] || existing?.our_price || 0;

      if (matched.prices.length > 0) {
        // We have new data — calculate stats
        const avg = Math.round(matched.prices.reduce((a, b) => a + b, 0) / matched.prices.length);
        const low = Math.min(...matched.prices);
        const high = Math.max(...matched.prices);
        const sourceStr = Array.from(matched.sources).join(", ");

        const updateData = {
          product_name: productName,
          our_price: ourPrice,
          market_avg: avg,
          market_low: low,
          market_high: high,
          sources: sourceStr,
          category: config.category,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from("market_prices").update(updateData).eq("id", existing.id);
        } else {
          await supabase.from("market_prices").insert([updateData]);
        }
        updated++;
        results.push({ product: productName, prices_found: matched.prices.length, avg, sources: sourceStr });
      } else if (existing) {
        // No new data but product exists — just update our_price and timestamp
        await supabase
          .from("market_prices")
          .update({ our_price: ourPrice, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    return NextResponse.json({
      success: true,
      scraped_total: scrapedCount,
      sources: {
        carnes_ramos: carnesRamosData.length,
        calimax: calimaxData.length,
      },
      updated,
      results,
    });
  } catch (err) {
    console.error("Market price refresh error:", err);
    return NextResponse.json({ error: "Error al actualizar precios" }, { status: 500 });
  }
}
