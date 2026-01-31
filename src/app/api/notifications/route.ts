import { getAuthContext, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return jsonError("Failed to fetch notifications", 500);
  return jsonSuccess(data);
}
