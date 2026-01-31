import { getAuthContext, jsonError, jsonSuccess } from "@/lib/api/helpers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*");

  if (error) return jsonError("Failed to fetch preferences", 500);
  return jsonSuccess(data);
}

export async function PUT(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { preferences } = body as {
    preferences: Array<{
      event_type: string;
      email: boolean;
      in_app: boolean;
    }>;
  };

  if (!Array.isArray(preferences)) {
    return jsonError("Invalid input", 400);
  }

  const supabase = await createClient();

  for (const pref of preferences) {
    await supabase.from("notification_preferences").upsert(
      {
        user_id: ctx.user_id,
        event_type: pref.event_type,
        email: pref.email,
        in_app: pref.in_app,
      },
      { onConflict: "user_id,event_type" }
    );
  }

  return jsonSuccess({ success: true });
}
