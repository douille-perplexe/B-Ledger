import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { TeamsAdmin } from "./teams-admin";

export default async function AdminTeamsPage() {
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

  // Use service client to bypass RLS and get all teams in tenant
  const service = await createServiceClient();
  const { data: teams } = await service
    .from("teams")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("name");

  return (
    <TeamsAdmin
      teams={teams || []}
      isSuperAdmin={profile.global_role === "super_admin"}
    />
  );
}
