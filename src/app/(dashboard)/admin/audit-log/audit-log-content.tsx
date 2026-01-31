"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import type { AuditLog } from "@/types/database";
import { format } from "date-fns";

interface AuditLogContentProps {
  logs: AuditLog[];
}

export function AuditLogContent({ logs }: AuditLogContentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track all actions performed in your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            Recent activity
            <Badge variant="secondary" className="ml-1">
              {logs.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Showing the last 100 entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ScrollText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No audit log entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Actions will appear here as they happen.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.actor?.full_name || "System"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.entity_type}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {log.new_values && (
                        <code className="text-xs text-muted-foreground">
                          {JSON.stringify(log.new_values)}
                        </code>
                      )}
                      {log.reason && (
                        <span className="text-xs text-muted-foreground block">
                          {log.reason}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
