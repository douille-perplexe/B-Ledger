"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Link2, Users } from "lucide-react";
import type { Profile, TeamMember } from "@/types/database";
import { toast } from "sonner";

interface MembersAdminProps {
  members: Profile[];
  teams: { id: string; name: string }[];
  teamMembers: (TeamMember & {
    team: { id: string; name: string } | null;
    profile: { id: string; full_name: string } | null;
  })[];
  isSuperAdmin: boolean;
}

export function MembersAdmin({
  members,
  teams,
  teamMembers,
  isSuperAdmin,
}: MembersAdminProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeam, setInviteTeam] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: inviteTeam, role: inviteRole }),
      });

      if (!res.ok) {
        let msg = "Failed to create invite";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // not JSON
        }
        toast.error(msg);
        return;
      }

      const data = await res.json();
      setInviteUrl(data.invite_url);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function copyInviteUrl() {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard");
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, global_role: newRole }),
      });

      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        let msg = "Failed to update role";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // not JSON
        }
        toast.error(msg);
      }
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage members and generate invite links.
          </p>
        </div>
        <Button
          onClick={() => {
            setInviteOpen(true);
            setInviteUrl("");
            setInviteTeam("");
            setInviteRole("member");
          }}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Invite link
        </Button>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateInvite}>
            <DialogHeader>
              <DialogTitle>Generate invite link</DialogTitle>
              <DialogDescription>
                Create a link to invite someone to a team. Links expire after 7
                days.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={inviteTeam} onValueChange={setInviteTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteUrl && (
                <div className="space-y-2">
                  <Label>Invite URL</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                      {inviteUrl}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyInviteUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                {inviteUrl ? "Done" : "Cancel"}
              </Button>
              {!inviteUrl && (
                <Button type="submit" disabled={loading || !inviteTeam}>
                  {loading ? "Generating..." : "Generate link"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total members</CardDescription>
            <CardTitle className="text-3xl">{members.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active teams</CardDescription>
            <CardTitle className="text-3xl">{teams.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unassigned</CardDescription>
            <CardTitle className="text-3xl">
              {
                members.filter(
                  (m) => !teamMembers.some((tm) => tm.user_id === m.id)
                ).length
              }
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Members table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            All members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No members yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate an invite link to add members.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Global Role</TableHead>
                  <TableHead>Teams</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const memberTeams = teamMembers.filter(
                    (tm) => tm.user_id === member.id
                  );
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Select
                            value={member.global_role}
                            onValueChange={(val) =>
                              handleRoleChange(member.id, val)
                            }
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">
                                Super Admin
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">{member.global_role}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {memberTeams.map((tm) => (
                            <Badge
                              key={tm.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tm.team?.name} ({tm.role})
                            </Badge>
                          ))}
                          {memberTeams.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              No team
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
