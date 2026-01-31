import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createTenantSchema } from "@/lib/validations/tenant";
import { jsonError, jsonSuccess } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }

  // Check if user already has a tenant
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profile?.tenant_id) {
    return jsonError("You already belong to an organization", 400);
  }

  // Use service client to create tenant and update profile
  const serviceClient = await createServiceClient();

  const { data: tenant, error: tenantError } = await serviceClient
    .from("tenants")
    .insert({ name: parsed.data.name, timezone: parsed.data.timezone })
    .select()
    .single();

  if (tenantError) {
    return jsonError("Failed to create organization", 500);
  }

  // Assign user as super_admin of the tenant
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ tenant_id: tenant.id, global_role: "super_admin" })
    .eq("id", user.id);

  if (profileError) {
    return jsonError("Failed to assign organization", 500);
  }

  return jsonSuccess(tenant, 201);
}
