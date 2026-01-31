"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { TeamMember } from "@/types/database";
import { toast } from "sonner";

interface AddBarDialogProps {
  teamId: string;
  members: TeamMember[];
  currentUserId: string;
  canAssignOthers: boolean;
  onBarAdded?: () => void;
}

export function AddBarDialog({
  teamId,
  members,
  currentUserId,
  canAssignOthers,
  onBarAdded,
}: AddBarDialogProps) {
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(
    canAssignOthers ? "" : currentUserId
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/bars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        assigned_to: assignedTo,
        reason: reason || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to add bar");
      setLoading(false);
      return;
    }

    const result = await res.json();
    if (result.breakfast_id) {
      toast.success("Bar added! A breakfast has been created.");
    } else {
      toast.success(`Bar added! (${result.new_count}/5)`);
    }

    setOpen(false);
    setReason("");
    setAssignedTo(canAssignOthers ? "" : currentUserId);
    setLoading(false);
    onBarAdded?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Bar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a Bar</DialogTitle>
            <DialogDescription>
              Record a mistake. 5 bars = 1 breakfast.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {canAssignOthers ? (
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name || m.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Adding a bar to yourself.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="What happened?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !assignedTo}>
              {loading ? "Adding..." : "Add Bar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
