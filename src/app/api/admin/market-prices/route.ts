import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/admin/market-prices
 * Returns all market prices with comparison to our prices
 */
export async function GET() {
  const supabase = getSupabase();

  const { data: marketPrices, error } = await supabase
    .from("market_prices")
    .select("*")
    .order("category", { ascending: true })
    .order("product_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prices: marketPrices || [] });
}

/**
 * POST /api/admin/market-prices
 * Upsert market prices (bulk update)
 * Body: { secret, prices: [{ product_name, our_price, market_avg, market_low, market_high, sources, category }] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, prices } = body;

    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!prices || !Array.isArray(prices)) {
      return NextResponse.json({ error: "Se requiere array de precios" }, { status: 400 });
    }

    const supabase = getSupabase();
    let updated = 0;
    let inserted = 0;

    for (const p of prices) {
      // Check if product already exists
      const { data: existing } = await supabase
        .from("market_prices")
        .select("id")
        .eq("product_name", p.product_name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("market_prices")
          .update({
            our_price: p.our_price ?? 0,
            market_avg: p.market_avg ?? 0,
            market_low: p.market_low ?? 0,
            market_high: p.market_high ?? 0,
            sources: p.sources ?? "",
            category: p.category ?? "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("market_prices").insert([{
          product_name: p.product_name,
          our_price: p.our_price ?? 0,
          market_avg: p.market_avg ?? 0,
          market_low: p.market_low ?? 0,
          market_high: p.market_high ?? 0,
          sources: p.sources ?? "",
          category: p.category ?? "",
        }]);
        inserted++;
      }
    }

    return NextResponse.json({ success: true, updated, inserted });
  } catch (err) {
    console.error("Market prices error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
