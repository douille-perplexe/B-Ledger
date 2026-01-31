import { getAuthContext, getTeamRole, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const supabase = await createServiceClient();
    const { data: invite } = await supabase
      .from("invite_links")
      .select("team_id")
      .eq("id", id)
      .eq("tenant_id", ctx.tenant_id)
      .single();

    if (!invite) return jsonError("Invite not found", 404);

    const teamRole = await getTeamRole(ctx.user_id, invite.team_id);
    const canRevoke = ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canRevoke) return jsonError("Forbidden", 403);

    const { error } = await supabase
      .from("invite_links")
      .update({ is_used: true })
      .eq("id", id);

    if (error) {
      console.error("Revoke invite error:", error);
      return jsonError("Failed to revoke invite", 500);
    }
    return jsonSuccess({ success: true });
  } catch (err) {
    console.error("Unhandled error in DELETE /api/invites/[id]:", err);
    return jsonError("Internal server error", 500);
  }
}
