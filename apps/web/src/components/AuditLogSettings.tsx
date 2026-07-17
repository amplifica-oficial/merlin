import {useState} from 'react';
import useSWR from 'swr';
import type {AuditLogEntry, PaginatedResponse} from '@merlin/types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  IconSpinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@merlin/ui';

const PAGE_SIZE = 20;

function formatAction(action: string): string {
  switch (action) {
    case 'allowlist.add':
      return 'Allowlist add';
    case 'allowlist.remove':
      return 'Allowlist remove';
    default:
      return action;
  }
}

function formatMetadataDetails(action: string, metadata: Record<string, unknown> | null): string {
  if (!metadata) {
    return '—';
  }

  if (action === 'allowlist.remove') {
    const removedMembershipCount =
      typeof metadata.removedMembershipCount === 'number' ? metadata.removedMembershipCount : 0;
    const projectIds = Array.isArray(metadata.projectIds) ? metadata.projectIds : [];
    return `${removedMembershipCount} membership${removedMembershipCount === 1 ? '' : 's'} removed across ${projectIds.length} project${projectIds.length === 1 ? '' : 's'}`;
  }

  if (action === 'allowlist.add') {
    const created = metadata.created === true;
    const projectIds = Array.isArray(metadata.projectIds) ? metadata.projectIds : [];
    const entryLabel = created ? 'New entry' : 'Existing entry';
    return `${entryLabel}, ${projectIds.length} project${projectIds.length === 1 ? '' : 's'} shared`;
  }

  return JSON.stringify(metadata);
}

export function AuditLogSettings() {
  const [page, setPage] = useState(1);

  const {data, isLoading} = useSWR<PaginatedResponse<AuditLogEntry> & {success: boolean}>(
    `/allowlist/audit-logs?page=${page}&pageSize=${PAGE_SIZE}`,
    {
      revalidateOnFocus: false,
    },
  );

  const entries = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          Instance-wide record of authorization changes. Only trusted-domain managers can view this log.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <IconSpinner className="h-6 w-6" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4">No audit events yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{formatAction(entry.action)}</TableCell>
                    <TableCell className="text-neutral-500">{entry.actorEmail ?? '—'}</TableCell>
                    <TableCell className="text-neutral-500">{entry.targetEmail ?? '—'}</TableCell>
                    <TableCell className="text-neutral-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-neutral-500 max-w-xs truncate">
                      {formatMetadataDetails(entry.action, entry.metadata)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-neutral-500">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
