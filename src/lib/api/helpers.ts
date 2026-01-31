import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, TeamRole, UserRole } from "@/types/database";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export interface AuthContext {
  user_id: string;
  tenant_id: string;
  global_role: UserRole;
  profile: Profile;
}

/**
 * Authenticate the request and return user context.
 * Returns null if authentication fails (caller should return 401).
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return null;

  return {
    user_id: user.id,
    tenant_id: profile.tenant_id,
    global_role: profile.global_role as UserRole,
    profile,
  };
}

/**
 * Get a user's role in a specific team.
 */
export async function getTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .eq("is_active", true)
    .single();

  return data?.role as TeamRole | null;
}

/**
 * Check if user has at least the required role level.
 * super_admin > admin > lead > member
 */
export function hasMinRole(
  userRole: UserRole | TeamRole,
  requiredRole: UserRole | TeamRole
): boolean {
  const hierarchy: Record<string, number> = {
    super_admin: 4,
    admin: 3,
    lead: 2,
    member: 1,
  };
  return (hierarchy[userRole] ?? 0) >= (hierarchy[requiredRole] ?? 0);
}

/**
 * Create an audit log entry using the service client to bypass RLS.
 */
export async function createAuditLog(params: {
  tenant_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();
  await supabase.from("audit_log").insert(params);
}

/**
 * Create an in-app notification using the service client to bypass RLS.
 */
export async function createNotification(params: {
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  ref_type?: string;
  ref_id?: string;
}) {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();
  await supabase.from("notifications").insert(params);
}
