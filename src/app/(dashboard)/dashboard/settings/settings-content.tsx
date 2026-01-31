"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { NotificationPreference, NotificationType, Profile } from "@/types/database";
import { toast } from "sonner";

const EVENT_TYPES: { value: NotificationType; label: string }[] = [
  { value: "bar_added", label: "Bar added" },
  { value: "breakfast_created", label: "Breakfast created" },
  { value: "breakfast_scheduled", label: "Breakfast scheduled" },
  { value: "breakfast_completed", label: "Breakfast completed" },
  { value: "breakfast_cancelled", label: "Breakfast cancelled" },
  { value: "date_proposed", label: "Date proposed" },
  { value: "date_validated", label: "Date validated" },
  { value: "date_rejected", label: "Date rejected" },
];

interface SettingsContentProps {
  profile: Profile;
  preferences: NotificationPreference[];
}

export function SettingsContent({
  profile,
  preferences,
}: SettingsContentProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; in_app: boolean }>>(() => {
    const map: Record<string, { email: boolean; in_app: boolean }> = {};
    EVENT_TYPES.forEach((et) => {
      const existing = preferences.find((p) => p.event_type === et.value);
      map[et.value] = {
        email: existing?.email ?? true,
        in_app: existing?.in_app ?? true,
      };
    });
    return map;
  });

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleSaveNotifications() {
    setSaving(true);
    const prefArray = Object.entries(prefs).map(([event_type, p]) => ({
      event_type,
      email: p.email,
      in_app: p.in_app,
    }));

    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: prefArray }),
    });

    if (res.ok) {
      toast.success("Notification preferences saved");
    } else {
      toast.error("Failed to save preferences");
    }
    setSaving(false);
  }

  function togglePref(eventType: string, channel: "email" | "in_app") {
    setPrefs((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [channel]: !prev[eventType][channel],
      },
    }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.global_role} disabled />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
              <span>Event</span>
              <span className="text-center">Email</span>
              <span className="text-center">In-app</span>
            </div>
            {EVENT_TYPES.map((et) => (
              <div
                key={et.value}
                className="grid grid-cols-3 gap-4 items-center"
              >
                <span className="text-sm">{et.label}</span>
                <div className="text-center">
                  <input
                    type="checkbox"
                    checked={prefs[et.value]?.email ?? true}
                    onChange={() => togglePref(et.value, "email")}
                    className="h-4 w-4"
                  />
                </div>
                <div className="text-center">
                  <input
                    type="checkbox"
                    checked={prefs[et.value]?.in_app ?? true}
                    onChange={() => togglePref(et.value, "in_app")}
                    className="h-4 w-4"
                  />
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <Button onClick={handleSaveNotifications} disabled={saving}>
            {saving ? "Saving..." : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
