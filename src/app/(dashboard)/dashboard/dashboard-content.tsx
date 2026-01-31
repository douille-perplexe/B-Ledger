"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarCounter } from "@/components/bar-counter";
import { BreakfastCard } from "@/components/breakfast-card";
import { Coffee, TrendingUp, Users } from "lucide-react";
import type { Breakfast, Profile, TeamMember } from "@/types/database";

interface DashboardContentProps {
  profile: Profile;
  teamMemberships: (TeamMember & { team: { id: string; name: string } })[];
  pendingBreakfasts: Breakfast[];
}

export function DashboardContent({
  profile,
  teamMemberships,
  pendingBreakfasts,
}: DashboardContentProps) {
  const myBreakfasts = pendingBreakfasts.filter(
    (b) => b.owed_by === profile.id
  );
  const totalBars = teamMemberships.reduce(
    (sum, m) => sum + m.current_bar_count,
    0
  );
  const totalLifetime = teamMemberships.reduce(
    (sum, m) => sum + m.lifetime_bar_count,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome, {profile.full_name}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your breakfast ledger overview.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMemberships.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Bars</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBars}</div>
            <p className="text-xs text-muted-foreground">
              {totalLifetime} lifetime total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Breakfasts
            </CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myBreakfasts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Teams with bar counters */}
      <div>
        <h2 className="text-lg font-semibold mb-3">My Teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMemberships.map((membership) => (
            <Link
              key={membership.team.id}
              href={`/dashboard/team/${membership.team.id}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {membership.team.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <BarCounter count={membership.current_bar_count} />
                    <span className="text-xs text-muted-foreground">
                      {membership.role}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {teamMemberships.length === 0 && (
            <p className="text-muted-foreground col-span-2">
              You&apos;re not part of any team yet. Ask an admin to invite you.
            </p>
          )}
        </div>
      </div>

      {/* Pending breakfasts */}
      {pendingBreakfasts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming Breakfasts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingBreakfasts.map((breakfast) => (
              <BreakfastCard key={breakfast.id} breakfast={breakfast} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
