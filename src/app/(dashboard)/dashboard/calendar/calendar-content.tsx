"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import type { Breakfast } from "@/types/database";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  getDay,
  addMonths,
  subMonths,
} from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-400",
  scheduled: "bg-blue-400",
  completed: "bg-green-400",
};

interface CalendarContentProps {
  teams: { id: string; name: string }[];
  isSuperAdmin: boolean;
}

export function CalendarContent({
  teams,
  isSuperAdmin,
}: CalendarContentProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [breakfasts, setBreakfasts] = useState<Breakfast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBreakfasts();
  }, [currentMonth, selectedTeam]);

  async function fetchBreakfasts() {
    setLoading(true);
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    const teamParam = selectedTeam !== "all" ? `&team_id=${selectedTeam}` : "";
    const res = await fetch(
      `/api/calendar?month=${month}&year=${year}${teamParam}`
    );
    if (res.ok) {
      const data = await res.json();
      setBreakfasts(data);
    }
    setLoading(false);
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  function getBreakfastsForDay(day: Date) {
    return breakfasts.filter((b) => {
      if (b.scheduled_date) {
        return isSameDay(new Date(b.scheduled_date), day);
      }
      return false;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by team" />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdmin && (
              <SelectItem value="all">All Teams</SelectItem>
            )}
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {d}
              </div>
            ))}
            {/* Empty cells for start offset */}
            {Array.from({ length: startDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-20 bg-muted/20 rounded" />
            ))}
            {days.map((day) => {
              const dayBreakfasts = getBreakfastsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-20 p-1 border rounded ${
                    isToday ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span
                    className={`text-xs ${
                      isToday ? "font-bold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayBreakfasts.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs ${
                          statusColors[b.status] || "bg-gray-200"
                        } text-white`}
                        title={`${b.owed_by_profile?.full_name} — ${b.status}`}
                      >
                        <Coffee className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {b.owed_by_profile?.full_name?.split(" ")[0] || "?"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-yellow-400" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-400" />
              <span className="text-xs text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-green-400" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
