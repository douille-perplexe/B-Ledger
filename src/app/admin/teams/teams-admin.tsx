"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { Team } from "@/types/database";
import { toast } from "sonner";
import { format } from "date-fns";

interface TeamsAdminProps {
  teams: Team[];
  isSuperAdmin: boolean;
}

export function TeamsAdmin({ teams, isSuperAdmin }: TeamsAdminProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to create team");
      setLoading(false);
      return;
    }

    toast.success("Team created");
    setCreateOpen(false);
    setTeamName("");
    setLoading(false);
    router.refresh();
  }

  async function handleArchive(teamId: string) {
    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Team archived");
      router.refresh();
    } else {
      toast.error("Failed to archive team");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team Management</h1>
        {isSuperAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Create Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTeam}>
                <DialogHeader>
                  <DialogTitle>Create Team</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    minLength={3}
                    maxLength={50}
                    required
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    <Badge variant={team.is_archived ? "secondary" : "default"}>
                      {team.is_archived ? "Archived" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(team.created_at), "MMM d, yyyy")}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      {!team.is_archived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(team.id)}
                        >
                          Archive
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No teams yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
