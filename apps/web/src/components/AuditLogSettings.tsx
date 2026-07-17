import {useState} from 'react';
import useSWR from 'swr';
import type {AuditLogEntry, CursorPaginatedResponse} from '@merlin/types';
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
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([]);

  const swrKey = `/allowlist/audit-logs?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

  const {data, isLoading} = useSWR<CursorPaginatedResponse<AuditLogEntry> & {success: boolean}>(swrKey, {
    revalidateOnFocus: false,
  });

  const entries = data?.data ?? [];
  const hasMore = data?.hasMore ?? false;
  const total = data?.total;

  const goNext = () => {
    if (data?.cursor) {
      setCursorHistory(prev => [...prev, cursor]);
      setCursor(data.cursor);
    }
  };

  const goPrevious = () => {
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory(prev => prev.slice(0, -1));
    setCursor(previousCursor);
  };

  const showPagination = hasMore || cursorHistory.length > 0;

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

            {showPagination && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-neutral-500">
                  {total !== undefined ? `${total} total records` : 'Showing recent events'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goPrevious}
                    disabled={cursorHistory.length === 0}
                  >
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={goNext} disabled={!hasMore}>
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
