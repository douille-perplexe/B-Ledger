import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createNotification,
} from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { createBreakfastSchema } from "@/lib/validations/breakfast";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");
  const status = searchParams.get("status");

  const supabase = await createClient();
  let query = supabase
    .from("breakfasts")
    .select("*, owed_by_profile:profiles!breakfasts_owed_by_fkey(*), team:teams(*)")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (teamId) query = query.eq("team_id", teamId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return jsonError("Failed to fetch breakfasts", 500);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const parsed = createBreakfastSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const { team_id, owed_by, reason } = parsed.data;

  // Only admin/super_admin can create manual breakfasts
  const teamRole = await getTeamRole(ctx.user_id, team_id);
  const canCreate = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canCreate) return jsonError("Forbidden", 403);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breakfasts")
    .insert({
      tenant_id: ctx.tenant_id,
      team_id,
      owed_by,
      status: "pending",
      type: "manual",
      reason,
    })
    .select()
    .single();

  if (error) return jsonError("Failed to create breakfast", 500);

  // Notify the person who owes
  await createNotification({
    tenant_id: ctx.tenant_id,
    user_id: owed_by,
    type: "breakfast_created",
    title: "Breakfast assigned to you",
    body: reason
      ? `A breakfast was assigned to you: "${reason}"`
      : "A breakfast was manually assigned to you.",
    ref_type: "breakfast",
    ref_id: data.id,
  });

  return jsonSuccess(data, 201);
}
