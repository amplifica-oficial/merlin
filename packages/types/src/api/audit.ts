/**
 * Audit log API types
 */

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
