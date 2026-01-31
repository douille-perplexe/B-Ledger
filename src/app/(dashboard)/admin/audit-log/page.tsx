import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AuditLogContent } from "./audit-log-content";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) redirect("/onboarding");

  // Use service client to bypass RLS on audit_log
  const service = await createServiceClient();
  const { data: logs } = await service
    .from("audit_log")
    .select("*, actor:profiles!actor_id(id, full_name, email)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditLogContent logs={logs || []} />;
}
