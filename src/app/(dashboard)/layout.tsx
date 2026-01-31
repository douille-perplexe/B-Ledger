import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarWrapper } from "./sidebar-wrapper";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if (!profile?.tenant_id) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarWrapper profile={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
