import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  if (!profile?.tenant_id) redirect("/onboarding");

  // Use service client to see all data in the tenant
  const service = await createServiceClient();

  const { data: members } = await service
    .from("profiles")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("full_name");

  const { data: teams } = await service
    .from("teams")
    .select("id, name")
    .eq("tenant_id", profile.tenant_id)
    .eq("is_archived", false)
    .order("name");

  const { data: teamMembers } = await service
    .from("team_members")
    .select("*, team:teams(id, name), profile:profiles(id, full_name)")
    .eq("is_active", true);

  return (
    <MembersAdmin
      members={members || []}
      teams={teams || []}
      teamMembers={teamMembers || []}
      isSuperAdmin={profile.global_role === "super_admin"}
    />
  );
}
