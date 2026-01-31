import { getAuthContext, jsonError, jsonSuccess, hasMinRole } from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);
    if (!hasMinRole(ctx.global_role, "admin")) return jsonError("Forbidden", 403);

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const entityId = searchParams.get("entity_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const supabase = await createServiceClient();
    let query = supabase
      .from("audit_log")
      .select("*, actor:profiles!actor_id(id, full_name, email)")
      .eq("tenant_id", ctx.tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);

    const { data, error } = await query;
    if (error) {
      console.error("Fetch audit log error:", error);
      return jsonError("Failed to fetch audit log", 500);
    }
    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in GET /api/audit-log:", err);
    return jsonError("Internal server error", 500);
  }
}
