import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
} from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { createInviteSchema } from "@/lib/validations/invite";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");

  const supabase = await createClient();
  let query = supabase
    .from("invite_links")
    .select("*")
    .eq("is_used", false)
    .order("created_at", { ascending: false });

  if (teamId) query = query.eq("team_id", teamId);

  const { data, error } = await query;
  if (error) return jsonError("Failed to fetch invites", 500);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const parsed = createInviteSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const { team_id, role } = parsed.data;

  const teamRole = await getTeamRole(ctx.user_id, team_id);
  const canInvite = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!canInvite) return jsonError("Forbidden", 403);

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  const supabase = await createClient();
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

  if (error) return jsonError("Failed to create invite", 500);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

  return jsonSuccess({ ...data, invite_url: inviteUrl }, 201);
}
