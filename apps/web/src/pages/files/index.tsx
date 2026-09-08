import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  IconSpinner,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@merlin/ui';
import type {FilesListResponse, ProjectFileItem, RequestUploadResponse} from '@merlin/types';
import {DashboardLayout} from '../../components/DashboardLayout';
import {useConfig} from '../../lib/hooks/useConfig';
import {network} from '../../lib/network';
import {formatRelativeTime} from '../../lib/dateUtils';
import {uploadViaPresignedUrl} from '../../lib/uploadViaPresignedUrl';
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {NextSeo} from 'next-seo';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function folderHref(folderId: string | null): string {
  return folderId ? `/files?folder=${encodeURIComponent(folderId)}` : '/files';
}

export default function FilesPage() {
  const router = useRouter();
  const {data: config} = useConfig();
  const s3Enabled = config?.features.storage.s3Enabled === true;

  const folderId = useMemo(() => {
    if (!router.isReady) return null;
    const value = router.query.folder;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }, [router.isReady, router.query.folder]);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [extraItems, setExtraItems] = useState<ProjectFileItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearch('');
    setSearchInput('');
    setExtraItems([]);
    setExtraCursor(null);
  }, [folderId]);

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    if (folderId) params.set('folder', folderId);
    if (search) params.set('search', search);
    const query = params.toString();
    return query ? `/files?${query}` : '/files';
  }, [folderId, search]);

  const {data, mutate, isLoading} = useSWR<FilesListResponse>(s3Enabled ? listPath : null, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    setExtraItems([]);
    setExtraCursor(null);
  }, [listPath]);

  const items = useMemo(() => [...(data?.items ?? []), ...extraItems], [data?.items, extraItems]);
  const nextCursor = extraItems.length > 0 ? extraCursor : (data?.nextCursor ?? null);
  const breadcrumb = data?.breadcrumb ?? [];

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folder', folderId);
      if (search) params.set('search', search);
      params.set('cursor', nextCursor);
      const page = await network.fetch<FilesListResponse>('GET', `/files?${params.toString()}`);
      setExtraItems(prev => [...prev, ...page.items]);
      setExtraCursor(page.nextCursor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load more files');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error('Enter a folder name.');
      return;
    }
    setCreatingFolder(true);
    try {
      await network.fetch<unknown, never>('POST', '/files/folders', {
        name,
        parentId: folderId,
      } as never);
      setFolderDialogOpen(false);
      setNewFolderName('');
      toast.success('Folder created');
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFilesSelected = useCallback(
    async (files: FileList | File[] | null) => {
      const fileArray = files ? Array.from(files) : [];
      if (!fileArray.length) return;
      dragDepthRef.current = 0;
      setIsDragOver(false);
      setUploading(true);
      let successCount = 0;

      for (const file of fileArray) {
        let pendingFileId: string | null = null;
        try {
          const prep = await network.fetch<RequestUploadResponse, never>('POST', '/files/uploads', {
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            parentId: folderId,
          } as never);
          pendingFileId = prep.fileId;
          await uploadViaPresignedUrl(file, prep.presignedUrl, file.type || 'application/octet-stream');
          await network.fetch('POST', `/files/uploads/${prep.fileId}/confirm`);
          pendingFileId = null;
          successCount += 1;
        } catch (error) {
          if (pendingFileId) {
            await network.fetch('DELETE', `/files/${pendingFileId}`).catch(() => undefined);
          }
          toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
        }
      }

      setUploading(false);
      if (successCount > 0) {
        toast.success(successCount === 1 ? 'File uploaded' : `${successCount} files uploaded`);
        void mutate();
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [folderId, mutate],
  );

  const dragDropEnabled = s3Enabled && !uploading;

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!dragDropEnabled) {
        resetDragState();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      if (dragDepthRef.current === 1) setIsDragOver(true);
    },
    [dragDropEnabled, resetDragState],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!dragDropEnabled) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [dragDropEnabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!dragDropEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDragOver(false);
    },
    [dragDropEnabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!dragDropEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      resetDragState();
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length) void handleFilesSelected(dropped);
    },
    [dragDropEnabled, resetDragState, handleFilesSelected],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await network.fetch('DELETE', `/files/${deleteTarget.id}`);
      toast.success('Item deleted');
      setDeleteTarget(null);
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copied');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  return (
    <>
      <NextSeo title="Files" />
      <DashboardLayout>
        <div
          className="relative space-y-6"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-neutral-900 bg-white/80 backdrop-blur-sm"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-neutral-900">Drop files to upload</p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Files</h1>
              <p className="text-neutral-500 mt-1">Project media library. Uploaded files are publicly reachable by URL.</p>
            </div>
            {s3Enabled ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setFolderDialogOpen(true)} disabled={uploading}>
                  <FolderPlus className="h-4 w-4" />
                  New folder
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => void handleFilesSelected(e.target.files)}
                />
              </div>
            ) : null}
          </div>

          {s3Enabled ? (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Public storage</AlertTitle>
              <AlertDescription>
                Files uploaded here are accessible without authentication. Do not upload confidential documents or
                sensitive personal data.
              </AlertDescription>
            </Alert>
          ) : null}

          {!s3Enabled ? (
            <EmptyState
              icon={FolderOpen}
              title="File storage is not configured"
              description="Configure S3-compatible storage to browse, upload, and manage project files."
            />
          ) : (
            <>
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
                {breadcrumb.length === 0 ? (
                  <span className="font-medium text-neutral-900">Root</span>
                ) : (
                  <>
                    <Link href={folderHref(null)} className="hover:text-neutral-900 hover:underline">
                      Root
                    </Link>
                    {breadcrumb.map((crumb, index) => {
                      const isLast = index === breadcrumb.length - 1;
                      return (
                        <Fragment key={crumb.id}>
                          <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                          {isLast ? (
                            <span className="font-medium text-neutral-900">{crumb.name}</span>
                          ) : (
                            <Link href={folderHref(crumb.id)} className="hover:text-neutral-900 hover:underline">
                              {crumb.name}
                            </Link>
                          )}
                        </Fragment>
                      );
                    })}
                  </>
                )}
              </nav>

              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  type="search"
                  placeholder="Search by name..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="pl-9"
                  aria-label="Search files"
                />
              </div>

              {isLoading && !data ? (
                <div className="flex justify-center py-16">
                  <IconSpinner />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={search ? Search : FolderOpen}
                  title={search ? 'No results' : 'This folder is empty'}
                  description={
                    search
                      ? `Nothing matched “${search}”. Try another name or clear the search.`
                      : 'Create a folder or upload files to get started.'
                  }
                  action={
                    search ? (
                      <Button variant="outline" onClick={() => setSearchInput('')}>
                        Clear search
                      </Button>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
                          <FolderPlus className="h-4 w-4" />
                          New folder
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4" />
                          Upload
                        </Button>
                      </div>
                    )
                  }
                />
              ) : (
                <div className="rounded-lg border border-neutral-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Size</TableHead>
                        <TableHead className="hidden md:table-cell">Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(row => (
                        <TableRow key={row.id}>
                          <TableCell>
                            {row.kind === 'FOLDER' ? (
                              <Link
                                href={folderHref(row.id)}
                                className="inline-flex items-center gap-2 font-medium text-neutral-900 hover:underline"
                              >
                                <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                                {row.name}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-neutral-900">
                                <File className="h-4 w-4 shrink-0 text-neutral-400" />
                                {row.name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-neutral-500">
                            {row.kind === 'FILE' ? formatBytes(row.sizeBytes) : '—'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-neutral-500">
                            {formatRelativeTime(row.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {row.kind === 'FILE' && row.publicUrl ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Copy public URL"
                                    onClick={() => void copyPublicUrl(row.publicUrl!)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" aria-label="Open in new tab" asChild>
                                    <a href={row.publicUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </>
                              ) : null}
                              <Button
                                type="button"
                                variant="destructiveGhost"
                                size="icon"
                                aria-label="Delete"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {nextCursor ? (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => void handleLoadMore()} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleCreateFolder();
                }}
                placeholder="Assets"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderDialogOpen(false)} disabled={creatingFolder}>
                Cancel
              </Button>
              <Button onClick={() => void handleCreateFolder()} disabled={creatingFolder}>
                {creatingFolder ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteTarget != null}
          onOpenChange={open => {
            if (!open) setDeleteTarget(null);
          }}
          onConfirm={handleDelete}
          title={deleteTarget?.kind === 'FOLDER' ? 'Delete folder?' : 'Delete file?'}
          description={
            deleteTarget?.kind === 'FOLDER'
              ? `“${deleteTarget.name}” and everything inside it will be permanently deleted.`
              : `“${deleteTarget?.name ?? ''}” will be permanently deleted.`
          }
          confirmText="Delete"
          variant="destructive"
          status={deleting ? 'loading' : 'idle'}
        />
      </DashboardLayout>
    </>
  );
}
