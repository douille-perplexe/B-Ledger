"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarCounter } from "@/components/bar-counter";
import { BreakfastCard } from "@/components/breakfast-card";
import { AddBarDialog } from "@/components/add-bar-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Bar, Breakfast, Team, TeamMember, UserRole, TeamRole } from "@/types/database";
import { format } from "date-fns";

interface TeamContentProps {
  team: Team;
  members: TeamMember[];
  recentBars: Bar[];
  breakfasts: Breakfast[];
  currentUserId: string;
  myRole: TeamRole;
  globalRole: UserRole;
}

export function TeamContent({
  team,
  members,
  recentBars,
  breakfasts,
  currentUserId,
  myRole,
  globalRole,
}: TeamContentProps) {
  const router = useRouter();
  const canAssignOthers =
    globalRole === "super_admin" || myRole === "admin" || myRole === "lead";

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <p className="text-muted-foreground">
            {members.length} members
          </p>
        </div>
        <AddBarDialog
          teamId={team.id}
          members={members}
          currentUserId={currentUserId}
          canAssignOthers={canAssignOthers}
          onBarAdded={refresh}
        />
      </div>

      {/* Member roster with bar counts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Current Bars</TableHead>
                <TableHead className="text-right">Lifetime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.profile?.full_name || "Unknown"}
                    {m.user_id === currentUserId && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (you)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <BarCounter count={m.current_bar_count} size="sm" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.lifetime_bar_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Breakfasts */}
      {breakfasts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Breakfasts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {breakfasts.map((breakfast) => (
              <BreakfastCard key={breakfast.id} breakfast={breakfast} />
            ))}
          </div>
        </div>
      )}

      {/* Recent bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Bars</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bars yet.</p>
          ) : (
            <div className="space-y-2">
              {recentBars.map((bar) => (
                <div
                  key={bar.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <span className="text-sm font-medium">
                      {bar.assigned_to_profile?.full_name}
                    </span>
                    {bar.reason && (
                      <span className="text-sm text-muted-foreground ml-2">
                        — {bar.reason}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    by {bar.assigned_by_profile?.full_name} &middot;{" "}
                    {format(new Date(bar.created_at), "MMM d, HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
