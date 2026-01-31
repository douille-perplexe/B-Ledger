# B-Ledger — Technical Architecture

**Version:** 1.0
**Last updated:** 2026-01-31
**Source:** [PRD](./prd.md)

---

## 1. System Overview

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          VERCEL (Hosting)                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Next.js App (App Router)                    │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  │  │
│  │  │   Pages (RSC)    │  │  Client Comps   │  │  Middleware   │  │  │
│  │  │                  │  │                  │  │              │  │  │
│  │  │ /dashboard       │  │ BarCounter      │  │ Auth guard   │  │  │
│  │  │ /team/[id]       │  │ CalendarView    │  │ Role check   │  │  │
│  │  │ /calendar        │  │ NotifBell       │  │ Tenant ctx   │  │  │
│  │  │ /settings        │  │ BreakfastCard   │  │ Rate limit   │  │  │
│  │  │ /admin/*         │  │ InviteModal     │  │              │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘  │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │              API Route Handlers (/api/*)                 │  │  │
│  │  │                                                          │  │  │
│  │  │  /api/bars          POST, GET                            │  │  │
│  │  │  /api/breakfasts    POST, GET, PATCH                     │  │  │
│  │  │  /api/teams         POST, GET, PATCH, DELETE             │  │  │
│  │  │  /api/invites       POST, GET                            │  │  │
│  │  │  /api/notifications GET, PATCH                           │  │  │
│  │  │  /api/audit-log     GET                                  │  │  │
│  │  │  /api/webhooks/*    POST (Resend, Supabase)              │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                    │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │  Auth         │  │  PostgreSQL   │  │  Edge Functions           │ │
│  │               │  │               │  │                           │ │
│  │ Email/Pass    │  │ Tables w/RLS  │  │ send-email                │ │
│  │ Magic Link    │  │ Functions     │  │ weekly-digest             │ │
│  │ JWT tokens    │  │ Triggers      │  │ (cron: Mon 9:00 UTC)     │ │
│  │               │  │               │  │                           │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Realtime (WebSocket)                                        │   │
│  │  - notifications table subscription per user                 │   │
│  │  - breakfast status changes per team                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS (API)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     RESEND (Email Provider)                          │
│                                                                     │
│  Transactional emails: bar notifications, breakfast alerts,         │
│  invite links, weekly digests, password reset                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Request Flow — "Add a Bar" (Main User Journey)

```
User (Lead) clicks "Add Bar" on team member
        │
        ▼
┌─1─ Client Component ─────────────────────────────┐
│  Validates input (reason max 200 chars)           │
│  POST /api/bars { assigned_to, reason, team_id }  │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌─2─ Next.js Middleware ────────────────────────────┐
│  Verify Supabase JWT (from cookie)                │
│  Extract user_id, tenant_id from session          │
│  Rate limit check (100 writes/min)                │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌─3─ API Route: POST /api/bars ─────────────────────┐
│  a. Verify role >= lead OR assigned_to == self     │
│  b. Verify target user belongs to team             │
│  c. BEGIN TRANSACTION                              │
│     - INSERT into bars table                       │
│     - SELECT current_bar_count FOR UPDATE          │
│       from team_members                            │
│     - UPDATE current_bar_count + 1                 │
│     - IF current_bar_count == 5:                   │
│         - INSERT into breakfasts (status=pending)  │
│         - UPDATE current_bar_count = 0             │
│         - Mark consumed bars (consumed_by_breakfast)│
│     - COMMIT                                       │
│  d. INSERT into notifications (in-app)             │
│  e. Call Supabase Edge Function: send-email        │
│  f. Return 201 { bar, breakfast? }                 │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌─4─ Supabase Realtime ─────────────────────────────┐
│  Broadcasts new notification row to user channel   │
│  Client NotifBell updates unread count             │
└───────────────────────────────────────────────────┘
```

### 1.3 Request Flow — "Schedule a Breakfast"

```
User (member who owes) selects a date
        │
        ▼
┌─1─ Client ────────────────────────────────────────┐
│  Validates date: future, within 30 days of created │
│  PATCH /api/breakfasts/[id] { scheduled_date }     │
└───────────────────────┬───────────────────────────┘
                        │
                        ▼
┌─2─ API Route: PATCH /api/breakfasts/[id] ─────────┐
│  a. Verify user == owed_by (or lead with proposal) │
│  b. Check: no other breakfast for team on that date│
│     - If conflict & user is admin: warn, allow     │
│     - If conflict & user is not admin: reject 409  │
│  c. If user == owed_by:                            │
│     - UPDATE status = 'scheduled', scheduled_date  │
│  d. If user == lead:                               │
│     - UPDATE proposed_date, proposed_by             │
│     - Notify owed_by to validate                   │
│  e. INSERT audit_log entry                         │
│  f. Return 200 { breakfast }                       │
└───────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 ER Diagram

```
tenants ──< teams ──< team_members >── profiles
                          │
                    ┌─────┴─────┐
                    ▼           ▼
                  bars      breakfasts
                    │           │
                    └─────┬─────┘
                          ▼
                    notifications
                          │
                    audit_log

invite_links ──> teams
notification_preferences ──> profiles
```

### 2.2 Table Definitions

#### `tenants`

```sql
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  timezone    VARCHAR(50) NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_name ON tenants(name);
```

#### `profiles`

Extends Supabase `auth.users`. Created via trigger on user signup.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  full_name   VARCHAR(100) NOT NULL,
  avatar_url  TEXT,
  global_role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (global_role IN ('super_admin', 'admin', 'lead', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_profiles_email ON profiles(email);
```

#### `teams`

```sql
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_teams_tenant ON teams(tenant_id);
CREATE INDEX idx_teams_archived ON teams(tenant_id, is_archived);
```

#### `team_members`

Junction table. Holds per-team role and current bar count.

```sql
CREATE TABLE team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role              VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'lead', 'member')),
  current_bar_count INTEGER NOT NULL DEFAULT 0 CHECK (current_bar_count >= 0 AND current_bar_count <= 4),
  lifetime_bar_count INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_active ON team_members(team_id, is_active);
```

#### `bars`

```sql
CREATE TABLE bars (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id                UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_to            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason                 VARCHAR(200),
  consumed_by_breakfast  UUID REFERENCES breakfasts(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bars_team ON bars(team_id);
CREATE INDEX idx_bars_assigned_to ON bars(assigned_to);
CREATE INDEX idx_bars_tenant ON bars(tenant_id);
CREATE INDEX idx_bars_created ON bars(created_at);
CREATE INDEX idx_bars_unconsumed ON bars(assigned_to, team_id)
  WHERE consumed_by_breakfast IS NULL;
```

#### `breakfasts`

```sql
CREATE TABLE breakfasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owed_by         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
  type            VARCHAR(10) NOT NULL DEFAULT 'auto'
    CHECK (type IN ('auto', 'manual')),
  reason          VARCHAR(200),
  scheduled_date  DATE,
  proposed_date   DATE,
  proposed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_team_date_active
    EXCLUDE USING gist (
      team_id WITH =,
      scheduled_date WITH =
    ) WHERE (is_deleted = false AND status != 'cancelled')
);

CREATE INDEX idx_breakfasts_team ON breakfasts(team_id);
CREATE INDEX idx_breakfasts_owed ON breakfasts(owed_by);
CREATE INDEX idx_breakfasts_tenant ON breakfasts(tenant_id);
CREATE INDEX idx_breakfasts_status ON breakfasts(status);
CREATE INDEX idx_breakfasts_scheduled ON breakfasts(team_id, scheduled_date)
  WHERE is_deleted = false;
```

> **Note on exclusion constraint:** The `EXCLUDE` constraint enforces one breakfast per team per day at the DB level. Admin bypass is implemented by temporarily setting `is_deleted = false` with an explicit admin override flag — the API route skips the constraint check for admins by inserting with a direct SQL override using `SET LOCAL` or by catching the constraint violation and re-inserting with admin confirmation.

#### `notifications`

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL
    CHECK (type IN (
      'bar_added', 'breakfast_created', 'breakfast_scheduled',
      'breakfast_completed', 'breakfast_cancelled', 'breakfast_deleted',
      'date_proposed', 'date_validated', 'date_rejected',
      'invite_received', 'role_changed', 'weekly_digest'
    )),
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  ref_type    VARCHAR(20),  -- 'bar', 'breakfast', 'team', 'invite'
  ref_id      UUID,         -- ID of referenced entity
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read)
  WHERE is_read = false;
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

#### `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL,
  email       BOOLEAN NOT NULL DEFAULT true,
  in_app      BOOLEAN NOT NULL DEFAULT true,

  UNIQUE(user_id, event_type)
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);
```

#### `invite_links`

```sql
CREATE TABLE invite_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'lead', 'member')),
  token       VARCHAR(64) NOT NULL UNIQUE,
  is_used     BOOLEAN NOT NULL DEFAULT false,
  used_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_links_token ON invite_links(token);
CREATE INDEX idx_invite_links_team ON invite_links(team_id);
```

#### `audit_log`

Immutable — no UPDATE or DELETE allowed.

```sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,  -- 'breakfast', 'bar', 'team', 'profile'
  entity_id   UUID NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  reason      VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Prevent mutations on audit_log
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

### 2.3 Database Functions & Triggers

#### Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### Add bar with breakfast auto-creation (called from API)

```sql
CREATE OR REPLACE FUNCTION add_bar(
  p_tenant_id UUID,
  p_team_id UUID,
  p_assigned_to UUID,
  p_assigned_by UUID,
  p_reason VARCHAR(200) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_bar_id UUID;
  v_new_count INTEGER;
  v_breakfast_id UUID := NULL;
BEGIN
  -- Insert bar
  INSERT INTO bars (tenant_id, team_id, assigned_to, assigned_by, reason)
  VALUES (p_tenant_id, p_team_id, p_assigned_to, p_assigned_by, p_reason)
  RETURNING id INTO v_bar_id;

  -- Lock and increment counter
  UPDATE team_members
  SET current_bar_count = current_bar_count + 1,
      lifetime_bar_count = lifetime_bar_count + 1
  WHERE team_id = p_team_id AND user_id = p_assigned_to
  RETURNING current_bar_count INTO v_new_count;

  -- Check threshold
  IF v_new_count >= 5 THEN
    -- Create breakfast
    INSERT INTO breakfasts (tenant_id, team_id, owed_by, status, type)
    VALUES (p_tenant_id, p_team_id, p_assigned_to, 'pending', 'auto')
    RETURNING id INTO v_breakfast_id;

    -- Consume bars
    UPDATE bars
    SET consumed_by_breakfast = v_breakfast_id
    WHERE team_id = p_team_id
      AND assigned_to = p_assigned_to
      AND consumed_by_breakfast IS NULL;

    -- Reset counter
    UPDATE team_members
    SET current_bar_count = 0
    WHERE team_id = p_team_id AND user_id = p_assigned_to;
  END IF;

  RETURN jsonb_build_object(
    'bar_id', v_bar_id,
    'new_count', CASE WHEN v_new_count >= 5 THEN 0 ELSE v_new_count END,
    'breakfast_id', v_breakfast_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Auto-update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all mutable tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON breakfasts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 3. Row-Level Security (RLS) Policies

All tables have RLS enabled. The helper function below resolves user context:

```sql
-- Helper: get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's global role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT global_role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user's role in a specific team
CREATE OR REPLACE FUNCTION public.get_team_role(p_team_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM team_members
  WHERE user_id = auth.uid() AND team_id = p_team_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT global_role = 'super_admin' FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### `tenants`

```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Users can read their own tenant
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (id = public.get_user_tenant_id());

-- Only super_admin can insert
CREATE POLICY tenants_insert ON tenants FOR INSERT
  WITH CHECK (public.is_super_admin() OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()));

-- Only super_admin can update their tenant
CREATE POLICY tenants_update ON tenants FOR UPDATE
  USING (id = public.get_user_tenant_id() AND public.is_super_admin());
```

### `profiles`

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read profiles in their tenant
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id() OR id = auth.uid());

-- Users can update their own profile
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Super-admin can update any profile in tenant
CREATE POLICY profiles_update_admin ON profiles FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_super_admin());

-- Insert via trigger (SECURITY DEFINER), no direct insert
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
```

### `teams`

```sql
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Members can read teams they belong to; super-admin sees all in tenant
CREATE POLICY teams_select ON teams FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
    )
  );

-- Only super-admin can create teams
CREATE POLICY teams_insert ON teams FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_super_admin());

-- Super-admin can update; admin can update their team
CREATE POLICY teams_update ON teams FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(id) = 'admin')
  );
```

### `team_members`

```sql
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Users can see members of their teams; super-admin sees all
CREATE POLICY team_members_select ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (
      public.is_super_admin()
      OR team_id IN (SELECT team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.is_active = true)
    )
  );

-- Admin/super-admin can add members
CREATE POLICY team_members_insert ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );

-- Admin/super-admin can update members in their team
CREATE POLICY team_members_update ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );
```

### `bars`

```sql
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;

-- Users can see bars in their teams
CREATE POLICY bars_select ON bars FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
    )
  );

-- Insert: lead/admin can assign to anyone in team; member only to self
CREATE POLICY bars_insert ON bars FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR (public.get_team_role(team_id) IN ('admin', 'lead'))
      OR (public.get_team_role(team_id) = 'member' AND assigned_to = auth.uid() AND assigned_by = auth.uid())
    )
  );

-- No direct update or delete on bars (immutable except consumed_by_breakfast set by function)
```

### `breakfasts`

```sql
ALTER TABLE breakfasts ENABLE ROW LEVEL SECURITY;

-- Users can see breakfasts in their teams (excluding soft-deleted unless admin)
CREATE POLICY breakfasts_select ON breakfasts FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND is_active = true)
        AND is_deleted = false
      )
    )
  );

-- Insert: admin/super-admin for manual; auto via SECURITY DEFINER function
CREATE POLICY breakfasts_insert ON breakfasts FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR public.get_team_role(team_id) = 'admin'
    )
  );

-- Update: owed_by can set date; lead can propose; admin can cancel/delete
CREATE POLICY breakfasts_update ON breakfasts FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR public.get_team_role(team_id) = 'admin'
      OR (owed_by = auth.uid())
      OR (public.get_team_role(team_id) = 'lead')
    )
  );
```

### `notifications`

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Insert via server/edge function only (SECURITY DEFINER)
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (false); -- blocked at RLS; inserted via SECURITY DEFINER functions

-- Users can mark their own as read
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### `notification_preferences`

```sql
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_select ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notif_prefs_insert ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_prefs_update ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid());
```

### `invite_links`

```sql
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Admin/super-admin can see invites for their teams
CREATE POLICY invite_links_select ON invite_links FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(team_id) IN ('admin'))
  );

-- Admin/super-admin can create invites
CREATE POLICY invite_links_insert ON invite_links FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(team_id) IN ('admin'))
  );

-- Update (mark as used) via SECURITY DEFINER function during invite redemption
```

### `audit_log`

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin/super-admin can read audit logs
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_user_role() = 'admin')
  );

-- Insert via SECURITY DEFINER functions only
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (false); -- inserted via SECURITY DEFINER functions
```

---

## 4. API Routes

### 4.1 Public Routes (No Auth)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Landing page |
| GET | `/login` | Login page |
| GET | `/register` | Registration page |
| GET | `/invite/[token]` | Invite link redemption page |
| POST | `/api/auth/register` | Create account (proxied to Supabase) |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/magic-link` | Request magic link |
| POST | `/api/auth/callback` | Supabase auth callback handler |
| POST | `/api/auth/reset-password` | Request password reset |
| POST | `/api/invites/redeem` | Redeem invite token + register/join team |

### 4.2 Protected Routes (Auth Required)

All protected routes go through Next.js middleware that:
1. Verifies Supabase JWT from cookie
2. Extracts `user_id`, `tenant_id`, `global_role`
3. Attaches context to request

#### Bars

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/bars` | super_admin, admin, lead, member (self only) | Add a bar |
| GET | `/api/bars` | all authenticated | List bars (filtered by team, member, date) |
| GET | `/api/bars/stats` | all authenticated | Get bar stats for team/member |

#### Breakfasts

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/breakfasts` | super_admin, admin | Create manual breakfast |
| GET | `/api/breakfasts` | all authenticated | List breakfasts (filtered by team, status, date) |
| GET | `/api/breakfasts/[id]` | all authenticated (team member) | Get breakfast detail |
| PATCH | `/api/breakfasts/[id]` | owed_by, lead, admin, super_admin | Update status, propose/set date |
| PATCH | `/api/breakfasts/[id]/validate` | owed_by | Validate proposed date |
| PATCH | `/api/breakfasts/[id]/complete` | admin, super_admin | Mark as completed |
| PATCH | `/api/breakfasts/[id]/cancel` | admin, super_admin | Cancel breakfast |
| DELETE | `/api/breakfasts/[id]` | admin, super_admin | Soft-delete breakfast |

#### Teams

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/teams` | super_admin | Create team |
| GET | `/api/teams` | all authenticated | List user's teams |
| GET | `/api/teams/[id]` | team member | Get team detail + members |
| PATCH | `/api/teams/[id]` | admin, super_admin | Update team |
| DELETE | `/api/teams/[id]` | super_admin | Archive team (soft-delete) |

#### Team Members

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/teams/[id]/members` | admin, super_admin | Add member to team |
| PATCH | `/api/teams/[id]/members/[userId]` | admin, super_admin | Update member role |
| DELETE | `/api/teams/[id]/members/[userId]` | admin, super_admin | Remove member (soft) |

#### Invites

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/invites` | admin, super_admin | Generate invite link |
| GET | `/api/invites` | admin, super_admin | List active invites for team |
| DELETE | `/api/invites/[id]` | admin, super_admin | Revoke invite |

#### Notifications

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/notifications` | all authenticated | List user's notifications |
| PATCH | `/api/notifications/[id]/read` | owner only | Mark as read |
| PATCH | `/api/notifications/read-all` | owner only | Mark all as read |
| GET | `/api/notifications/preferences` | all authenticated | Get notification prefs |
| PUT | `/api/notifications/preferences` | all authenticated | Update notification prefs |

#### Admin / Tenant

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/api/tenants` | super_admin | Create tenant |
| PATCH | `/api/tenants/[id]` | super_admin | Update tenant settings |
| GET | `/api/audit-log` | admin, super_admin | List audit log entries |

#### Calendar

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/calendar` | all authenticated | Get breakfasts for calendar view (query: team_id, month, year) |

### 4.3 Webhook Routes (External Services)

| Method | Path | Verification | Purpose |
|---|---|---|---|
| POST | `/api/webhooks/resend` | Resend webhook signature (`svix-id`, `svix-timestamp`, `svix-signature`) | Email delivery status updates (delivered, bounced, complained) |
| POST | `/api/webhooks/supabase` | Supabase webhook secret header | Database event hooks (if needed for edge function triggers) |

Webhook verification implementation:

```typescript
// /api/webhooks/resend/route.ts
import { Webhook } from 'svix';

export async function POST(req: Request) {
  const body = await req.text();
  const headers = {
    'svix-id': req.headers.get('svix-id')!,
    'svix-timestamp': req.headers.get('svix-timestamp')!,
    'svix-signature': req.headers.get('svix-signature')!,
  };

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);

  try {
    const event = wh.verify(body, headers);
    // Process delivery status...
    return Response.json({ received: true });
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }
}
```

---

## 5. Environment Variables

### 5.1 Server-Side Only (Never exposed to client)

```env
# Supabase (server)
SUPABASE_SERVICE_ROLE_KEY=       # Full-access key for server-side DB operations
SUPABASE_JWT_SECRET=             # For manual JWT verification if needed

# Email
RESEND_API_KEY=                  # Resend API key for sending emails
RESEND_WEBHOOK_SECRET=           # Svix secret for webhook signature verification
RESEND_FROM_EMAIL=               # noreply@yourdomain.com

# Supabase webhooks
SUPABASE_WEBHOOK_SECRET=         # Shared secret for Supabase webhook verification

# App
INVITE_TOKEN_SECRET=             # Secret for signing invite link tokens
CRON_SECRET=                     # Secret for cron job authentication (weekly digest)
```

### 5.2 Client-Side (Safe to expose)

```env
# Supabase (client) — these are public by design
NEXT_PUBLIC_SUPABASE_URL=        # https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon/public key (RLS enforced)

# App
NEXT_PUBLIC_APP_URL=             # https://b-ledger.vercel.app
NEXT_PUBLIC_APP_NAME=            # B-Ledger
```

### 5.3 Variable Usage Rules

| Rule | Detail |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | NEVER in client components; only in API routes and server actions |
| `RESEND_API_KEY` | Only in API routes and Edge Functions |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe for client; all access gated by RLS |
| Vercel environment | Set all secrets in Vercel dashboard > Settings > Environment Variables |
| Local development | `.env.local` file, git-ignored |

---

## 6. Security Architecture

### 6.1 Defense in Depth

```
Layer 1: Network
├── HTTPS only (Vercel enforced)
├── HSTS headers
└── Content-Security-Policy headers

Layer 2: Authentication
├── Supabase Auth (JWT in httpOnly cookie)
├── Secure, SameSite=Lax cookie flags
├── 15-min access token, 7-day refresh token
└── Magic link: 15-min TTL, single-use

Layer 3: Authorization (Next.js Middleware)
├── Route-level role checks
├── Tenant context injection
└── Rate limiting: 100 writes/min, 300 reads/min per user

Layer 4: Authorization (Supabase RLS)
├── tenant_id isolation on every table
├── Role-based policies (see Section 3)
└── SECURITY DEFINER functions for privileged operations

Layer 5: Data
├── Input validation (zod schemas, server-side)
├── Parameterized queries (Supabase default)
├── Immutable audit_log (no UPDATE/DELETE rules)
└── Soft-deletes only (no data destruction)
```

### 6.2 API Key Security

| Key | Location | Access |
|---|---|---|
| `SUPABASE_ANON_KEY` | Client-side | RLS-restricted, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Bypasses RLS; used in API routes for admin operations and SECURITY DEFINER functions |
| `RESEND_API_KEY` | Server-side only | Used only in Edge Functions and API routes |
| `INVITE_TOKEN_SECRET` | Server-side only | Signs invite tokens with HMAC-SHA256 |

### 6.3 Webhook Signature Verification

| Webhook Source | Verification Method |
|---|---|
| Resend | Svix signature headers (`svix-id`, `svix-timestamp`, `svix-signature`) verified against `RESEND_WEBHOOK_SECRET` |
| Supabase | Custom header `x-supabase-webhook-secret` compared to `SUPABASE_WEBHOOK_SECRET` |
| Cron (Vercel) | `Authorization: Bearer <CRON_SECRET>` header on `/api/cron/weekly-digest` |

### 6.4 Input Validation (Zod Schemas)

```typescript
// Shared validation schemas — applied server-side on every API route
import { z } from 'zod';

export const AddBarSchema = z.object({
  team_id: z.string().uuid(),
  assigned_to: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

export const ScheduleBreakfastSchema = z.object({
  scheduled_date: z.string().date(), // ISO date
});

export const CreateTeamSchema = z.object({
  name: z.string().min(3).max(50),
});

export const CreateInviteSchema = z.object({
  team_id: z.string().uuid(),
  role: z.enum(['admin', 'lead', 'member']),
});
```

### 6.5 Rate Limiting

Implemented in Next.js middleware using in-memory store (Vercel Edge):

| Endpoint Group | Limit | Window |
|---|---|---|
| Write (`POST`, `PATCH`, `DELETE`) | 100 requests | 1 minute |
| Read (`GET`) | 300 requests | 1 minute |
| Auth (`/api/auth/*`) | 10 requests | 1 minute |
| Webhooks | 1000 requests | 1 minute |

### 6.6 RLS Testing Strategy

```
Every RLS policy is tested with:
1. Correct tenant user → should succeed
2. Different tenant user → should fail (empty result or RLS violation)
3. Correct tenant, wrong role → should fail
4. Unauthenticated → should fail
5. Super-admin cross-team access → should succeed where allowed
```

Tests run in CI using Supabase CLI (`supabase test db`) with pgTAP.

---

## 7. Supabase Edge Functions

### `send-email`

Triggered by API routes after bar/breakfast events. Checks user notification preferences before sending.

```
Input:  { user_id, event_type, subject, body_html }
Flow:   1. Check notification_preferences for user + event_type
        2. If email disabled, skip
        3. Call Resend API with RESEND_API_KEY
        4. Log delivery status
```

### `weekly-digest`

Scheduled via Supabase cron (`pg_cron`) or Vercel cron.

```
Schedule: Every Monday 09:00 UTC
Flow:     1. Query all tenants
          2. For each tenant, adjust to tenant timezone
          3. Query leads/admins with digest enabled
          4. Aggregate: bars this week, pending breakfasts, upcoming scheduled
          5. Send digest email via Resend
```

---

## 8. Project Structure

```
b-ledger/
├── docs/
│   ├── product-brief.md
│   ├── prd.md
│   └── architecture.md
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── invite/[token]/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx            # Auth guard, sidebar, notif bell
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── team/[id]/page.tsx    # Team view (roster, bars)
│   │   │   ├── calendar/page.tsx     # Shared calendar
│   │   │   ├── breakfasts/page.tsx   # Breakfast list
│   │   │   └── settings/page.tsx     # User & notification prefs
│   │   ├── admin/
│   │   │   ├── teams/page.tsx
│   │   │   ├── members/page.tsx
│   │   │   ├── audit-log/page.tsx
│   │   │   └── tenant/page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── bars/route.ts
│   │   │   ├── breakfasts/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── validate/route.ts
│   │   │   │       ├── complete/route.ts
│   │   │   │       └── cancel/route.ts
│   │   │   ├── teams/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── members/
│   │   │   ├── invites/
│   │   │   ├── notifications/
│   │   │   ├── calendar/route.ts
│   │   │   ├── audit-log/route.ts
│   │   │   ├── tenants/
│   │   │   ├── webhooks/
│   │   │   │   ├── resend/route.ts
│   │   │   │   └── supabase/route.ts
│   │   │   └── cron/
│   │   │       └── weekly-digest/route.ts
│   │   └── layout.tsx                # Root layout
│   ├── components/
│   │   ├── ui/                       # Shared UI (buttons, modals, cards)
│   │   ├── bar-counter.tsx
│   │   ├── breakfast-card.tsx
│   │   ├── calendar-view.tsx
│   │   ├── notification-bell.tsx
│   │   └── invite-modal.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client (anon key)
│   │   │   ├── server.ts             # Server client (service role)
│   │   │   └── middleware.ts         # Auth middleware helpers
│   │   ├── validations/              # Zod schemas
│   │   ├── email/                    # Resend helpers
│   │   └── utils/                    # Shared utilities
│   ├── hooks/                        # React hooks (useNotifications, useTeam)
│   └── types/                        # TypeScript types & DB types
├── supabase/
│   ├── migrations/                   # SQL migration files
│   ├── functions/                    # Edge functions
│   │   ├── send-email/index.ts
│   │   └── weekly-digest/index.ts
│   ├── tests/                        # pgTAP RLS tests
│   └── config.toml
├── .env.local                        # Local env (git-ignored)
├── .env.example                      # Template
├── middleware.ts                      # Next.js middleware (auth + rate limit)
├── next.config.ts
├── package.json
└── tsconfig.json
```
