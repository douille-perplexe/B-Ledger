# B-Ledger — Product Requirements Document (PRD)

**Version:** 1.0
**Last updated:** 2026-01-31
**Status:** Draft
**Source:** [Product Brief](../product-brief.md)

---

## 1. Product Overview

### Vision Statement

B-Ledger makes team accountability visible, trackable, and fun by turning mistakes into breakfast obligations through a transparent ledger system.

### Goals

| # | Goal | Measurable Target |
|---|---|---|
| G1 | Eliminate informal / lost bar tracking | 100% of bars recorded with assignee, author, timestamp within 30 days of launch |
| G2 | Ensure breakfast obligations are fulfilled | 90% of auto-created breakfasts reach **Completed** status within 30 days |
| G3 | Drive adoption across initial team | 20 active users within first 2 weeks of launch |
| G4 | Support multi-tenant scale | Handle 10 tenants, 50 teams, 100 users with no degradation |
| G5 | Deliver reliable notifications | 99% delivery rate for email + in-app notifications |

### Success Metrics

| Metric | Definition | Measurement Method | Target |
|---|---|---|---|
| DAU / WAU | Daily / Weekly active users | Supabase Auth session tracking | 60% WAU ratio in first month |
| Bar logging rate | Bars created per team per week | DB query on `bars` table grouped by `team_id` and week | > 0 per active team per week |
| Breakfast completion rate | % of breakfasts reaching **Completed** | `COUNT(completed) / COUNT(total)` on `breakfasts` table | >= 90% |
| Scheduling compliance | % of breakfasts scheduled within 30 days of creation | `scheduled_date - created_at <= 30d` | >= 90% |
| Notification delivery | % of notifications successfully delivered | Email provider delivery receipts + in-app read status | >= 99% |
| Avg. time to schedule | Days between breakfast creation and date assignment | `scheduled_at - created_at` on `breakfasts` table | <= 7 days |

---

## 2. User Stories by Epic

### Epic 1 — Authentication & Multi-Tenancy

**US-1.1** As a new user, I want to register with my email and password, so that I can create an account without external dependencies.

> **Acceptance Criteria:**
> - **Given** a user visits the registration page, **When** they submit a valid email and password (min 8 chars, 1 uppercase, 1 number), **Then** an account is created and a verification email is sent.
> - **Given** a user submits an already-registered email, **When** the form is submitted, **Then** an error message is displayed without revealing whether the email exists (security).

**US-1.2** As a new user, I want to log in via magic link, so that I don't need to remember a password.

> **Acceptance Criteria:**
> - **Given** a registered user enters their email, **When** they request a magic link, **Then** an email with a one-time login link is sent within 30 seconds.
> - **Given** a magic link is clicked, **When** the link is valid and not expired (15-minute TTL), **Then** the user is authenticated and redirected to their dashboard.

**US-1.3** As a super-admin, I want to create a tenant (organization), so that my company has its own isolated space.

> **Acceptance Criteria:**
> - **Given** a super-admin is logged in, **When** they create a tenant with a name (3-50 chars), **Then** the tenant is created and the super-admin is assigned as owner.
> - **Given** a tenant exists, **When** any data is queried, **Then** only data belonging to that tenant is returned (RLS enforcement).

**US-1.4** As an admin, I want to generate an invite link for a specific team, so that new members can join without manual account setup.

> **Acceptance Criteria:**
> - **Given** an admin generates an invite link for team "Backend", **When** a new user clicks the link and registers, **Then** they are automatically added to team "Backend" with the role "team member".
> - **Given** an invite link, **When** it is used after 7 days, **Then** it is expired and the user sees an error with instructions to request a new link.

**US-1.5** As a super-admin, I want to assign roles to users (admin, lead, member), so that access control is enforced across the organization.

> **Acceptance Criteria:**
> - **Given** a super-admin views a user profile, **When** they change the role from "member" to "admin", **Then** the user immediately gains admin permissions for their team.
> - **Given** a role change, **When** saved, **Then** an audit log entry is created with `changed_by`, `old_role`, `new_role`, `timestamp`.

---

### Epic 2 — Team Management

**US-2.1** As a super-admin, I want to create, edit, and archive teams, so that the organizational structure is reflected in the app.

> **Acceptance Criteria:**
> - **Given** a super-admin clicks "Create Team", **When** they provide a name (3-50 chars) and save, **Then** the team is created within the current tenant.
> - **Given** a team is archived, **When** users browse teams, **Then** the archived team is hidden from active views but its data (bars, breakfasts) is preserved.

**US-2.2** As an admin, I want to add or remove members from my team, so that the roster stays current.

> **Acceptance Criteria:**
> - **Given** an admin adds a user to their team, **When** saved, **Then** the user appears in the team member list and can see the team calendar.
> - **Given** an admin removes a member, **When** confirmed, **Then** the member loses access to the team but their historical bars and breakfasts are preserved.

**US-2.3** As a team member, I want to see my team roster, so that I know who is on my team.

> **Acceptance Criteria:**
> - **Given** a member opens their team page, **When** the page loads, **Then** all active team members are displayed with their name, role, and current bar count.

---

### Epic 3 — Bar (Fault) Tracking

**US-3.1** As a lead/admin, I want to add a bar to any team member, so that mistakes are formally recorded.

> **Acceptance Criteria:**
> - **Given** a lead selects a team member, **When** they click "Add Bar" and optionally enter a reason (max 200 chars), **Then** a bar is created with `assigned_to`, `assigned_by`, `reason`, `timestamp`.
> - **Given** a team member role user tries to add a bar to another member, **When** they attempt the action, **Then** it is blocked with a 403 error.

**US-3.2** As a team member, I want to add a bar to myself, so that I can self-report my mistakes.

> **Acceptance Criteria:**
> - **Given** a team member clicks "Add Bar to Myself", **When** confirmed, **Then** a bar is created with `assigned_to = assigned_by = current_user`.

**US-3.3** As a team member, I want to see my current bar count and history, so that I know where I stand.

> **Acceptance Criteria:**
> - **Given** a member opens their profile, **When** the page loads, **Then** they see: current bars (0-4), lifetime total bars, and a chronological list of all bars with reason and date.

**US-3.4** As a lead, I want to see bar counts for all team members, so that I can track accountability.

> **Acceptance Criteria:**
> - **Given** a lead opens the team view, **When** the page loads, **Then** a table/list shows each member with their current bar count (0-4), sorted by count descending.

---

### Epic 4 — Breakfast Creation & Lifecycle

**US-4.1** As the system, I want to automatically create a breakfast when a member reaches 5 bars, so that the obligation is tracked without manual intervention.

> **Acceptance Criteria:**
> - **Given** a member has 4 current bars, **When** a 5th bar is added, **Then** a breakfast is created with status **Pending**, the 5 bars are consumed (counter resets to 0), and notifications are sent to the member and their lead/manager.
> - **Given** 6 bars are added in quick succession (e.g., bulk import), **When** processed, **Then** exactly 1 breakfast is created and the counter shows 1 remaining bar.

**US-4.2** As an admin, I want to manually create a breakfast (for birthdays, big events), so that special occasions are tracked alongside fault-based breakfasts.

> **Acceptance Criteria:**
> - **Given** an admin clicks "Add Breakfast", **When** they select a team member and provide a reason, **Then** a breakfast is created with status **Pending** and type "manual".
> - **Given** a manual breakfast is created, **When** viewing the breakfast list, **Then** it is distinguishable from auto-created breakfasts (tagged as "manual" or "event").

**US-4.3** As a team member who owes a breakfast, I want to propose a date, so that I can schedule it at a convenient time.

> **Acceptance Criteria:**
> - **Given** a member has a **Pending** breakfast, **When** they select a date (within 30 days from creation), **Then** the breakfast status changes to **Scheduled** and the date is recorded.
> - **Given** a member selects a date > 30 days from creation, **When** they submit, **Then** an error is displayed: "Breakfast must be scheduled within 30 days."

**US-4.4** As a lead, I want to propose a date for a member's breakfast, so that scheduling doesn't stall.

> **Acceptance Criteria:**
> - **Given** a lead proposes a date for a member's breakfast, **When** submitted, **Then** the breakfast remains **Pending** and the member receives a notification to validate.
> - **Given** the member validates the proposed date, **When** confirmed, **Then** the breakfast status moves to **Scheduled**.
> - **Given** the member rejects the proposed date, **When** declined, **Then** the lead is notified and the breakfast remains **Pending**.

**US-4.5** As an admin, I want to cancel, delete, or postpone a breakfast, so that exceptions can be handled.

> **Acceptance Criteria:**
> - **Given** an admin cancels a breakfast, **When** confirmed, **Then** the breakfast status is set to **Cancelled**, an audit log entry is created, and administrators are notified.
> - **Given** an admin deletes a breakfast, **When** confirmed, **Then** the breakfast is soft-deleted (hidden from views, preserved in DB), an audit log entry is created, and administrators are notified.
> - **Given** an admin postpones a breakfast, **When** a new date is selected (still within 30 days of original creation), **Then** the date is updated, an audit log entry is created, and relevant users are notified.

**US-4.6** As the system, I want to enforce one breakfast per team per day, so that scheduling stays manageable.

> **Acceptance Criteria:**
> - **Given** a breakfast is already scheduled for team "Backend" on March 15, **When** another member tries to schedule on March 15, **Then** the action is blocked with a message: "A breakfast is already scheduled for this team on this date."
> - **Given** an admin attempts to schedule a second breakfast on the same date, **When** they confirm, **Then** a warning is displayed but the action is allowed (admin override).

---

### Epic 5 — Shared Team Calendar

**US-5.1** As a team member, I want to view a calendar of my team's breakfasts, so that I know what's coming up.

> **Acceptance Criteria:**
> - **Given** a member opens the team calendar, **When** the page loads, **Then** a monthly calendar view shows all breakfasts (Pending, Scheduled, Completed) with color coding by status.
> - **Given** a member clicks on a breakfast event, **When** the detail panel opens, **Then** it shows: who owes it, reason/type, status, and scheduled date (if any).

**US-5.2** As a super-admin, I want to view calendars for all teams, so that I have full organizational visibility.

> **Acceptance Criteria:**
> - **Given** a super-admin opens the calendar view, **When** they select "All Teams", **Then** breakfasts from all teams are displayed, color-coded or grouped by team.

---

### Epic 6 — Notification System

**US-6.1** As a user, I want to receive in-app and email notifications for key events, so that I stay informed.

> **Acceptance Criteria:**
> - **Given** a bar is added to a member, **When** the bar is saved, **Then** an in-app notification is created for the member within 2 seconds and an email is sent within 60 seconds.
> - **Given** a breakfast is auto-created, **When** the event fires, **Then** both the owing member and their lead/manager receive in-app + email notifications.

**US-6.2** As a user, I want to configure my notification preferences, so that I only receive alerts I care about.

> **Acceptance Criteria:**
> - **Given** a user opens notification settings, **When** they toggle off "Bar Added — Email", **Then** they no longer receive emails when a bar is added but still receive in-app notifications (and vice versa).
> - **Given** a user disables all notifications for a category, **When** that event occurs, **Then** no notification of any type is sent for that category.

**US-6.3** As a lead/admin, I want to receive a weekly digest, so that I have a summary of team activity.

> **Acceptance Criteria:**
> - **Given** it is Monday at 9:00 AM (tenant timezone), **When** the digest job runs, **Then** leads and admins receive an email with: new bars this week, pending breakfasts count, upcoming scheduled breakfasts.

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement | Priority |
|---|---|---|
| FR-AUTH-01 | Self-registration with email/password (min 8 chars, 1 uppercase, 1 number) | P0 |
| FR-AUTH-02 | Magic link authentication with 15-minute TTL | P0 |
| FR-AUTH-03 | Email verification on registration | P0 |
| FR-AUTH-04 | Password reset flow via email | P0 |
| FR-AUTH-05 | Session management with JWT (Supabase default), 7-day refresh token | P0 |
| FR-AUTH-06 | Role-based access control: super-admin, admin, lead, member | P0 |
| FR-AUTH-07 | Invite link generation with 7-day expiry, scoped to team + role | P0 |
| FR-AUTH-08 | Social login (Google, GitHub) | P1 |

### 3.2 Core Features — Bar Tracking

| ID | Requirement | Priority |
|---|---|---|
| FR-BAR-01 | Create bar with fields: `assigned_to`, `assigned_by`, `reason` (optional, max 200 chars), `timestamp`, `team_id`, `tenant_id` | P0 |
| FR-BAR-02 | Role enforcement: super-admin/admin/lead can assign to any team member; member can only self-assign | P0 |
| FR-BAR-03 | Current bar counter per member per team (0-4 range, resets on breakfast creation) | P0 |
| FR-BAR-04 | Lifetime bar total preserved for historical stats | P0 |
| FR-BAR-05 | Bar history list with filters: by member, by date range, by team | P0 |
| FR-BAR-06 | Bar correction/removal request by lead, validated by admin | P1 |

### 3.3 Core Features — Breakfast Management

| ID | Requirement | Priority |
|---|---|---|
| FR-BRK-01 | Auto-create breakfast when member reaches 5 bars; consume bars, reset counter | P0 |
| FR-BRK-02 | Manual breakfast creation by admin/super-admin with reason field | P0 |
| FR-BRK-03 | Breakfast lifecycle: Pending → Scheduled → Completed | P0 |
| FR-BRK-04 | Additional statuses: Cancelled (admin only), Deleted (soft-delete, admin only) | P0 |
| FR-BRK-05 | Date proposal by owing member or lead; lead proposals require member validation | P0 |
| FR-BRK-06 | 30-day scheduling window enforced from breakfast creation date | P0 |
| FR-BRK-07 | One breakfast per team per day constraint; admin bypass with warning | P0 |
| FR-BRK-08 | Audit log for all cancel/delete/postpone actions with `actor`, `action`, `timestamp`, `reason` | P0 |
| FR-BRK-09 | Breakfast type field: `auto` or `manual` | P0 |

### 3.4 Core Features — Calendar

| ID | Requirement | Priority |
|---|---|---|
| FR-CAL-01 | Monthly calendar view per team showing all breakfast statuses | P0 |
| FR-CAL-02 | Color coding: Pending (yellow), Scheduled (blue), Completed (green), Cancelled (grey) | P0 |
| FR-CAL-03 | Click-to-detail on calendar events | P0 |
| FR-CAL-04 | Super-admin cross-team calendar view | P0 |

### 3.5 Core Features — Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-NOT-01 | In-app notifications for all events (bar added, breakfast created/scheduled/completed/cancelled/deleted) | P0 |
| FR-NOT-02 | Email notifications for all events via transactional email provider | P0 |
| FR-NOT-03 | Per-user, per-event-type, per-channel (email/in-app) toggle | P0 |
| FR-NOT-04 | Weekly digest email for leads and admins (Monday 9:00 AM tenant timezone) | P0 |
| FR-NOT-05 | In-app notification bell with unread count and mark-as-read | P0 |

### 3.6 Multi-Tenancy

| ID | Requirement | Priority |
|---|---|---|
| FR-TEN-01 | Tenant isolation via `tenant_id` column on all data tables + Supabase RLS | P0 |
| FR-TEN-02 | Super-admin tenant creation and user assignment | P0 |
| FR-TEN-03 | Tenant-level settings (timezone, name) | P0 |
| FR-TEN-04 | Tenant customization (branding, custom thresholds) | P1 |

### 3.7 Payments

No payment or billing system is required for v1. The application is free to use.

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target |
|---|---|
| Page load (First Contentful Paint) | < 1.5 seconds on 4G connection |
| Time to Interactive | < 3 seconds |
| API response time (p95) | < 500ms for read operations, < 1000ms for write operations |
| In-app notification delivery | < 2 seconds from trigger event |
| Email notification delivery | < 60 seconds from trigger event |
| Calendar render (1 year of data, 50 breakfasts) | < 1 second |
| Concurrent users supported | 100 simultaneous without degradation |

### 4.2 Security

| Requirement | Implementation |
|---|---|
| Data isolation | Supabase Row-Level Security (RLS) on every table, keyed by `tenant_id` |
| Authentication | Supabase Auth with JWT; HTTPS-only; secure cookie flags |
| Authorization | Middleware-level role checks on every API route; RLS as second layer |
| Input validation | Server-side validation on all inputs; parameterized queries (Supabase default) |
| Rate limiting | 100 requests/minute per user on write endpoints; 300/minute on read |
| Audit trail | Immutable `audit_log` table for all destructive/sensitive actions |
| Password policy | Min 8 chars, 1 uppercase, 1 number |
| CSRF protection | SameSite cookies + Supabase built-in CSRF handling |
| XSS prevention | React's default escaping + Content-Security-Policy headers |

### 4.3 Scalability

| Dimension | v1 Target | Design for |
|---|---|---|
| Users | 20 | 100 |
| Tenants | 1 | 10 |
| Teams per tenant | 1-3 | 50 |
| Bars per month (system-wide) | ~100 | 5,000 |
| Breakfasts per month (system-wide) | ~20 | 1,000 |
| Database size (1 year) | < 100 MB | < 1 GB |

### 4.4 Reliability & Availability

| Metric | Target |
|---|---|
| Uptime | 99.5% (Vercel + Supabase SLA baseline) |
| Data backup | Supabase daily automated backups |
| Error rate | < 1% of API requests |

### 4.5 Accessibility

| Requirement | Standard |
|---|---|
| WCAG compliance | Level AA (2.1) for all user-facing pages |
| Keyboard navigation | Full support for all interactive elements |
| Screen reader support | Semantic HTML + ARIA labels on custom components |

---

## 5. Technical Constraints

### 5.1 Stack (Locked)

| Component | Technology | Constraint |
|---|---|---|
| Frontend framework | Next.js (App Router) | Latest stable (v14+) |
| Database + Auth + Realtime | Supabase (PostgreSQL) | Free tier initially; Pro tier if > 500 MB or > 50k MAUs |
| Hosting | Vercel | Hobby or Pro plan |
| Email delivery | Resend (or equivalent) | Free tier: 100 emails/day; upgrade if needed |
| Language | TypeScript | Strict mode enabled |

### 5.2 External API Limits

| Service | Free Tier Limit | Mitigation |
|---|---|---|
| Supabase Auth | 50,000 MAUs | Sufficient for v1 target of 100 users |
| Supabase Database | 500 MB, 2 GB bandwidth | Monitor via dashboard; upgrade trigger at 80% |
| Supabase Edge Functions | 500,000 invocations/month | Batch notifications where possible |
| Resend emails | 100/day (free), 50,000/month (pro) | Queue emails; batch weekly digests; upgrade if daily limit hit |
| Vercel | 100 GB bandwidth, 1000 build minutes (hobby) | Sufficient for v1; monitor analytics |

### 5.3 Constraints & Assumptions

- No native mobile apps — web-only, but responsive design for mobile browsers.
- No offline support — requires active internet connection.
- No file uploads — all data is text-based (reasons, labels).
- Timezone handling: stored in UTC, displayed in tenant-configured timezone.
- All soft-deletes — no hard-delete on any user-facing data.

---

## 6. Out of Scope (v1)

| Exclusion | Rationale |
|---|---|
| Native mobile apps (iOS / Android) | Avoid App Store deployment complexity; web covers initial needs |
| Third-party integrations (Slack, Teams, Google Calendar) | Not needed for initial adoption; planned for P2 |
| Public API | No external consumers identified yet |
| Payment / billing system | Free internal tool; no monetization in v1 |
| Advanced analytics / reporting exports | Basic stats sufficient for MVP; dashboards planned for P1 |
| Social login (Google, GitHub) | Supabase email auth covers MVP; social login planned for P1 |
| Gamification (badges, streaks, rankings) | Nice-to-have; planned for P2 |
| Bar correction workflow | Lead-initiated removal with admin approval; planned for P1 |
| Tenant branding customization | Planned for P1 |
| i18n / localization | English only for v1 |

---

## 7. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Supabase free tier limits exceeded** (DB size, edge function invocations) | Medium | High — app downtime | Monitor usage weekly; set alerts at 80% threshold; budget for Pro tier upgrade ($25/mo) |
| R2 | **Email delivery rate drops** (spam filters, Resend limits) | Medium | Medium — missed notifications | Use verified domain + SPF/DKIM; implement retry logic (3 attempts, exponential backoff); fallback to in-app only if email fails |
| R3 | **RLS misconfiguration leaks tenant data** | Low | Critical — data breach | Automated RLS tests in CI; manual security review before launch; Supabase RLS linter |
| R4 | **Race condition on bar counter** (5th bar added simultaneously by two users) | Low | Medium — duplicate breakfast created | Use database transaction with `SELECT ... FOR UPDATE` on member bar count; idempotency check before breakfast creation |
| R5 | **Low adoption / engagement** | Medium | High — product failure | Onboard with demo data; keep UX minimal (< 3 clicks to add a bar); weekly digest keeps awareness |
| R6 | **Invite link abuse** (shared publicly, used by unauthorized users) | Low | Medium — unauthorized access | 7-day expiry; single-use toggle option; admin can revoke links; link usage audit log |
| R7 | **Vercel cold starts on serverless functions** | Medium | Low — slow first request | Use Edge Runtime where possible; keep critical paths lightweight; monitor p99 latency |
| R8 | **Scope creep during development** | High | Medium — delayed delivery | Strict adherence to P0 features only; all P1/P2 items tracked separately; weekly scope check |
