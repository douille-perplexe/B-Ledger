# B-Ledger — Product Brief

## Executive Summary

B-Ledger is a multi-tenant web application that tracks team mistakes ("bars") and converts them into breakfast obligations (5 bars = 1 breakfast). It provides a shared calendar, automated notifications, and historical stats to keep teams accountable in a lighthearted way.

---

## Problem Statement

Teams lack a simple, transparent way to track recurring accountability events tied to mistakes. Today this is managed informally (spreadsheets, memory, chat messages), leading to:

- **Lost tracking**: bars and owed breakfasts are forgotten or disputed.
- **No history**: impossible to see trends over time or per person.
- **No scheduling**: breakfast dates are agreed verbally and often slip.
- **No visibility**: team members don't know who owes what and when.

**Success metrics (MVP):**

| Metric | Target |
|---|---|
| Active users | 20 initial, scalable to 100+ |
| Bar logging accuracy | 100% — every bar is recorded with author and timestamp |
| Breakfast scheduling compliance | 90% of breakfasts scheduled within 30 days |
| Notification delivery rate | 99% (email + in-app) |

---

## Target Users

### Persona 1 — Super-Admin (Org Owner)

- Creates and manages the tenant (organization).
- Manages all teams, users, and roles across the organization.
- Full access to all teams' calendars, stats, and history.
- Can override any rule (e.g., bypass one-breakfast-per-day constraint).
- Typically the person who set up B-Ledger for the company.

### Persona 2 — Admin (Team Manager)

- Manages settings and members within their own team.
- Can add bars to any team member.
- Can cancel, delete, or reschedule breakfasts (with audit trail).
- Can bypass one-breakfast-per-day constraint with a warning.
- Receives weekly summary notifications.

### Persona 3 — Lead/Manager

- Can add bars to any member in their team.
- Can propose a date for a breakfast owed by a team member.
- Cannot manage team settings or delete breakfasts.
- Receives weekly summary notifications.
- May also correct/remove bars added by mistake (admin-validated).

### Persona 4 — Team Member

- Can add bars to themselves only (self-reporting).
- Can propose a date for their own owed breakfast.
- Validates dates proposed by their lead for their own breakfasts.
- Views team calendar and personal stats/history.
- Configurable notification preferences.

---

## Value Proposition

B-Ledger turns informal team accountability into a trackable, transparent, and fun system — one bar at a time.

---

## Core Features (MVP — Prioritized)

### P0 — Must Have

1. **Authentication & multi-tenancy**
   - Self-registration via Supabase Auth (email/password, magic link).
   - Super-admin creates tenant (organization) and assigns users.
   - Invite link system: admins/super-admins generate a link to add a member to a specific team.
   - Role-based access control: super-admin, admin, lead/manager, team member.

2. **Team management**
   - Super-admin can create, edit, and archive teams.
   - Admins manage members and roles within their team.
   - Each team has its own independent bar/breakfast tracking.

3. **Bar (fault) tracking**
   - Add a bar to a team member (by authorized roles) or to oneself.
   - Each bar records: who it was assigned to, who assigned it, timestamp, optional reason/label.
   - Running counter per team member (current bars toward next breakfast).
   - Historical total preserved for stats even after bars are consumed.

4. **Automatic breakfast creation**
   - When a team member reaches 5 bars, a breakfast is automatically created with status **Pending**.
   - The 5 current bars are consumed (counter resets to 0).
   - Notifications sent to the user and their lead/manager (email + in-app).

5. **Manual breakfast creation**
   - Admins and super-admins can add a breakfast directly (birthday, anniversary, major mistake).
   - Same lifecycle and rules apply.

6. **Breakfast lifecycle**
   - Statuses: **Pending** → **Scheduled** → **Completed**.
   - Date assignment: the person who owes the breakfast or their lead can propose a date.
   - If the lead proposes, the owing member must validate.
   - Breakfast must be scheduled within 30 days.
   - One breakfast per team per day (admins can bypass with a warning).
   - Cancel, delete, or postpone: admin/super-admin only, with mandatory audit log and notification to administrators.

7. **Shared team calendar**
   - Calendar view showing upcoming and past breakfasts per team.
   - Super-admins see all teams' calendars.
   - Members see their own team's calendar.

8. **Notification system**
   - In-app and email notifications for all key events:
     - Bar added
     - Breakfast created (auto or manual)
     - Date proposed / date validated
     - Breakfast completed
     - Breakfast cancelled / deleted / postponed
   - Users can enable/disable each notification type individually.
   - Weekly digest for leads and admins (pending breakfasts, team bar summary).

### P1 — Should Have (Post-MVP)

- **Dashboard & stats**: personal and team-level stats (total bars, breakfasts over time, leaderboard).
- **Bar correction**: leads can request bar removal, validated by admin.
- **Tenant customization**: branding, custom breakfast thresholds, personalized settings per org.
- **Social login**: Google, GitHub via Supabase Auth.

### P2 — Nice to Have (Future)

- **Integrations**: Slack, Teams, Google Calendar sync.
- **Mobile-responsive PWA** for on-the-go access.
- **Gamification**: badges, streaks, team rankings.

---

## Technical Overview

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) |
| Backend / API | Next.js API Routes + Supabase |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, magic link) |
| Hosting | Vercel |
| Notifications | Supabase Edge Functions + email provider (Resend or similar) |
| Multi-tenancy | Row-level security (RLS) in Supabase, tenant ID on all tables |

**Scale target**: 100 users, multiple teams, multiple tenants.

---

## Out of Scope (MVP)

- Native mobile apps (iOS/Android).
- Third-party integrations (Slack, Teams, calendar sync).
- Public API.
- Payment / billing system.
- Advanced analytics or reporting exports.
