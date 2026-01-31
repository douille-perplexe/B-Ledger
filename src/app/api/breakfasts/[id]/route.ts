import {
  getAuthContext,
  getTeamRole,
  jsonError,
  jsonSuccess,
  createAuditLog,
  createNotification,
} from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";
import { scheduleBreakfastSchema, proposeBreakfastDateSchema } from "@/lib/validations/breakfast";
import { differenceInDays, parseISO } from "date-fns";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breakfasts")
    .select("*, owed_by_profile:profiles!breakfasts_owed_by_fkey(*), team:teams(*)")
    .eq("id", id)
    .single();

  if (error || !data) return jsonError("Breakfast not found", 404);
  return jsonSuccess(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();

  // Fetch the breakfast
  const { data: breakfast, error: fetchError } = await supabase
    .from("breakfasts")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !breakfast) return jsonError("Breakfast not found", 404);

  const body = await request.json();
  const { action } = body;

  const teamRole = await getTeamRole(ctx.user_id, breakfast.team_id);
  const isOwed = breakfast.owed_by === ctx.user_id;
  const isAdmin = ctx.global_role === "super_admin" || teamRole === "admin";
  const isLead = teamRole === "lead";

  // Handle different actions
  switch (action) {
    case "schedule": {
      // The person who owes can schedule directly
      if (!isOwed && !isAdmin) return jsonError("Forbidden", 403);
      if (breakfast.status !== "pending") {
        return jsonError("Breakfast must be pending to schedule", 400);
      }

      const parsed = scheduleBreakfastSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid date", 400);

      // Validate 30-day window
      const daysDiff = differenceInDays(
        parseISO(parsed.data.scheduled_date),
        new Date(breakfast.created_at)
      );
      if (daysDiff > 30) {
        return jsonError("Breakfast must be scheduled within 30 days", 400);
      }
      if (daysDiff < 0) {
        return jsonError("Cannot schedule in the past", 400);
      }

      // Check one-per-team-per-day
      const { data: existing } = await supabase
        .from("breakfasts")
        .select("id")
        .eq("team_id", breakfast.team_id)
        .eq("scheduled_date", parsed.data.scheduled_date)
        .eq("is_deleted", false)
        .neq("status", "cancelled")
        .neq("id", id);

      if (existing && existing.length > 0 && !isAdmin) {
        return jsonError("A breakfast is already scheduled for this team on this date", 409);
      }

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({
          scheduled_date: parsed.data.scheduled_date,
          status: "scheduled",
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to schedule", 500);

      await createAuditLog({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.user_id,
        action: "breakfast_scheduled",
        entity_type: "breakfast",
        entity_id: id,
        new_values: { scheduled_date: parsed.data.scheduled_date, status: "scheduled" },
      });

      await createNotification({
        tenant_id: ctx.tenant_id,
        user_id: breakfast.owed_by,
        type: "breakfast_scheduled",
        title: "Breakfast scheduled",
        body: `Your breakfast has been scheduled for ${parsed.data.scheduled_date}.`,
        ref_type: "breakfast",
        ref_id: id,
      });

      return jsonSuccess(updated);
    }

    case "propose": {
      // Lead can propose a date
      if (!isLead && !isAdmin) return jsonError("Forbidden", 403);
      if (breakfast.status !== "pending") {
        return jsonError("Breakfast must be pending to propose", 400);
      }

      const parsed = proposeBreakfastDateSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid date", 400);

      const daysDiff = differenceInDays(
        parseISO(parsed.data.proposed_date),
        new Date(breakfast.created_at)
      );
      if (daysDiff > 30 || daysDiff < 0) {
        return jsonError("Proposed date must be within 30 days of creation", 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({
          proposed_date: parsed.data.proposed_date,
          proposed_by: ctx.user_id,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to propose date", 500);

      await createNotification({
        tenant_id: ctx.tenant_id,
        user_id: breakfast.owed_by,
        type: "date_proposed",
        title: "Date proposed for your breakfast",
        body: `A date has been proposed: ${parsed.data.proposed_date}. Please validate or decline.`,
        ref_type: "breakfast",
        ref_id: id,
      });

      return jsonSuccess(updated);
    }

    case "validate": {
      // Only the person who owes can validate a proposed date
      if (!isOwed) return jsonError("Only the person who owes can validate", 403);
      if (!breakfast.proposed_date) return jsonError("No date to validate", 400);

      // Check one-per-team-per-day
      const { data: existing } = await supabase
        .from("breakfasts")
        .select("id")
        .eq("team_id", breakfast.team_id)
        .eq("scheduled_date", breakfast.proposed_date)
        .eq("is_deleted", false)
        .neq("status", "cancelled")
        .neq("id", id);

      if (existing && existing.length > 0) {
        return jsonError("A breakfast is already scheduled for this team on this date", 409);
      }

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({
          scheduled_date: breakfast.proposed_date,
          status: "scheduled",
          proposed_date: null,
          proposed_by: null,
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to validate", 500);

      if (breakfast.proposed_by) {
        await createNotification({
          tenant_id: ctx.tenant_id,
          user_id: breakfast.proposed_by,
          type: "date_validated",
          title: "Your proposed date was accepted",
          body: `The breakfast has been scheduled for ${breakfast.proposed_date}.`,
          ref_type: "breakfast",
          ref_id: id,
        });
      }

      return jsonSuccess(updated);
    }

    case "reject": {
      if (!isOwed) return jsonError("Only the person who owes can reject", 403);
      if (!breakfast.proposed_date) return jsonError("No date to reject", 400);

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({ proposed_date: null, proposed_by: null })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to reject", 500);

      if (breakfast.proposed_by) {
        await createNotification({
          tenant_id: ctx.tenant_id,
          user_id: breakfast.proposed_by,
          type: "date_rejected",
          title: "Your proposed date was declined",
          body: "The member declined your proposed date. Please propose another.",
          ref_type: "breakfast",
          ref_id: id,
        });
      }

      return jsonSuccess(updated);
    }

    case "complete": {
      if (!isAdmin) return jsonError("Only admins can mark as completed", 403);
      if (breakfast.status !== "scheduled") {
        return jsonError("Breakfast must be scheduled to complete", 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to complete", 500);

      await createAuditLog({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.user_id,
        action: "breakfast_completed",
        entity_type: "breakfast",
        entity_id: id,
        new_values: { status: "completed" },
      });

      await createNotification({
        tenant_id: ctx.tenant_id,
        user_id: breakfast.owed_by,
        type: "breakfast_completed",
        title: "Breakfast completed!",
        body: "Your breakfast has been marked as completed.",
        ref_type: "breakfast",
        ref_id: id,
      });

      return jsonSuccess(updated);
    }

    case "cancel": {
      if (!isAdmin) return jsonError("Only admins can cancel", 403);

      const { data: updated, error: updateError } = await supabase
        .from("breakfasts")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select()
        .single();

      if (updateError) return jsonError("Failed to cancel", 500);

      await createAuditLog({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.user_id,
        action: "breakfast_cancelled",
        entity_type: "breakfast",
        entity_id: id,
        old_values: { status: breakfast.status },
        new_values: { status: "cancelled" },
      });

      await createNotification({
        tenant_id: ctx.tenant_id,
        user_id: breakfast.owed_by,
        type: "breakfast_cancelled",
        title: "Breakfast cancelled",
        body: "Your breakfast has been cancelled by an admin.",
        ref_type: "breakfast",
        ref_id: id,
      });

      return jsonSuccess(updated);
    }

    default:
      return jsonError("Unknown action", 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();
  const { data: breakfast } = await supabase
    .from("breakfasts")
    .select("*")
    .eq("id", id)
    .single();

  if (!breakfast) return jsonError("Breakfast not found", 404);

  const teamRole = await getTeamRole(ctx.user_id, breakfast.team_id);
  const isAdmin = ctx.global_role === "super_admin" || teamRole === "admin";
  if (!isAdmin) return jsonError("Only admins can delete", 403);

  // Soft delete
  const { error } = await supabase
    .from("breakfasts")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) return jsonError("Failed to delete", 500);

  await createAuditLog({
    tenant_id: ctx.tenant_id,
    actor_id: ctx.user_id,
    action: "breakfast_deleted",
    entity_type: "breakfast",
    entity_id: id,
    old_values: { status: breakfast.status },
    new_values: { is_deleted: true },
  });

  return jsonSuccess({ success: true });
}
