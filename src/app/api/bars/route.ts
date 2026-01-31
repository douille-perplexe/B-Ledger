import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createNotification,
} from "@/lib/api/helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { addBarSchema } from "@/lib/validations/bar";
import type { AddBarResult } from "@/types/database";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");
  const memberId = searchParams.get("member_id");

  const supabase = await createClient();
  let query = supabase
    .from("bars")
    .select("*, assigned_to_profile:profiles!bars_assigned_to_fkey(*), assigned_by_profile:profiles!bars_assigned_by_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (teamId) query = query.eq("team_id", teamId);
  if (memberId) query = query.eq("assigned_to", memberId);

  const { data, error } = await query;
  if (error) return jsonError("Failed to fetch bars", 500);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const parsed = addBarSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const { team_id, assigned_to, reason } = parsed.data;

  // Check permissions
  const teamRole = await getTeamRole(ctx.user_id, team_id);
  if (!teamRole && ctx.global_role !== "super_admin") {
    return jsonError("You are not a member of this team", 403);
  }

  const isSelfAssign = assigned_to === ctx.user_id;
  const canAssignOthers =
    ctx.global_role === "super_admin" ||
    teamRole === "admin" ||
    teamRole === "lead";

  if (!isSelfAssign && !canAssignOthers) {
    return jsonError("You can only add bars to yourself", 403);
  }

  // Verify target is an active member of the team
  const supabase = await createClient();
  const { data: targetMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", team_id)
    .eq("user_id", assigned_to)
    .eq("is_active", true)
    .single();

  if (!targetMember) {
    return jsonError("Target user is not an active member of this team", 404);
  }

  // Call the database function (handles transaction + breakfast creation)
  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient.rpc("add_bar", {
    p_tenant_id: ctx.tenant_id,
    p_team_id: team_id,
    p_assigned_to: assigned_to,
    p_assigned_by: ctx.user_id,
    p_reason: reason || null,
  });

  if (error) return jsonError("Failed to add bar", 500);

  const result = data as unknown as AddBarResult;

  // Send notification for bar added
  await createNotification({
    tenant_id: ctx.tenant_id,
    user_id: assigned_to,
    type: "bar_added",
    title: "New bar added",
    body: reason
      ? `You received a bar: "${reason}"`
      : "You received a new bar.",
    ref_type: "bar",
    ref_id: result.bar_id,
  });

  // If breakfast was auto-created, notify the user and their lead
  if (result.breakfast_id) {
    await createNotification({
      tenant_id: ctx.tenant_id,
      user_id: assigned_to,
      type: "breakfast_created",
      title: "Breakfast time!",
      body: "You reached 5 bars. A breakfast has been created for you.",
      ref_type: "breakfast",
      ref_id: result.breakfast_id,
    });

    // Notify leads/admins of the team
    const { data: teamLeads } = await serviceClient
      .from("team_members")
      .select("user_id")
      .eq("team_id", team_id)
      .eq("is_active", true)
      .in("role", ["admin", "lead"]);

    if (teamLeads) {
      for (const lead of teamLeads) {
        if (lead.user_id !== assigned_to) {
          await createNotification({
            tenant_id: ctx.tenant_id,
            user_id: lead.user_id,
            type: "breakfast_created",
            title: "New breakfast created",
            body: `A team member reached 5 bars. A breakfast is now pending.`,
            ref_type: "breakfast",
            ref_id: result.breakfast_id,
          });
        }
      }
    }
  }

  return jsonSuccess(result, 201);
}
