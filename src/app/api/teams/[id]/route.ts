import {
  getAuthContext,
  getTeamRole,
  hasMinRole,
  jsonError,
  jsonSuccess,
  createAuditLog,
} from "@/lib/api/helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { updateTeamSchema } from "@/lib/validations/team";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();

  const { data: team, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !team) return jsonError("Team not found", 404);

  // Get members with profiles
  const { data: members } = await supabase
    .from("team_members")
    .select("*, profile:profiles(*)")
    .eq("team_id", id)
    .eq("is_active", true)
    .order("role");

  return jsonSuccess({ ...team, members: members || [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const teamRole = await getTeamRole(ctx.user_id, id);
  const canEdit =
    ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canEdit) return jsonError("Forbidden", 403);

  const body = await request.json();
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError("Failed to update team", 500);
  return jsonSuccess(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);
  if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);

  // Use service client — role already verified above
  const supabase = await createServiceClient();

  // Soft archive
  const { data, error } = await supabase
    .from("teams")
    .update({ is_archived: true })
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError("Failed to archive team", 500);

  await createAuditLog({
    tenant_id: ctx.tenant_id,
    actor_id: ctx.user_id,
    action: "team_archived",
    entity_type: "team",
    entity_id: id,
    new_values: { is_archived: true },
  });

  return jsonSuccess(data);
}
