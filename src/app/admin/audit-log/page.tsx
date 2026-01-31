import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditLogContent } from "./audit-log-content";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditLogContent logs={logs || []} />;
}
