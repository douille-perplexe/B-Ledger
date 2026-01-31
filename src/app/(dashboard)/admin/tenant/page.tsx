import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

  if (!profile?.tenant_id) redirect("/onboarding");
  if (profile.global_role !== "super_admin") redirect("/dashboard");

  const service = await createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) redirect("/dashboard");

  return <TenantSettings tenant={tenant} />;
}
