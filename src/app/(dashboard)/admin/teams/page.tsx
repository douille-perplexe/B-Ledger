import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .order("name");

  return (
    <TeamsAdmin
      teams={teams || []}
      isSuperAdmin={profile?.global_role === "super_admin"}
    />
  );
}
