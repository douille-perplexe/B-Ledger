import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
} from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { createInviteSchema } from "@/lib/validations/invite";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("team_id");

    const supabase = await createServiceClient();
    let query = supabase
      .from("invite_links")
      .select("*")
      .eq("tenant_id", ctx.tenant_id)
      .eq("is_used", false)
      .order("created_at", { ascending: false });

    if (teamId) query = query.eq("team_id", teamId);

    const { data, error } = await query;
    if (error) {
      console.error("Fetch invites error:", error);
      return jsonError("Failed to fetch invites", 500);
    }
    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in GET /api/invites:", err);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const { team_id, role } = parsed.data;

    const teamRole = await getTeamRole(ctx.user_id, team_id);
    const canInvite = ctx.global_role === "super_admin" || teamRole === "admin";
    if (!canInvite) return jsonError("Forbidden", 403);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("invite_links")
      .insert({
        tenant_id: ctx.tenant_id,
        team_id,
        created_by: ctx.user_id,
        role,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Create invite error:", error);
      return jsonError(error.message || "Failed to create invite", 500);
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    return jsonSuccess({ ...data, invite_url: inviteUrl }, 201);
  } catch (err) {
    console.error("Unhandled error in POST /api/invites:", err);
    return jsonError("Internal server error", 500);
  }
}
