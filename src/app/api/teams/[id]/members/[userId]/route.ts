import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createAuditLog,
} from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { updateTeamMemberSchema } from "@/lib/validations/team";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: teamId, userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const teamRole = await getTeamRole(ctx.user_id, teamId);
  const canEdit = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canEdit) return jsonError("Forbidden", 403);

  const body = await request.json();
  const parsed = updateTeamMemberSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const supabase = await createClient();

  // Get old values for audit
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

  if (error) return jsonError("Failed to update member", 500);

  if (parsed.data.role && parsed.data.role !== oldMember?.role) {
    await createAuditLog({
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
      action: "role_changed",
      entity_type: "team_member",
      entity_id: data.id,
      old_values: { role: oldMember?.role },
      new_values: { role: parsed.data.role },
    });
  }

  return jsonSuccess(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: teamId, userId } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const teamRole = await getTeamRole(ctx.user_id, teamId);
  const canRemove = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canRemove) return jsonError("Forbidden", 403);

  const supabase = await createClient();

  // Soft deactivate
  const { data, error } = await supabase
    .from("team_members")
    .update({ is_active: false })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return jsonError("Failed to remove member", 500);

  await createAuditLog({
    tenant_id: ctx.tenant_id,
    actor_id: ctx.user_id,
    action: "member_removed",
    entity_type: "team_member",
    entity_id: data.id,
    new_values: { is_active: false },
  });

  return jsonSuccess({ success: true });
}
