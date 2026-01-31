import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantSettings } from "./tenant-settings";

export default async function TenantPage() {
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

  if (profile?.global_role !== "super_admin") redirect("/dashboard");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id!)
    .single();

  return <TenantSettings tenant={tenant!} />;
}
