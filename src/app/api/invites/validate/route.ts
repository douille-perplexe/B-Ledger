import { jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) return jsonError("Token required", 400);

  const supabase = await createServiceClient();

  const { data: invite, error } = await supabase
    .from("invite_links")
    .select("*, team:teams(name), tenant:tenants(name)")
    .eq("token", token)
    .eq("is_used", false)
    .single();

  if (error || !invite) {
    return jsonError("Invalid invite link", 404);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return jsonError("This invite link has expired", 410);
  }

  return jsonSuccess({
    team_name: invite.team?.name,
    tenant_name: invite.tenant?.name,
    role: invite.role,
  });
}
