import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {SidebarWrapper} from "@/app/(dashboard)/sidebar-wrapper";

export default async function AdminLayout({
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

  if (
    !profile ||
    (profile.global_role !== "super_admin" && profile.global_role !== "admin")
  ) {
    redirect("/dashboard");
  }

  return <>
    <SidebarWrapper profile={profile} />
    {children}
  </>;
}
