"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Archive, Plus, Users } from "lucide-react";
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
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const activeTeams = teams.filter((t) => !t.is_archived);
  const archivedTeams = teams.filter((t) => t.is_archived);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create team");
        return;
      }

      toast.success(`Team "${teamName}" created`);
      setCreateOpen(false);
      setTeamName("");
      router.refresh();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive(team: Team) {
    setArchivingId(team.id);
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Team "${team.name}" archived`);
        router.refresh();
      } else {
        toast.error("Failed to archive team");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">
            Manage your organization&apos;s teams
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateTeam}>
                <DialogHeader>
                  <DialogTitle>Create a new team</DialogTitle>
                  <DialogDescription>
                    Teams track bars and breakfasts independently.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    placeholder="e.g. Backend, Frontend, DevOps..."
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    minLength={3}
                    maxLength={50}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Between 3 and 50 characters.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading || teamName.length < 3}>
                    {loading ? "Creating..." : "Create team"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active teams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Active teams
            <Badge variant="secondary" className="ml-1">
              {activeTeams.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTeams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No active teams yet.</p>
              {isSuperAdmin && (
                <p className="text-sm mt-1">
                  Create your first team to get started.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  {isSuperAdmin && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTeams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(team.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={archivingId === team.id}
                          onClick={() => handleArchive(team)}
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          {archivingId === team.id ? "Archiving..." : "Archive"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Archived teams */}
      {archivedTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Archive className="h-5 w-5" />
              Archived teams
              <Badge variant="secondary" className="ml-1">
                {archivedTeams.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Archived teams are read-only and hidden from regular users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedTeams.map((team) => (
                  <TableRow key={team.id} className="text-muted-foreground">
                    <TableCell>{team.name}</TableCell>
                    <TableCell>
                      {format(new Date(team.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
