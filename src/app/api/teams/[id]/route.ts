import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createAuditLog,
} from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { updateTeamSchema } from "@/lib/validations/team";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const supabase = await createServiceClient();

    const { data: team, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", ctx.tenant_id)
      .single();

    if (error || !team) return jsonError("Team not found", 404);

    const { data: members } = await supabase
      .from("team_members")
      .select("*, profile:profiles(*)")
      .eq("team_id", id)
      .eq("is_active", true)
      .order("role");

    return jsonSuccess({ ...team, members: members || [] });
  } catch (err) {
    console.error("Unhandled error in GET /api/teams/[id]:", err);
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const teamRole = await getTeamRole(ctx.user_id, id);
    const canEdit =
      ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canEdit) return jsonError("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = updateTeamSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", ctx.tenant_id)
      .select()
      .single();

    if (error) {
      console.error("Update team error:", error);
      return jsonError(error.message || "Failed to update team", 500);
    }
    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in PATCH /api/teams/[id]:", err);
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);
    if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from("teams")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("tenant_id", ctx.tenant_id)
      .select()
      .single();

    if (error) {
      console.error("Archive team error:", error);
      return jsonError(error.message || "Failed to archive team", 500);
    }

    createAuditLog({
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
      action: "team_archived",
      entity_type: "team",
      entity_id: id,
      new_values: { is_archived: true },
    }).catch((err) => console.error("Audit log error:", err));

    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in DELETE /api/teams/[id]:", err);
    return jsonError("Internal server error", 500);
  }
}
