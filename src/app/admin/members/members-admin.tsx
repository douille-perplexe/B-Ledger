"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Copy, Link2, UserPlus } from "lucide-react";
import type { Profile, TeamMember } from "@/types/database";
import { toast } from "sonner";

interface MembersAdminProps {
  members: Profile[];
  teams: { id: string; name: string }[];
  teamMembers: (TeamMember & {
    team: { id: string; name: string };
    profile: { id: string; full_name: string };
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

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: inviteTeam, role: inviteRole }),
    });

    if (!res.ok) {
      toast.error("Failed to create invite");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setInviteUrl(data.invite_url);
    setLoading(false);
  }

  function copyInviteUrl() {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard");
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Use the API to update the profile's global role
    const res = await fetch(`/api/admin/update-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, global_role: newRole }),
    });

    if (res.ok) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error("Failed to update role");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Member Management</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <Button onClick={() => { setInviteOpen(true); setInviteUrl(""); }}>
            <Link2 className="h-4 w-4 mr-1" />
            Generate Invite Link
          </Button>
          <DialogContent>
            <form onSubmit={handleCreateInvite}>
              <DialogHeader>
                <DialogTitle>Generate Invite Link</DialogTitle>
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
              <DialogFooter>
                {!inviteUrl ? (
                  <Button type="submit" disabled={loading || !inviteTeam}>
                    {loading ? "Generating..." : "Generate Link"}
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setInviteOpen(false)}>
                    Done
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members table */}
      <Card>
        <CardContent className="pt-6">
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
                          <Badge key={tm.id} variant="secondary" className="text-xs">
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
        </CardContent>
      </Card>
    </div>
  );
}
