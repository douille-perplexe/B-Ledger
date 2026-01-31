import { getAuthContext, getTeamRole, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("invite_links")
    .select("team_id")
    .eq("id", id)
    .single();

  if (!invite) return jsonError("Invite not found", 404);

  const teamRole = await getTeamRole(ctx.user_id, invite.team_id);
  const canRevoke = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canRevoke) return jsonError("Forbidden", 403);

  // Mark as used to effectively revoke
  const { error } = await supabase
    .from("invite_links")
    .update({ is_used: true })
    .eq("id", id);

  if (error) return jsonError("Failed to revoke invite", 500);
  return jsonSuccess({ success: true });
}
