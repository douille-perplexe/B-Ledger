"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLog } from "@/types/database";
import { format } from "date-fns";

interface AuditLogContentProps {
  logs: AuditLog[];
}

export function AuditLogContent({ logs }: AuditLogContentProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      <Card>
        <CardContent className="pt-6">
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
              {logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No audit log entries yet
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
