import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreakfastsContent } from "./breakfasts-content";

export default async function BreakfastsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: breakfasts } = await supabase
    .from("breakfasts")
    .select("*, owed_by_profile:profiles!breakfasts_owed_by_fkey(id, full_name, avatar_url), team:teams(id, name)")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <BreakfastsContent
      breakfasts={breakfasts || []}
      currentUserId={user.id}
      globalRole={profile?.global_role || "member"}
    />
  );
}
