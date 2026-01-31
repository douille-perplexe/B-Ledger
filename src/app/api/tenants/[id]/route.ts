import { getAuthContext, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { updateTenantSchema } from "@/lib/validations/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    if (!ctx) return jsonError("Unauthorized", 401);
    if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);
    if (ctx.tenant_id !== id) return jsonError("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("tenants")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update tenant error:", error);
      return jsonError(error.message || "Failed to update", 500);
    }
    return jsonSuccess(data);
  } catch (err) {
    console.error("Unhandled error in PATCH /api/tenants/[id]:", err);
    return jsonError("Internal server error", 500);
  }
}
