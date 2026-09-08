import {
  Button,
  IconSpinner,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@merlin/ui';
import {ChevronRight, Copy, ExternalLink, File, Folder, Loader2, Search, Upload} from 'lucide-react';
import {Fragment, useRef, useState} from 'react';
import {toast} from 'sonner';

import {copyToClipboard, folderHref} from '../../lib/files';
import {useFileBrowser} from '../../lib/hooks/useFileBrowser';

interface FilesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFolderId?: string | null;
}

export function FilesSheet({open, onOpenChange, initialFolderId = null}: FilesSheetProps) {
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    searchInput,
    setSearchInput,
    items,
    nextCursor,
    breadcrumb,
    isLoading,
    loadingMore,
    uploading,
    handleLoadMore,
    handleFilesSelected,
  } = useFileBrowser({enabled: open, folderId});

  const copyUrl = async (url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success('URL copied');
    } else {
      toast.error('Could not copy URL');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle>Files</SheetTitle>
            <Button variant="ghost" size="icon" aria-label="Open Files page" asChild>
              <a href={folderHref(folderId)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <SheetDescription>Browse and upload without leaving this page.</SheetDescription>
        </SheetHeader>

        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-neutral-500">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className={folderId ? 'hover:text-neutral-900 hover:underline' : 'font-medium text-neutral-900'}
          >
            Root
          </button>
          {breadcrumb.map((crumb, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <Fragment key={crumb.id}>
                <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                {isLast ? (
                  <span className="font-medium text-neutral-900">{crumb.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFolderId(crumb.id)}
                    className="hover:text-neutral-900 hover:underline"
                  >
                    {crumb.name}
                  </button>
                )}
              </Fragment>
            );
          })}
        </nav>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="search"
              placeholder="Search by name..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9"
              aria-label="Search files"
            />
          </div>
          <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => {
              void handleFilesSelected(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200">
          {isLoading && items.length === 0 ? (
            <div className="flex justify-center py-16">
              <IconSpinner />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              {searchInput ? 'No results in this folder.' : 'This folder is empty.'}
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map(row => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  {row.kind === 'FOLDER' ? (
                    <button
                      type="button"
                      onClick={() => setFolderId(row.id)}
                      className="inline-flex min-w-0 items-center gap-2 text-left font-medium text-neutral-900 hover:underline"
                    >
                      <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                      <span className="truncate">{row.name}</span>
                    </button>
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-2 text-neutral-900">
                      <File className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="truncate">{row.name}</span>
                    </span>
                  )}
                  {row.kind === 'FILE' && row.publicUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Copy URL"
                      onClick={() => void copyUrl(row.publicUrl!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {nextCursor ? (
          <Button variant="outline" onClick={() => void handleLoadMore()} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
