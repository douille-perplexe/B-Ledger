"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Breakfast } from "@/types/database";
import { format } from "date-fns";
import { Coffee } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

interface BreakfastCardProps {
  breakfast: Breakfast;
  onClick?: () => void;
}

export function BreakfastCard({ breakfast, onClick }: BreakfastCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? "" : "cursor-default"}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              {breakfast.owed_by_profile?.full_name || "Unknown"}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={statusColors[breakfast.status] || ""}
          >
            {breakfast.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Type:{" "}
            <span className="font-medium">
              {breakfast.type === "auto" ? "Fault-based" : "Manual"}
            </span>
          </p>
          {breakfast.reason && <p>Reason: {breakfast.reason}</p>}
          {breakfast.scheduled_date && (
            <p>
              Date:{" "}
              <span className="font-medium">
                {format(new Date(breakfast.scheduled_date), "MMM d, yyyy")}
              </span>
            </p>
          )}
          {breakfast.proposed_date && !breakfast.scheduled_date && (
            <p>
              Proposed:{" "}
              <span className="font-medium text-orange-600">
                {format(new Date(breakfast.proposed_date), "MMM d, yyyy")}
              </span>
            </p>
          )}
          <p className="text-xs">
            Created {format(new Date(breakfast.created_at), "MMM d, yyyy")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
