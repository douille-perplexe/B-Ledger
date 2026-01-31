import { getAuthContext, jsonError, jsonSuccess, createAuditLog } from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";

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

    const { user_id, global_role } = body as Record<string, string>;

    if (!user_id || !global_role) return jsonError("Missing fields", 400);
    if (!["super_admin", "admin", "lead", "member"].includes(global_role)) {
      return jsonError("Invalid role", 400);
    }

    const serviceClient = await createServiceClient();

    const { data: oldProfile } = await serviceClient
      .from("profiles")
      .select("global_role")
      .eq("id", user_id)
      .eq("tenant_id", ctx.tenant_id)
      .single();

    if (!oldProfile) return jsonError("User not found", 404);

    const { error } = await serviceClient
      .from("profiles")
      .update({ global_role })
      .eq("id", user_id)
      .eq("tenant_id", ctx.tenant_id);

    if (error) {
      console.error("Update role error:", error);
      return jsonError(error.message || "Failed to update role", 500);
    }

    createAuditLog({
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
      action: "global_role_changed",
      entity_type: "profile",
      entity_id: user_id,
      old_values: { global_role: oldProfile.global_role },
      new_values: { global_role },
    }).catch((err) => console.error("Audit log error:", err));

    return jsonSuccess({ success: true });
  } catch (err) {
    console.error("Unhandled error in POST /api/admin/update-role:", err);
    return jsonError("Internal server error", 500);
  }
}
