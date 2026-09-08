import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@merlin/ui';
import {Check, Copy, ExternalLink, FolderOpen, Loader2, Upload} from 'lucide-react';
import {useCallback, useRef, useState} from 'react';
import {toast} from 'sonner';

import {copyToClipboard, folderHref, formatBytes} from '../../lib/files';
import {uploadProjectFile} from '../../lib/uploadProjectFile';

interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrowseLibrary: () => void;
}

interface UploadRow {
  id: string;
  name: string;
  sizeBytes: number;
  status: 'uploading' | 'ready' | 'error';
  publicUrl: string | null;
  error?: string;
}

export function QuickUploadDialog({open, onOpenChange, onBrowseLibrary}: QuickUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const reset = () => {
    setRows([]);
    setIsDragOver(false);
    setCopiedId(null);
    dragDepthRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  };

  const uploading = rows.some(row => row.status === 'uploading');

  const handleFiles = useCallback(async (files: FileList | File[] | null) => {
    const fileArray = files ? Array.from(files) : [];
    if (!fileArray.length) return;
    dragDepthRef.current = 0;
    setIsDragOver(false);

    const pending = fileArray.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      sizeBytes: file.size,
      status: 'uploading' as const,
      publicUrl: null,
    }));

    setRows(prev => [...pending, ...prev]);

    for (const [index, row] of pending.entries()) {
      const file = fileArray[index];
      if (!file) continue;
      try {
        const uploaded = await uploadProjectFile(file, {systemFolder: 'quick-uploads'});
        setRows(prev =>
          prev.map(item =>
            item.id === row.id
              ? {...item, status: 'ready', name: uploaded.name, publicUrl: uploaded.publicUrl}
              : item,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        setRows(prev => prev.map(item => (item.id === row.id ? {...item, status: 'error', error: message} : item)));
      }
    }
  }, []);

  const copyUrl = async (row: UploadRow) => {
    if (!row.publicUrl) return;
    const ok = await copyToClipboard(row.publicUrl);
    if (!ok) {
      toast.error('Could not copy URL');
      return;
    }
    setCopiedId(row.id);
    toast.success('URL copied');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>Files are saved to Quick uploads. Copy a URL and keep working.</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={e => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current += 1;
            if (dragDepthRef.current === 1) setIsDragOver(true);
          }}
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={e => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDragOver(false);
          }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = 0;
            setIsDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors ${
            isDragOver
              ? 'border-neutral-900 bg-neutral-50'
              : 'border-neutral-200 bg-neutral-50/60 hover:border-neutral-400'
          }`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-neutral-500" /> : <Upload className="h-6 w-6 text-neutral-500" />}
          <p className="text-sm font-medium text-neutral-900">Drop files here or click to browse</p>
          <p className="text-xs text-neutral-500">Images, documents, and other allowed file types</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => void handleFiles(e.target.files)}
        />

        {rows.length > 0 ? (
          <ul className="max-h-56 overflow-y-auto rounded-md border border-neutral-200 divide-y divide-neutral-100">
            {rows.map(row => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-900">{row.name}</p>
                  <p className="text-xs text-neutral-500">
                    {row.status === 'uploading'
                      ? 'Uploading…'
                      : row.status === 'error'
                        ? row.error
                        : formatBytes(row.sizeBytes)}
                  </p>
                </div>
                {row.status === 'uploading' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                ) : row.status === 'ready' && row.publicUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Copy URL"
                    onClick={() => void copyUrl(row)}
                  >
                    {copiedId === row.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onBrowseLibrary} disabled={uploading}>
              <FolderOpen className="h-4 w-4" />
              Browse library
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Open Files page" asChild>
              <a href={folderHref(null)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <Button type="button" onClick={() => handleOpenChange(false)} disabled={uploading}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
