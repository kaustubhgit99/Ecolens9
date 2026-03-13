import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase.from("complaints").select("*").eq("id", params.id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
    return NextResponse.json({ data });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role === "citizen") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const allowed = ["status", "resolution_notes", "assigned_to", "department"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) { if (key in body) update[key] = body[key]; }
    if (update.status === "resolved") update.resolved_at = new Date().toISOString();
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "No valid fields." }, { status: 400 });
    const { data, error: updateErr } = await supabase.from("complaints").update(update).eq("id", params.id).select().single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    if (update.status === "resolved" && data && !data.coins_awarded && data.citizen_id) {
      const svc = createServiceClient();
      const COINS = 10;
      await svc.from("coin_transactions").insert({ user_id: data.citizen_id, complaint_id: data.id, coins: COINS, reason: "complaint_resolved" });
      await svc.rpc("increment_coins", { p_user_id: data.citizen_id, p_amount: COINS }).then(() => null).catch(() => null);
      await svc.from("complaints").update({ coins_awarded: true }).eq("id", data.id);
      await svc.from("notifications").insert({ user_id: data.citizen_id, complaint_id: data.id, message: `Your complaint resolved! You earned ${COINS} Swacchata Coins 🪙`, type: "status_update" });
    }
    return NextResponse.json({ data });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
