import {
  getAuthContext,
  jsonError,
  jsonSuccess,
  createAuditLog,
} from "@/lib/api/helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createTeamSchema } from "@/lib/validations/team";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("is_archived", false)
    .order("name");

  if (error) return jsonError("Failed to fetch teams", 500);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);
    if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) return jsonError("Name must be 3-50 characters", 400);

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .insert({ name: parsed.data.name, tenant_id: ctx.tenant_id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("A team with this name already exists", 409);
      }
      console.error("Team creation error:", error);
      return jsonError(error.message || "Failed to create team", 500);
    }

    // Non-blocking audit log — don't let it break team creation
    createAuditLog({
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
      action: "team.created",
      entity_type: "team",
      entity_id: data.id,
      new_values: { name: parsed.data.name },
    }).catch((err) => console.error("Audit log error:", err));

    return jsonSuccess(data, 201);
  } catch (err) {
    console.error("Unhandled error in POST /api/teams:", err);
    return jsonError("Internal server error", 500);
  }
}
