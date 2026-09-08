import type {ProjectFileItem, RequestUploadResponse, SystemFolderKey} from '@merlin/types';

import {network} from './network';
import {uploadViaPresignedUrl} from './uploadViaPresignedUrl';

export type UploadDestination =
  | {parentId?: string | null; systemFolder?: never}
  | {systemFolder: SystemFolderKey; parentId?: never};

export interface UploadedProjectFile {
  fileId: string;
  name: string;
  publicUrl: string | null;
}

export async function uploadProjectFile(file: File, dest: UploadDestination): Promise<UploadedProjectFile> {
  let pendingFileId: string | null = null;

  try {
    const prep = await network.fetch<RequestUploadResponse, never>('POST', '/files/uploads', {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      ...(dest.systemFolder ? {systemFolder: dest.systemFolder} : {parentId: dest.parentId ?? null}),
    } as never);
    pendingFileId = prep.fileId;
    await uploadViaPresignedUrl(file, prep.presignedUrl, file.type || 'application/octet-stream');
    const confirmed = await network.fetch<ProjectFileItem>('POST', `/files/uploads/${prep.fileId}/confirm`);
    pendingFileId = null;
    return {
      fileId: confirmed.id,
      name: confirmed.name,
      publicUrl: confirmed.publicUrl,
    };
  } catch (error) {
    if (pendingFileId) {
      await network.fetch('DELETE', `/files/${pendingFileId}`).catch(() => undefined);
    }
    throw error;
  }
}
