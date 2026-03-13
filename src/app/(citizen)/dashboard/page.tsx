import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CitizenDashboardClient from "./CitizenDashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("id,full_name,role,coins_total,coins_month,ward").eq("id", user.id).single() as { data: { id: string; full_name: string; role: string; coins_total: number; coins_month: number; ward: string | null } | null };

  if (profile?.role === "authority" || profile?.role === "admin") redirect("/queue");

  const { data: complaints } = await supabase.from("complaints").select("id,title,description,status,ai_priority,ai_category,address,created_at,image_url").eq("citizen_id", user.id).order("created_at", { ascending: false }).limit(20) as { data: Array<{ id: string; title: string | null; description: string | null; status: string; ai_priority: string | null; ai_category: string | null; address: string | null; created_at: string; image_url: string | null }> | null };

  const { count: unreadCount } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);

  return (
    <CitizenDashboardClient
      profile={profile ?? { id: user.id, full_name: "Citizen", role: "citizen", coins_total: 0, coins_month: 0, ward: null }}
      complaints={complaints ?? []}
      unreadCount={unreadCount ?? 0}
    />
  );
}
