"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    if (teamName.trim().length < 3) {
      toast.error("Team name must be at least 3 characters");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });

      if (!res.ok) {
        let msg = "Failed to create team";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // response wasn't JSON
        }
        toast.error(msg);
        return;
      }

      toast.success(`Team "${teamName.trim()}" created`);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization&apos;s teams and squads.
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
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateTeam}>
                <DialogHeader>
                  <DialogTitle>Create a new team</DialogTitle>
                  <DialogDescription>
                    Each team tracks its bars and breakfasts independently.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    placeholder="e.g. Backend, Frontend, DevOps..."
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    maxLength={50}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Between 3 and 50 characters.
                  </p>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateOpen(false);
                      setTeamName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || teamName.trim().length < 3}
                  >
                    {loading ? "Creating..." : "Create team"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total teams</CardDescription>
            <CardTitle className="text-3xl">{teams.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{activeTeams.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Archived</CardDescription>
            <CardTitle className="text-3xl">{archivedTeams.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Active teams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Active teams
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No active teams</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {isSuperAdmin
                  ? "Create your first team to start tracking bars and breakfasts."
                  : "No teams have been created yet. Ask a super admin to create one."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>
                      <Badge
                        variant="default"
                        className="bg-green-100 text-green-800 hover:bg-green-100"
                      >
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(team.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
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
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-muted-foreground">
              <Archive className="h-5 w-5" />
              Archived teams
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
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedTeams.map((team) => (
                  <TableRow key={team.id} className="opacity-60">
                    <TableCell>{team.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Archived</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
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
