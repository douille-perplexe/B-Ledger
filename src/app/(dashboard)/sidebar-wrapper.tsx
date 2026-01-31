"use client";

import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import type { Profile } from "@/types/database";

export function SidebarWrapper({ profile }: { profile: Profile }) {
  return (
    <>
      <Sidebar profile={profile} />
      <div className="absolute top-3 right-4 z-10">
        <NotificationBell />
      </div>
    </>
  );
}
