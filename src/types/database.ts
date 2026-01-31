export type UserRole = "super_admin" | "admin" | "lead" | "member";
export type TeamRole = "admin" | "lead" | "member";
export type BreakfastStatus = "pending" | "scheduled" | "completed" | "cancelled";
export type BreakfastType = "auto" | "manual";
export type NotificationType =
  | "bar_added"
  | "breakfast_created"
  | "breakfast_scheduled"
  | "breakfast_completed"
  | "breakfast_cancelled"
  | "breakfast_deleted"
  | "date_proposed"
  | "date_validated"
  | "date_rejected"
  | "invite_received"
  | "role_changed"
  | "weekly_digest";

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  avatar_url: string | null;
  global_role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  tenant_id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  current_bar_count: number;
  lifetime_bar_count: number;
  is_active: boolean;
  joined_at: string;
  // Joined fields
  profile?: Profile;
}

export interface Bar {
  id: string;
  tenant_id: string;
  team_id: string;
  assigned_to: string;
  assigned_by: string;
  reason: string | null;
  consumed_by_breakfast: string | null;
  created_at: string;
  // Joined fields
  assigned_to_profile?: Profile;
  assigned_by_profile?: Profile;
}

export interface Breakfast {
  id: string;
  tenant_id: string;
  team_id: string;
  owed_by: string;
  status: BreakfastStatus;
  type: BreakfastType;
  reason: string | null;
  scheduled_date: string | null;
  proposed_date: string | null;
  proposed_by: string | null;
  completed_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  owed_by_profile?: Profile;
  proposed_by_profile?: Profile;
  team?: Team;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  ref_type: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: NotificationType;
  email: boolean;
  in_app: boolean;
}

export interface InviteLink {
  id: string;
  tenant_id: string;
  team_id: string;
  created_by: string;
  role: TeamRole;
  token: string;
  is_used: boolean;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  // Joined fields
  actor?: Profile;
}

// Result from the add_bar database function
export interface AddBarResult {
  bar_id: string;
  new_count: number;
  breakfast_id: string | null;
}
