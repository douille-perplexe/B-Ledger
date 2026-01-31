"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BreakfastCard } from "@/components/breakfast-card";
import type { Breakfast, UserRole } from "@/types/database";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface BreakfastsContentProps {
  breakfasts: Breakfast[];
  currentUserId: string;
  globalRole: UserRole;
}

export function BreakfastsContent({
  breakfasts,
  currentUserId,
  globalRole,
}: BreakfastsContentProps) {
  const router = useRouter();
  const [selectedBreakfast, setSelectedBreakfast] = useState<Breakfast | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = globalRole === "super_admin" || globalRole === "admin";

  const pending = breakfasts.filter((b) => b.status === "pending");
  const scheduled = breakfasts.filter((b) => b.status === "scheduled");
  const completed = breakfasts.filter((b) => b.status === "completed");

  async function handleAction(action: string, extraBody?: Record<string, string>) {
    if (!selectedBreakfast) return;
    setLoading(true);

    const res = await fetch(`/api/breakfasts/${selectedBreakfast.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extraBody }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Action failed");
      setLoading(false);
      return;
    }

    toast.success(`Breakfast ${action}d successfully`);
    setSelectedBreakfast(null);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Breakfasts</h1>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled ({scheduled.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        {["pending", "scheduled", "completed"].map((status) => {
          const items =
            status === "pending"
              ? pending
              : status === "scheduled"
                ? scheduled
                : completed;
          return (
            <TabsContent key={status} value={status}>
              {items.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No {status} breakfasts.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((b) => (
                    <BreakfastCard
                      key={b.id}
                      breakfast={b}
                      onClick={() => setSelectedBreakfast(b)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Breakfast detail dialog */}
      <Dialog
        open={!!selectedBreakfast}
        onOpenChange={() => setSelectedBreakfast(null)}
      >
        <DialogContent>
          {selectedBreakfast && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Breakfast — {selectedBreakfast.owed_by_profile?.full_name}
                </DialogTitle>
                <DialogDescription>
                  {selectedBreakfast.team?.name} &middot;{" "}
                  {selectedBreakfast.type === "auto" ? "Fault-based" : "Manual"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant="outline">{selectedBreakfast.status}</Badge>
                </div>
                {selectedBreakfast.reason && (
                  <p className="text-sm">
                    <span className="font-medium">Reason:</span>{" "}
                    {selectedBreakfast.reason}
                  </p>
                )}
                {selectedBreakfast.scheduled_date && (
                  <p className="text-sm">
                    <span className="font-medium">Scheduled:</span>{" "}
                    {format(new Date(selectedBreakfast.scheduled_date), "MMMM d, yyyy")}
                  </p>
                )}
                {selectedBreakfast.proposed_date && (
                  <p className="text-sm">
                    <span className="font-medium">Proposed date:</span>{" "}
                    {format(new Date(selectedBreakfast.proposed_date), "MMMM d, yyyy")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Created{" "}
                  {format(new Date(selectedBreakfast.created_at), "MMMM d, yyyy")}
                </p>

                {/* Schedule form for pending breakfasts */}
                {selectedBreakfast.status === "pending" &&
                  (selectedBreakfast.owed_by === currentUserId || isAdmin) && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label>Pick a date</Label>
                      <Input
                        type="date"
                        value={dateInput}
                        min={format(new Date(), "yyyy-MM-dd")}
                        max={format(
                          addDays(new Date(selectedBreakfast.created_at), 30),
                          "yyyy-MM-dd"
                        )}
                        onChange={(e) => setDateInput(e.target.value)}
                      />
                    </div>
                  )}

                {/* Validate/Reject proposed date */}
                {selectedBreakfast.status === "pending" &&
                  selectedBreakfast.proposed_date &&
                  selectedBreakfast.owed_by === currentUserId && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        onClick={() => handleAction("validate")}
                        disabled={loading}
                      >
                        Accept proposed date
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction("reject")}
                        disabled={loading}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {selectedBreakfast.status === "pending" &&
                  dateInput &&
                  (selectedBreakfast.owed_by === currentUserId || isAdmin) && (
                    <Button
                      onClick={() =>
                        handleAction("schedule", { scheduled_date: dateInput })
                      }
                      disabled={loading}
                    >
                      {loading ? "Scheduling..." : "Schedule"}
                    </Button>
                  )}
                {selectedBreakfast.status === "scheduled" && isAdmin && (
                  <Button
                    onClick={() => handleAction("complete")}
                    disabled={loading}
                  >
                    Mark as completed
                  </Button>
                )}
                {isAdmin &&
                  selectedBreakfast.status !== "completed" &&
                  selectedBreakfast.status !== "cancelled" && (
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("cancel")}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
