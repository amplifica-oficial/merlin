import type {FolderDeletePreviewResponse, ProjectFileItem} from '@merlin/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconSpinner,
} from '@merlin/ui';
import {File} from 'lucide-react';
import useSWR from 'swr';

import {formatBytes} from '../../lib/files';

interface FolderDeleteDialogProps {
  target: ProjectFileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  deleting: boolean;
}

export function FolderDeleteDialog({target, open, onOpenChange, onConfirm, deleting}: FolderDeleteDialogProps) {
  const {data, isLoading, error} = useSWR<FolderDeletePreviewResponse>(
    open && target ? `/files/${target.id}/delete-preview` : null,
    {revalidateOnFocus: false},
  );

  const folderName = target?.name ?? data?.name ?? 'this folder';
  const remaining = data ? data.totalFiles - data.files.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder?</DialogTitle>
          <DialogDescription>
            “{folderName}” and everything inside it will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <IconSpinner />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : 'Failed to load folder contents.'}
          </p>
        ) : data ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-neutral-900">
              {data.totalFiles === 1 ? '1 file' : `${data.totalFiles} files`}
              {data.totalFolders > 0
                ? ` and ${data.totalFolders === 1 ? '1 folder' : `${data.totalFolders} folders`}`
                : ''}{' '}
              will be permanently deleted.
            </p>
            {data.files.length > 0 ? (
              <ul className="max-h-64 overflow-y-auto rounded-md border border-neutral-200 divide-y divide-neutral-100">
                {data.files.map(file => (
                  <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 text-neutral-900">
                      <File className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <span className="shrink-0 text-neutral-500">{formatBytes(file.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">This folder has no files.</p>
            )}
            {data.truncated ? (
              <p className="text-xs text-neutral-500">+{remaining} more files</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={deleting || isLoading}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
