import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
} from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { addTeamMemberSchema } from "@/lib/validations/team";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const teamRole = await getTeamRole(ctx.user_id, teamId);
    const canAdd = ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canAdd) return jsonError("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = addTeamMemberSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const supabase = await createServiceClient();

    // Verify the user belongs to the same tenant
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", parsed.data.user_id)
      .single();

    if (!targetProfile || targetProfile.tenant_id !== ctx.tenant_id) {
      return jsonError("User not found in your organization", 404);
    }

    const { data, error } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: parsed.data.user_id,
        role: parsed.data.role,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("User is already a member of this team", 409);
      }
      console.error("Add member error:", error);
      return jsonError(error.message || "Failed to add member", 500);
    }

    return jsonSuccess(data, 201);
  } catch (err) {
    console.error("Unhandled error in POST /api/teams/[id]/members:", err);
    return jsonError("Internal server error", 500);
  }
}
