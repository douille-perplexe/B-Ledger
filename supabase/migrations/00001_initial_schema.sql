-- B-Ledger Initial Schema
-- Tables, indexes, functions, triggers, RLS policies
--
-- NOTE: Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- The auth.users trigger must be created separately — see the bottom of this file.

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Tenants (organizations)
CREATE TABLE public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  timezone    VARCHAR(50) NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_name ON public.tenants(name);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  full_name   VARCHAR(100) NOT NULL,
  avatar_url  TEXT,
  global_role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (global_role IN ('super_admin', 'admin', 'lead', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- Teams
CREATE TABLE public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(50) NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_teams_tenant ON public.teams(tenant_id);
CREATE INDEX idx_teams_archived ON public.teams(tenant_id, is_archived);

-- Team members (junction)
CREATE TABLE public.team_members (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role               VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'lead', 'member')),
  current_bar_count  INTEGER NOT NULL DEFAULT 0
    CHECK (current_bar_count >= 0 AND current_bar_count <= 4),
  lifetime_bar_count INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_active ON public.team_members(team_id, is_active);

-- Breakfasts (created before bars so bars can reference it)
CREATE TABLE public.breakfasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  owed_by         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
  type            VARCHAR(10) NOT NULL DEFAULT 'auto'
    CHECK (type IN ('auto', 'manual')),
  reason          VARCHAR(200),
  scheduled_date  DATE,
  proposed_date   DATE,
  proposed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_breakfasts_team ON public.breakfasts(team_id);
CREATE INDEX idx_breakfasts_owed ON public.breakfasts(owed_by);
CREATE INDEX idx_breakfasts_tenant ON public.breakfasts(tenant_id);
CREATE INDEX idx_breakfasts_status ON public.breakfasts(status);
CREATE INDEX idx_breakfasts_scheduled ON public.breakfasts(team_id, scheduled_date)
  WHERE is_deleted = false;

-- Bars (faults)
CREATE TABLE public.bars (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id                UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_to            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason                 VARCHAR(200),
  consumed_by_breakfast  UUID REFERENCES public.breakfasts(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bars_team ON public.bars(team_id);
CREATE INDEX idx_bars_assigned_to ON public.bars(assigned_to);
CREATE INDEX idx_bars_tenant ON public.bars(tenant_id);
CREATE INDEX idx_bars_created ON public.bars(created_at);
CREATE INDEX idx_bars_unconsumed ON public.bars(assigned_to, team_id)
  WHERE consumed_by_breakfast IS NULL;

-- Notifications
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL
    CHECK (type IN (
      'bar_added', 'breakfast_created', 'breakfast_scheduled',
      'breakfast_completed', 'breakfast_cancelled', 'breakfast_deleted',
      'date_proposed', 'date_validated', 'date_rejected',
      'invite_received', 'role_changed', 'weekly_digest'
    )),
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  ref_type    VARCHAR(20),
  ref_id      UUID,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read)
  WHERE is_read = false;
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_created ON public.notifications(created_at);

-- Notification preferences
CREATE TABLE public.notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL,
  email       BOOLEAN NOT NULL DEFAULT true,
  in_app      BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, event_type)
);

CREATE INDEX idx_notif_prefs_user ON public.notification_preferences(user_id);

-- Invite links
CREATE TABLE public.invite_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'lead', 'member')),
  token       VARCHAR(64) NOT NULL UNIQUE,
  is_used     BOOLEAN NOT NULL DEFAULT false,
  used_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_links_token ON public.invite_links(token);
CREATE INDEX idx_invite_links_team ON public.invite_links(team_id);

-- Audit log (immutable)
CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id   UUID NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  reason      VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_created ON public.audit_log(created_at);

-- Prevent mutations on audit_log
CREATE RULE no_update_audit AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup (trigger on auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger references auth.users — Supabase allows this when
-- the function is in the public schema with SECURITY DEFINER.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.breakfasts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add bar with automatic breakfast creation (transactional)
CREATE OR REPLACE FUNCTION public.add_bar(
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
  INSERT INTO public.bars (tenant_id, team_id, assigned_to, assigned_by, reason)
  VALUES (p_tenant_id, p_team_id, p_assigned_to, p_assigned_by, p_reason)
  RETURNING id INTO v_bar_id;

  -- Lock and increment counter
  UPDATE public.team_members
  SET current_bar_count = current_bar_count + 1,
      lifetime_bar_count = lifetime_bar_count + 1
  WHERE team_id = p_team_id AND user_id = p_assigned_to
  RETURNING current_bar_count INTO v_new_count;

  -- Check threshold
  IF v_new_count >= 5 THEN
    -- Create breakfast
    INSERT INTO public.breakfasts (tenant_id, team_id, owed_by, status, type)
    VALUES (p_tenant_id, p_team_id, p_assigned_to, 'pending', 'auto')
    RETURNING id INTO v_breakfast_id;

    -- Consume bars
    UPDATE public.bars
    SET consumed_by_breakfast = v_breakfast_id
    WHERE team_id = p_team_id
      AND assigned_to = p_assigned_to
      AND consumed_by_breakfast IS NULL;

    -- Reset counter
    UPDATE public.team_members
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

-- ============================================================
-- RLS HELPER FUNCTIONS (in public schema, not auth)
-- ============================================================

-- Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's global role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT global_role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in a specific team
CREATE OR REPLACE FUNCTION public.get_team_role(p_team_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.team_members
  WHERE user_id = auth.uid() AND team_id = p_team_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT global_role = 'super_admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- TENANTS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id());

CREATE POLICY tenants_insert ON public.tenants FOR INSERT
  WITH CHECK (true); -- controlled at API level; new users need to create tenant

CREATE POLICY tenants_update ON public.tenants FOR UPDATE
  USING (id = public.get_user_tenant_id() AND public.is_super_admin());

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (tenant_id = public.get_user_tenant_id() OR id = auth.uid());

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_super_admin());

CREATE POLICY profiles_insert ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- TEAMS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_select ON public.teams FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY teams_insert ON public.teams FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND public.is_super_admin());

CREATE POLICY teams_update ON public.teams FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(id) = 'admin')
  );

-- TEAM MEMBERS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_select ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (
      public.is_super_admin()
      OR team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.is_active = true)
    )
  );

CREATE POLICY team_members_insert ON public.team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );

CREATE POLICY team_members_update ON public.team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND t.tenant_id = public.get_user_tenant_id()
    )
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );

-- BARS
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;

CREATE POLICY bars_select ON public.bars FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY bars_insert ON public.bars FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR (public.get_team_role(team_id) IN ('admin', 'lead'))
      OR (public.get_team_role(team_id) = 'member' AND assigned_to = auth.uid() AND assigned_by = auth.uid())
    )
  );

-- BREAKFASTS
ALTER TABLE public.breakfasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY breakfasts_select ON public.breakfasts FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND is_active = true)
        AND is_deleted = false
      )
    )
  );

CREATE POLICY breakfasts_insert ON public.breakfasts FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR public.get_team_role(team_id) = 'admin'
    )
  );

CREATE POLICY breakfasts_update ON public.breakfasts FOR UPDATE
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (
      public.is_super_admin()
      OR public.get_team_role(team_id) = 'admin'
      OR owed_by = auth.uid()
      OR public.get_team_role(team_id) = 'lead'
    )
  );

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTIFICATION PREFERENCES
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_select ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notif_prefs_insert ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notif_prefs_update ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY notif_prefs_delete ON public.notification_preferences FOR DELETE
  USING (user_id = auth.uid());

-- INVITE LINKS
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY invite_links_select ON public.invite_links FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );

CREATE POLICY invite_links_insert ON public.invite_links FOR INSERT
  WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_team_role(team_id) = 'admin')
  );

-- AUDIT LOG
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id()
    AND (public.is_super_admin() OR public.get_user_role() = 'admin')
  );

-- ============================================================
-- REALTIME (enable for notifications)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
