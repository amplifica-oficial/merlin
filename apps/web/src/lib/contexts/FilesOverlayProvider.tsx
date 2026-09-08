import {createContext, type ReactNode, use, useCallback, useMemo, useState} from 'react';

import {FilesSheet} from '../../components/files/FilesSheet';
import {QuickUploadDialog} from '../../components/files/QuickUploadDialog';
import {useConfig} from '../hooks/useConfig';

interface FilesOverlayContextValue {
  openUploadDialog: () => void;
  openFilesSheet: (folderId?: string | null) => void;
}

const FilesOverlayContext = createContext<FilesOverlayContextValue | undefined>(undefined);

export function FilesOverlayProvider({children}: {children: ReactNode}) {
  const {data: config} = useConfig();
  const s3Enabled = config?.features.storage.s3Enabled === true;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFolderId, setSheetFolderId] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState(0);

  const openUploadDialog = useCallback(() => {
    setSheetOpen(false);
    setUploadOpen(true);
  }, []);

  const openFilesSheet = useCallback((folderId?: string | null) => {
    setUploadOpen(false);
    setSheetFolderId(folderId ?? null);
    setSheetKey(key => key + 1);
    setSheetOpen(true);
  }, []);

  const value = useMemo(
    () => ({openUploadDialog, openFilesSheet}),
    [openUploadDialog, openFilesSheet],
  );

  return (
    <FilesOverlayContext.Provider value={value}>
      {children}
      {s3Enabled ? (
        <>
          <QuickUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onBrowseLibrary={() => openFilesSheet(null)}
          />
          <FilesSheet
            key={sheetKey}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            initialFolderId={sheetFolderId}
          />
        </>
      ) : null}
    </FilesOverlayContext.Provider>
  );
}

export function useFilesOverlay(): FilesOverlayContextValue {
  const context = use(FilesOverlayContext);
  if (!context) {
    throw new Error('useFilesOverlay must be used within FilesOverlayProvider');
  }
  return context;
}
