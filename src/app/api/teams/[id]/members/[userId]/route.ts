import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createAuditLog,
} from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { updateTeamMemberSchema } from "@/lib/validations/team";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: teamId, userId } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const teamRole = await getTeamRole(ctx.user_id, teamId);
    const canEdit = ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canEdit) return jsonError("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = updateTeamMemberSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const supabase = await createServiceClient();

    const { data: oldMember } = await supabase
      .from("team_members")
      .select("role, is_active")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .single();

    const { data, error } = await supabase
      .from("team_members")
      .update(parsed.data)
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Update member error:", error);
      return jsonError(error.message || "Failed to update member", 500);
    }

    if (parsed.data.role && parsed.data.role !== oldMember?.role) {
      createAuditLog({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.user_id,
        action: "role_changed",
        entity_type: "team_member",
        entity_id: data.id,
        old_values: { role: oldMember?.role },
        new_values: { role: parsed.data.role },
      }).catch((err) => console.error("Audit log error:", err));
    }

    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in PATCH /api/teams/[id]/members/[userId]:", err);
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: teamId, userId } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const teamRole = await getTeamRole(ctx.user_id, teamId);
    const canRemove = ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canRemove) return jsonError("Forbidden", 403);

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("team_members")
      .update({ is_active: false })
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Remove member error:", error);
      return jsonError(error.message || "Failed to remove member", 500);
    }

    createAuditLog({
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
      action: "member_removed",
      entity_type: "team_member",
      entity_id: data.id,
      new_values: { is_active: false },
    }).catch((err) => console.error("Audit log error:", err));

    return jsonSuccess({ success: true });
  } catch (err) {
    console.error("Unhandled error in DELETE /api/teams/[id]/members/[userId]:", err);
    return jsonError("Internal server error", 500);
  }
}
