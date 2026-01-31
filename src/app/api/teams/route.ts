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

  // RLS handles filtering by tenant + membership
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("is_archived", false)
    .order("name");

  if (error) return jsonError("Failed to fetch teams", 500);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);
  if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);

  const body = await request.json();
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  // Use service client to bypass RLS — role already verified above
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
    return jsonError("Failed to create team", 500);
  }

  await createAuditLog({
    tenant_id: ctx.tenant_id,
    actor_id: ctx.user_id,
    action: "team.created",
    entity_type: "team",
    entity_id: data.id,
    new_values: { name: parsed.data.name },
  });

  return jsonSuccess(data, 201);
}
