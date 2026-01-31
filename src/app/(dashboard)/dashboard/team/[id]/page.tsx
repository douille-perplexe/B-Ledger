import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamContent } from "./team-content";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Fetch team with members
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .single();

  if (!team) redirect("/dashboard");

  const { data: members } = await supabase
    .from("team_members")
    .select("*, profile:profiles(*)")
    .eq("team_id", id)
    .eq("is_active", true)
    .order("current_bar_count", { ascending: false });

  // Fetch user's team membership to determine role
  const { data: myMembership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  // Fetch recent bars for the team
  const { data: recentBars } = await supabase
    .from("bars")
    .select("*, assigned_to_profile:profiles!bars_assigned_to_fkey(id, full_name), assigned_by_profile:profiles!bars_assigned_by_fkey(id, full_name)")
    .eq("team_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Fetch team breakfasts
  const { data: breakfasts } = await supabase
    .from("breakfasts")
    .select("*, owed_by_profile:profiles!breakfasts_owed_by_fkey(id, full_name)")
    .eq("team_id", id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <TeamContent
      team={team}
      members={members || []}
      recentBars={recentBars || []}
      breakfasts={breakfasts || []}
      currentUserId={user.id}
      myRole={myMembership?.role || "member"}
      globalRole={profile?.global_role || "member"}
    />
  );
}
