import { getAuthContext, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team_id");
  const month = searchParams.get("month"); // 1-12
  const year = searchParams.get("year");

  const supabase = await createClient();

  let query = supabase
    .from("breakfasts")
    .select("*, owed_by_profile:profiles!breakfasts_owed_by_fkey(id, full_name, avatar_url), team:teams(id, name)")
    .eq("is_deleted", false)
    .neq("status", "cancelled");

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  if (month && year) {
    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    query = query
      .or(`scheduled_date.gte.${startDate},created_at.gte.${startDate}`)
      .or(`scheduled_date.lt.${endDate},created_at.lt.${endDate}`);
  }

  const { data, error } = await query.order("scheduled_date", { ascending: true, nullsFirst: false });

  if (error) return jsonError("Failed to fetch calendar data", 500);
  return jsonSuccess(data);
}
