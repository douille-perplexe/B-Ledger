import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MembersAdmin } from "./members-admin";

export default async function AdminMembersPage() {
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

  // All profiles in tenant
  const { data: members } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  // All teams for assignment
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("is_archived", false)
    .order("name");

  // All team memberships
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("*, team:teams(id, name), profile:profiles(id, full_name)")
    .eq("is_active", true);

  return (
    <MembersAdmin
      members={members || []}
      teams={teams || []}
      teamMembers={teamMembers || []}
      isSuperAdmin={profile?.global_role === "super_admin"}
    />
  );
}
