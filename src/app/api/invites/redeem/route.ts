import { jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { token } = body;

  if (!token) return jsonError("Token required", 400);

  const serviceClient = await createServiceClient();

  // Fetch and validate invite
  const { data: invite, error } = await serviceClient
    .from("invite_links")
    .select("*")
    .eq("token", token)
    .eq("is_used", false)
    .single();

  if (error || !invite) {
    return jsonError("Invalid invite link", 404);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return jsonError("This invite link has expired", 410);
  }

  // Update user profile with tenant
  await serviceClient
    .from("profiles")
    .update({
      tenant_id: invite.tenant_id,
      global_role: invite.role === "admin" ? "admin" : "member",
    })
    .eq("id", user.id);

  // Add user to team
  const { error: memberError } = await serviceClient
    .from("team_members")
    .insert({
      team_id: invite.team_id,
      user_id: user.id,
      role: invite.role,
    });

  if (memberError && memberError.code !== "23505") {
    return jsonError("Failed to join team", 500);
  }

  // Mark invite as used
  await serviceClient
    .from("invite_links")
    .update({ is_used: true, used_by: user.id })
    .eq("id", invite.id);

  return jsonSuccess({ success: true, team_id: invite.team_id });
}
