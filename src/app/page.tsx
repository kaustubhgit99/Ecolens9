import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (p?.role === "authority" || p?.role === "admin") redirect("/queue");
  redirect("/dashboard");
}
