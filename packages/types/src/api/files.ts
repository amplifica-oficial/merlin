/**
 * Project file manager API types
 */

export type ProjectFileKind = 'FOLDER' | 'FILE';
export type ProjectFileStatus = 'PENDING' | 'READY' | 'FAILED';

export interface ProjectFileItem {
  id: string;
  kind: ProjectFileKind;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  publicUrl: string | null;
  createdAt: string;
  canDelete: boolean;
}

export interface FileBreadcrumbItem {
  id: string;
  name: string;
}

export interface FilesListResponse {
  items: ProjectFileItem[];
  breadcrumb: FileBreadcrumbItem[];
  nextCursor: string | null;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export type SystemFolderKey = 'quick-uploads' | 'email-images';

export interface RequestUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  parentId?: string | null;
  systemFolder?: SystemFolderKey;
}

export interface RequestUploadResponse {
  fileId: string;
  presignedUrl: string;
  publicUrl: string;
}

export interface FolderDeletePreviewFile {
  id: string;
  name: string;
  sizeBytes: number | null;
}

export interface FolderDeletePreviewResponse {
  name: string;
  kind: ProjectFileKind;
  totalFiles: number;
  totalFolders: number;
  files: FolderDeletePreviewFile[];
  truncated: boolean;
}
