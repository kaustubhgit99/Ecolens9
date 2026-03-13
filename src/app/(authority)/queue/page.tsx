import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthorityQueueClient from "./AuthorityQueueClient";

export default async function QueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("id,full_name,role,department,ward").eq("id", user.id).single() as { data: { id: string; full_name: string; role: string; department: string | null; ward: string | null } | null };

  if (profile?.role === "citizen") redirect("/dashboard");

  let query = supabase.from("complaints").select("id,title,description,status,ai_priority,ai_category,ai_department,ai_confidence,address,ward,department,created_at,resolved_at,citizen_id").order("created_at", { ascending: false }).limit(100);

  if (profile?.role === "authority" && profile.department) {
    query = query.eq("department", profile.department);
  }

  const { data: complaints } = await query as { data: Array<{ id: string; title: string | null; description: string | null; status: string; ai_priority: string | null; ai_category: string | null; ai_department: string | null; ai_confidence: number | null; address: string | null; ward: string | null; department: string | null; created_at: string; resolved_at: string | null; citizen_id: string | null }> | null };

  const { data: departments } = await supabase.from("departments").select("id,name,code,active").eq("active", true) as { data: Array<{ id: string; name: string; code: string; active: boolean }> | null };

  return (
    <AuthorityQueueClient
      profile={profile ?? { id: user.id, full_name: "Officer", role: "authority", department: null, ward: null }}
      complaints={complaints ?? []}
      departments={departments ?? []}
    />
  );
}
