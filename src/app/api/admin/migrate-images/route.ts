import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * One-time migration: add image_url column and populate with Unsplash images.
 * DELETE THIS FILE after running once.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.secret !== "sergios2026") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Add column via raw SQL
    const { error: colError } = await supabase.rpc("exec_sql", {
      query: "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text",
    });

    // If exec_sql doesn't exist, try direct approach
    let columnAdded = !colError;
    if (colError) {
      // Try updating a product to see if column exists
      const { error: testError } = await supabase
        .from("products")
        .update({ image_url: null })
        .eq("name", "__nonexistent__");

      if (testError?.message?.includes("image_url")) {
        return NextResponse.json({
          error: "La columna image_url no existe. Agrégala manualmente en Supabase: ALTER TABLE products ADD COLUMN image_url text;",
          hint: "Ve a Supabase > SQL Editor > pega el comando",
        }, { status: 400 });
      }
      columnAdded = true; // column already exists
    }

    // Step 2: Update images
    const images: Record<string, string> = {
      "Arrachera": "https://images.unsplash.com/photo-1668887465701-41fee9e1d474?w=400&h=400&fit=crop&auto=format&q=80",
      "Astillas": "https://plus.unsplash.com/premium_photo-1675294435997-b16dcb63ab7c?w=400&h=400&fit=crop&auto=format&q=80",
      "Barbacoa": "https://plus.unsplash.com/premium_photo-1664476278388-1ee4dbec54f2?w=400&h=400&fit=crop&auto=format&q=80",
      "Bistec de Cerdo": "https://plus.unsplash.com/premium_photo-1723532472260-4843b8a7992a?w=400&h=400&fit=crop&auto=format&q=80",
      "Bistec de res": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Bistec espaldilla": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Botella Don Julio": "https://images.unsplash.com/photo-1698288547419-407ca6bafe2a?w=400&h=400&fit=crop&auto=format&q=80",
      "Briquetas": "https://plus.unsplash.com/premium_photo-1764181994087-57addccc3ad1?w=400&h=400&fit=crop&auto=format&q=80",
      "Brisket": "https://plus.unsplash.com/premium_photo-1668616815046-1a408ec3cf00?w=400&h=400&fit=crop&auto=format&q=80",
      "Brisket premium ahumado": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Carne seca grande": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Chambarete": "https://plus.unsplash.com/premium_photo-1726876959478-7ac172b36fb1?w=400&h=400&fit=crop&auto=format&q=80",
      "Chamorro": "https://plus.unsplash.com/premium_photo-1661436777001-bfc42fc35cb7?w=400&h=400&fit=crop&auto=format&q=80",
      "Chorizo argentino": "https://plus.unsplash.com/premium_photo-1726776196064-54d9b3a59839?w=400&h=400&fit=crop&auto=format&q=80",
      "Chorizo español": "https://plus.unsplash.com/premium_photo-1770660174515-924c6c8b2a44?w=400&h=400&fit=crop&auto=format&q=80",
      "Chorizo ranchero": "https://plus.unsplash.com/premium_photo-1692835645587-7317887f0ecb?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta 0": "https://plus.unsplash.com/premium_photo-1723568537325-85d5972f23c7?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta 7": "https://plus.unsplash.com/premium_photo-1723568537325-85d5972f23c7?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta ahumada": "https://plus.unsplash.com/premium_photo-1723532472260-4843b8a7992a?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta de cerdo": "https://plus.unsplash.com/premium_photo-1722297634860-8df023de21b2?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta diezmillo": "https://plus.unsplash.com/premium_photo-1723568537325-85d5972f23c7?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuleta estrella": "https://plus.unsplash.com/premium_photo-1723568537325-85d5972f23c7?w=400&h=400&fit=crop&auto=format&q=80",
      "Chuletón": "https://plus.unsplash.com/premium_photo-1722686450724-51711b45e8a5?w=400&h=400&fit=crop&auto=format&q=80",
      "Chunks para ahumar": "https://plus.unsplash.com/premium_photo-1672265517704-fc7704710c54?w=400&h=400&fit=crop&auto=format&q=80",
      "Costilla Ranchera": "https://plus.unsplash.com/premium_photo-1668616817166-705baf18f967?w=400&h=400&fit=crop&auto=format&q=80",
      "Costilla de cerdo": "https://plus.unsplash.com/premium_photo-1668616817166-705baf18f967?w=400&h=400&fit=crop&auto=format&q=80",
      "Costilla para asar": "https://plus.unsplash.com/premium_photo-1668616817166-705baf18f967?w=400&h=400&fit=crop&auto=format&q=80",
      "Costilla para caldo": "https://plus.unsplash.com/premium_photo-1668616817170-2a74b5cd181d?w=400&h=400&fit=crop&auto=format&q=80",
      "Cowboy": "https://plus.unsplash.com/premium_photo-1723532508381-8d9d8568bb3b?w=400&h=400&fit=crop&auto=format&q=80",
      "Cuero de cerdo": "https://plus.unsplash.com/premium_photo-1723478490576-f5f5e20aff7d?w=400&h=400&fit=crop&auto=format&q=80",
      "Diezmillo": "https://plus.unsplash.com/premium_photo-1726876959478-7ac172b36fb1?w=400&h=400&fit=crop&auto=format&q=80",
      "Falda de Res": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Filete de Res": "https://plus.unsplash.com/premium_photo-1770696372988-5af50e6e1d7f?w=400&h=400&fit=crop&auto=format&q=80",
      "Gas": "https://plus.unsplash.com/premium_photo-1682147493544-267597bb48e7?w=400&h=400&fit=crop&auto=format&q=80",
      "Hamburguesa": "https://plus.unsplash.com/premium_photo-1668616816684-a625132b4f36?w=400&h=400&fit=crop&auto=format&q=80",
      "Higado de res": "https://plus.unsplash.com/premium_photo-1693221705094-e7e62df7b9bd?w=400&h=400&fit=crop&auto=format&q=80",
      "Hueso tuetano": "https://plus.unsplash.com/premium_photo-1671211534043-e031e47c32eb?w=400&h=400&fit=crop&auto=format&q=80",
      "Huesos": "https://plus.unsplash.com/premium_photo-1723532508381-8d9d8568bb3b?w=400&h=400&fit=crop&auto=format&q=80",
      "Lengua de res": "https://plus.unsplash.com/premium_photo-1745341290890-fc24dda5cbe1?w=400&h=400&fit=crop&auto=format&q=80",
      "Lomo": "https://plus.unsplash.com/premium_photo-1668616815046-1a408ec3cf00?w=400&h=400&fit=crop&auto=format&q=80",
      "Longaniza": "https://plus.unsplash.com/premium_photo-1681826578951-ea6a275d06e3?w=400&h=400&fit=crop&auto=format&q=80",
      "Manteca": "https://plus.unsplash.com/premium_photo-1725467478749-ee1b4e92acc9?w=400&h=400&fit=crop&auto=format&q=80",
      "Medallon de filete": "https://plus.unsplash.com/premium_photo-1770696372988-5af50e6e1d7f?w=400&h=400&fit=crop&auto=format&q=80",
      "Miel": "https://plus.unsplash.com/premium_photo-1726743622090-abfc4a91f80b?w=400&h=400&fit=crop&auto=format&q=80",
      "Molida de Cerdo": "https://plus.unsplash.com/premium_photo-1681826522435-5491444dce7e?w=400&h=400&fit=crop&auto=format&q=80",
      "Molida de Res": "https://plus.unsplash.com/premium_photo-1670357599582-de7232e949a0?w=400&h=400&fit=crop&auto=format&q=80",
      "Molida para tacos": "https://plus.unsplash.com/premium_photo-1670357599582-de7232e949a0?w=400&h=400&fit=crop&auto=format&q=80",
      "Molleja": "https://plus.unsplash.com/premium_photo-1726876959478-7ac172b36fb1?w=400&h=400&fit=crop&auto=format&q=80",
      "Médula": "https://plus.unsplash.com/premium_photo-1666978197874-b75fd70007e1?w=400&h=400&fit=crop&auto=format&q=80",
      "New York": "https://plus.unsplash.com/premium_photo-1726761661509-180de637d42a?w=400&h=400&fit=crop&auto=format&q=80",
      "Panza": "https://plus.unsplash.com/premium_photo-1668616816673-fe8086e1b910?w=400&h=400&fit=crop&auto=format&q=80",
      "Pastor": "https://plus.unsplash.com/premium_photo-1661780097425-171c59ab2b09?w=400&h=400&fit=crop&auto=format&q=80",
      "Pata de Cerdo": "https://plus.unsplash.com/premium_photo-1669985398966-5edf74efc29c?w=400&h=400&fit=crop&auto=format&q=80",
      "Pecho caldo": "https://plus.unsplash.com/premium_photo-1770645891384-345538781c9c?w=400&h=400&fit=crop&auto=format&q=80",
      "Picaña": "https://plus.unsplash.com/premium_photo-1723532507412-a41f99533775?w=400&h=400&fit=crop&auto=format&q=80",
      "Pierna de cerdo": "https://plus.unsplash.com/premium_photo-1726797937745-fcf0ce2be73a?w=400&h=400&fit=crop&auto=format&q=80",
      "Pollo": "https://plus.unsplash.com/premium_photo-1661767136966-38d5999f819a?w=400&h=400&fit=crop&auto=format&q=80",
      "Pork Belly": "https://plus.unsplash.com/premium_photo-1668616816673-fe8086e1b910?w=400&h=400&fit=crop&auto=format&q=80",
      "Pork belly": "https://plus.unsplash.com/premium_photo-1668616816673-fe8086e1b910?w=400&h=400&fit=crop&auto=format&q=80",
      "Porterhouse": "https://plus.unsplash.com/premium_photo-1726138640100-37e644d59628?w=400&h=400&fit=crop&auto=format&q=80",
      "Refresco": "https://plus.unsplash.com/premium_photo-1737730766361-641c7f603c5a?w=400&h=400&fit=crop&auto=format&q=80",
      "Rib eye": "https://plus.unsplash.com/premium_photo-1674106347948-d5f920a134d5?w=400&h=400&fit=crop&auto=format&q=80",
      "Riñones": "https://plus.unsplash.com/premium_photo-1718604809453-79b708670bb5?w=400&h=400&fit=crop&auto=format&q=80",
      "Sal Ahumada de la casa": "https://plus.unsplash.com/premium_photo-1701015785367-06b2b4b779c1?w=400&h=400&fit=crop&auto=format&q=80",
      "Salsa": "https://plus.unsplash.com/premium_photo-1661776616127-98bb4873b6ba?w=400&h=400&fit=crop&auto=format&q=80",
      "Sirloin": "https://plus.unsplash.com/premium_photo-1770631378111-12ae04c1078b?w=400&h=400&fit=crop&auto=format&q=80",
      "T-Bone": "https://plus.unsplash.com/premium_photo-1755706447465-af9f8e31d34c?w=400&h=400&fit=crop&auto=format&q=80",
      "Taco de Barbacoa": "https://plus.unsplash.com/premium_photo-1664476278388-1ee4dbec54f2?w=400&h=400&fit=crop&auto=format&q=80",
      "Tocino Premium": "https://plus.unsplash.com/premium_photo-1725469970217-2ec55fe7a699?w=400&h=400&fit=crop&auto=format&q=80",
      "Tocino económico": "https://plus.unsplash.com/premium_photo-1725469970217-2ec55fe7a699?w=400&h=400&fit=crop&auto=format&q=80",
      "Tomahawk": "https://plus.unsplash.com/premium_photo-1722686450724-51711b45e8a5?w=400&h=400&fit=crop&auto=format&q=80",
      "Tortillinas": "https://plus.unsplash.com/premium_photo-1664648234313-5ae2d826c2bd?w=400&h=400&fit=crop&auto=format&q=80",
      "Tripa de res": "https://plus.unsplash.com/premium_photo-1695297516117-c8ed727cd4b4?w=400&h=400&fit=crop&auto=format&q=80",
      "Tuétano": "https://plus.unsplash.com/premium_photo-1666978197874-b75fd70007e1?w=400&h=400&fit=crop&auto=format&q=80",
      "carbon": "https://plus.unsplash.com/premium_photo-1675186939926-ea6bf907a370?w=400&h=400&fit=crop&auto=format&q=80",
      "tostadas": "https://plus.unsplash.com/premium_photo-1726072358340-0e720a2e4864?w=400&h=400&fit=crop&auto=format&q=80",
    };

    let updated = 0;
    let errors: string[] = [];

    for (const [name, url] of Object.entries(images)) {
      const { error } = await supabase
        .from("products")
        .update({ image_url: url })
        .eq("name", name);

      if (error) {
        errors.push(`${name}: ${error.message}`);
      } else {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      columnAdded,
      updated,
      total: Object.keys(images).length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
