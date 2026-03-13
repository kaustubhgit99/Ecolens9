import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");
    const { data: profile } = await supabase.from("users").select("role,department").eq("id", user.id).single();
    let query = supabase.from("complaints").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (!profile || profile.role === "citizen") query = query.eq("citizen_id", user.id);
    else if (profile.role === "authority" && profile.department) query = query.eq("department", profile.department);
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, count, page, limit });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("users").select("is_blocked").eq("id", user.id).single();
    if (profile?.is_blocked) return NextResponse.json({ error: "Account blocked." }, { status: 403 });
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { description, title, latitude, longitude, address, ward, image_url } = body as Record<string, string | number | null>;
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
    const { data: complaint, error: insertErr } = await supabase.from("complaints").insert({
      citizen_id: user.id, title: (title as string) || null, description: description as string,
      latitude: latitude != null ? Number(latitude) : null, longitude: longitude != null ? Number(longitude) : null,
      address: (address as string) || null, ward: (ward as string) || null, image_url: (image_url as string) || null,
      status: "pending", ai_is_spam: false, ai_is_duplicate: false, coins_awarded: false, ai_objects: [],
    }).select().single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ complaint_id: complaint.id, status: complaint.status }, { status: 201 });
  } catch { return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
