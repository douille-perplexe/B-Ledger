import { getAuthContext, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { updateTenantSchema } from "@/lib/validations/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);
  if (ctx.global_role !== "super_admin") return jsonError("Forbidden", 403);
  if (ctx.tenant_id !== id) return jsonError("Forbidden", 403);

  const body = await request.json();
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid input", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError("Failed to update", 500);
  return jsonSuccess(data);
}
