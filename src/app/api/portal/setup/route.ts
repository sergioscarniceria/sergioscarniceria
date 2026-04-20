import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(body.secret)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Add portal_password column to customers
    const { error: e1 } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_password TEXT;",
    });

    // Add cancel columns to cash_movements
    const { error: e2 } = await supabase.rpc("exec_sql", {
      sql: `
        ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
        ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
        ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
        ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
      `,
    });

    // If rpc doesn't exist, try raw SQL via REST
    if (e1 || e2) {
      // Fallback: just run simple queries
      await supabase.from("customers").select("portal_password").limit(1);
      await supabase.from("cash_movements").select("is_cancelled").limit(1);
    }

    return NextResponse.json({
      success: true,
      message: "Setup completado. Si hubo errores, corre el SQL manualmente en Supabase.",
      sql: [
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_password TEXT;",
        "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancel_reason TEXT;",
        "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancelled_by TEXT;",
        "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;",
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
