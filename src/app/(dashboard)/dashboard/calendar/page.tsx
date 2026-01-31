import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarContent } from "./calendar-content";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch teams for filter
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("is_archived", false)
    .order("name");

  return (
    <CalendarContent
      teams={teams || []}
      isSuperAdmin={profile?.global_role === "super_admin"}
    />
  );
}
