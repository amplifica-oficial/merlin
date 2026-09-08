import type {FilesListResponse, ProjectFileItem} from '@merlin/types';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';

import {network} from '../network';
import {uploadProjectFile} from '../uploadProjectFile';

export function useFileBrowser(options: {enabled: boolean; folderId: string | null}) {
  const {enabled, folderId} = options;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [extraItems, setExtraItems] = useState<ProjectFileItem[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const {data, mutate, isLoading} = useSWR<FilesListResponse>(enabled ? listPath : null, {
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

  const handleFilesSelected = useCallback(
    async (files: FileList | File[] | null) => {
      const fileArray = files ? Array.from(files) : [];
      if (!fileArray.length) return;
      setUploading(true);
      let successCount = 0;

      for (const file of fileArray) {
        try {
          await uploadProjectFile(file, {parentId: folderId});
          successCount += 1;
        } catch (error) {
          toast.error(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
        }
      }

      setUploading(false);
      if (successCount > 0) {
        toast.success(successCount === 1 ? 'File uploaded' : `${successCount} files uploaded`);
        void mutate();
      }
    },
    [folderId, mutate],
  );

  return {
    search,
    searchInput,
    setSearchInput,
    items,
    nextCursor,
    breadcrumb,
    isLoading,
    loadingMore,
    uploading,
    mutate,
    handleLoadMore,
    handleFilesSelected,
  };
}
