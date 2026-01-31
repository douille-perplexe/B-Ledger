import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
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

  if (!profile?.tenant_id) redirect("/onboarding");

  // Fetch user's teams
  const { data: teamMemberships } = await supabase
    .from("team_members")
    .select("*, team:teams(*)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  // Fetch pending breakfasts for user
  const { data: pendingBreakfasts } = await supabase
    .from("breakfasts")
    .select("*, team:teams(id, name), owed_by_profile:profiles!breakfasts_owed_by_fkey(id, full_name)")
    .eq("is_deleted", false)
    .in("status", ["pending", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <DashboardContent
      profile={profile}
      teamMemberships={teamMemberships || []}
      pendingBreakfasts={pendingBreakfasts || []}
    />
  );
}
