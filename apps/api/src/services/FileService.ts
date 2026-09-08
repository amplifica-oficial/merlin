import {ProjectFileKind, ProjectFileStatus, type ProjectFile} from '@merlin/db';
import type {
  FileBreadcrumbItem,
  FilesListResponse,
  FolderDeletePreviewResponse,
  ProjectFileItem,
  SystemFolderKey,
} from '@merlin/types';

import {prisma} from '../database/prisma.js';
import {BadRequest, ConflictError, NotFound} from '../exceptions/index.js';
import {buildProjectFileStorageKey, S3_MAX_UPLOAD_BYTES, validateUploadFile} from './fileUploadValidation.js';
import * as S3Service from './S3Service.js';

const FILES_PAGE_SIZE = 50;
const TREE_WALK_BATCH = 100;
export const DELETE_PREVIEW_LIST_CAP = 500;

export const SYSTEM_FOLDER_NAMES = {
  'quick-uploads': 'Quick uploads',
  'email-images': 'Email images',
} as const satisfies Record<SystemFolderKey, string>;

function toItem(row: {
  id: string;
  kind: ProjectFileKind;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  storageKey: string | null;
  createdAt: Date;
}): ProjectFileItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    publicUrl:
      row.kind === ProjectFileKind.FILE && row.storageKey ? S3Service.getPublicObjectUrl(row.storageKey) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertParentInProject(projectId: string, parentId: string | null): Promise<void> {
  if (!parentId) return;

  const parent = await prisma.projectFile.findFirst({
    where: {
      id: parentId,
      projectId,
      kind: ProjectFileKind.FOLDER,
      status: ProjectFileStatus.READY,
    },
    select: {id: true},
  });

  if (!parent) {
    throw new NotFound('folder', parentId);
  }
}

async function assertSiblingNameAvailable(
  projectId: string,
  parentId: string | null,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.projectFile.findFirst({
    where: {
      projectId,
      parentId,
      name: {equals: name, mode: 'insensitive'},
      status: {not: ProjectFileStatus.FAILED},
      ...(excludeId ? {id: {not: excludeId}} : {}),
    },
    select: {id: true},
  });

  if (existing) {
    throw new ConflictError('An item with this name already exists in this folder.');
  }
}

async function issuePresignedUpload(
  projectId: string,
  fileId: string,
  name: string,
  contentType: string,
  sizeBytes: number,
  storageKey?: string | null,
): Promise<{fileId: string; presignedUrl: string; publicUrl: string}> {
  const key = storageKey || buildProjectFileStorageKey(projectId, fileId, name);

  await prisma.projectFile.update({
    where: {id: fileId},
    data: {
      storageKey: key,
      contentType,
      sizeBytes,
      status: ProjectFileStatus.PENDING,
    },
  });

  const presignedUrl = await S3Service.getPresignedPutUrl({
    key,
    contentType,
    contentLength: sizeBytes,
  });

  return {
    fileId,
    presignedUrl,
    publicUrl: S3Service.getPublicObjectUrl(key),
  };
}

async function getBreadcrumb(projectId: string, folderId: string | null): Promise<FileBreadcrumbItem[]> {
  const crumbs: FileBreadcrumbItem[] = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await prisma.projectFile.findFirst({
      where: {
        id: currentId,
        projectId,
        kind: ProjectFileKind.FOLDER,
      },
      select: {id: true, name: true, parentId: true},
    });
    if (!folder) break;
    crumbs.unshift({id: folder.id, name: folder.name});
    currentId = folder.parentId;
  }

  return crumbs;
}

function splitFileName(name: string): {stem: string; ext: string} {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return {stem: name, ext: ''};
  }
  return {stem: name.slice(0, lastDot), ext: name.slice(lastDot)};
}

async function nextAvailableSiblingName(projectId: string, parentId: string | null, desired: string): Promise<string> {
  const taken = await prisma.projectFile.findFirst({
    where: {
      projectId,
      parentId,
      name: {equals: desired, mode: 'insensitive'},
      status: {not: ProjectFileStatus.FAILED},
    },
    select: {id: true},
  });

  if (!taken) {
    return desired;
  }

  const {stem, ext} = splitFileName(desired);
  let n = 2;
  while (n < 10_000) {
    const candidate = `${stem} (${n})${ext}`;
    const existing = await prisma.projectFile.findFirst({
      where: {
        projectId,
        parentId,
        name: {equals: candidate, mode: 'insensitive'},
        status: {not: ProjectFileStatus.FAILED},
      },
      select: {id: true},
    });
    if (!existing) {
      return candidate;
    }
    n += 1;
  }

  throw new ConflictError('Could not find an available file name in this folder.');
}

async function collectDescendantStorageKeys(projectId: string, rootId: string): Promise<string[]> {
  const keys: string[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const batch = queue.splice(0, TREE_WALK_BATCH);
    const nodes = await prisma.projectFile.findMany({
      where: {projectId, id: {in: batch}},
      select: {id: true, kind: true, storageKey: true},
    });

    for (const node of nodes) {
      if (node.kind === ProjectFileKind.FILE && node.storageKey) {
        keys.push(node.storageKey);
      }
    }

    const children = await prisma.projectFile.findMany({
      where: {projectId, parentId: {in: batch}},
      select: {id: true},
    });
    for (const child of children) {
      queue.push(child.id);
    }
  }

  return keys;
}

export class FileService {
  public static async getOrCreateSystemFolder(projectId: string, name: string): Promise<ProjectFile> {
    const folderName = name.trim();
    if (!folderName) {
      throw new BadRequest('Folder name is required.');
    }

    return prisma.$transaction(async tx => {
      const lockKey = `${projectId}:${folderName}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.projectFile.findFirst({
        where: {
          projectId,
          parentId: null,
          kind: ProjectFileKind.FOLDER,
          status: ProjectFileStatus.READY,
          name: {equals: folderName, mode: 'insensitive'},
        },
      });

      if (existing) {
        return existing;
      }

      return tx.projectFile.create({
        data: {
          projectId,
          parentId: null,
          kind: ProjectFileKind.FOLDER,
          name: folderName,
          status: ProjectFileStatus.READY,
        },
      });
    });
  }

  public static async registerUploadedObject(
    projectId: string,
    input: {
      name: string;
      storageKey: string;
      contentType: string;
      sizeBytes: number;
      folderId: string;
    },
  ): Promise<ProjectFileItem> {
    await assertParentInProject(projectId, input.folderId);

    const rawName = input.name.trim();
    if (!rawName) {
      throw new BadRequest('A valid file name is required.');
    }

    const name = await nextAvailableSiblingName(projectId, input.folderId, rawName);

    const created = await prisma.projectFile.create({
      data: {
        projectId,
        parentId: input.folderId,
        kind: ProjectFileKind.FILE,
        name,
        storageKey: input.storageKey,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: ProjectFileStatus.READY,
      },
    });

    return toItem(created);
  }

  public static async list(
    projectId: string,
    options: {
      folderId?: string | null;
      search?: string;
      cursor?: string | null;
      limit?: number;
    } = {},
  ): Promise<FilesListResponse> {
    const folderId = options.folderId ?? null;
    await assertParentInProject(projectId, folderId);

    const limit = Math.min(options.limit ?? FILES_PAGE_SIZE, 100);
    const search = options.search?.trim() ?? '';

    const rows = await prisma.projectFile.findMany({
      where: {
        projectId,
        parentId: folderId,
        status: ProjectFileStatus.READY,
        ...(search ? {name: {contains: search, mode: 'insensitive' as const}} : {}),
      },
      orderBy: [{kind: 'asc'}, {name: 'asc'}, {id: 'asc'}],
      take: limit + 1,
      ...(options.cursor ? {cursor: {id: options.cursor}, skip: 1} : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map(toItem),
      breadcrumb: await getBreadcrumb(projectId, folderId),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  public static async createFolder(
    projectId: string,
    input: {name: string; parentId?: string | null},
  ): Promise<ProjectFile> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequest('Folder name is required.');
    }

    const parentId = input.parentId ?? null;
    await assertParentInProject(projectId, parentId);
    await assertSiblingNameAvailable(projectId, parentId, name);

    return prisma.projectFile.create({
      data: {
        projectId,
        parentId,
        kind: ProjectFileKind.FOLDER,
        name,
        status: ProjectFileStatus.READY,
      },
    });
  }

  public static async requestUpload(
    projectId: string,
    input: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      parentId?: string | null;
      systemFolder?: SystemFolderKey;
    },
  ): Promise<{fileId: string; presignedUrl: string; publicUrl: string}> {
    if (!S3Service.isS3Enabled()) {
      throw new BadRequest('File storage is not enabled.');
    }

    const validation = validateUploadFile(input.fileName, input.contentType, input.sizeBytes, S3_MAX_UPLOAD_BYTES);
    if (!validation.ok) {
      throw new BadRequest(validation.error);
    }

    const rawName = input.fileName.trim();
    if (!rawName) {
      throw new BadRequest('A valid file name is required.');
    }

    let parentId = input.parentId ?? null;
    let name = rawName;

    if (input.systemFolder) {
      const folder = await FileService.getOrCreateSystemFolder(projectId, SYSTEM_FOLDER_NAMES[input.systemFolder]);
      parentId = folder.id;
      name = await nextAvailableSiblingName(projectId, parentId, rawName);
    } else {
      await assertParentInProject(projectId, parentId);
      await assertSiblingNameAvailable(projectId, parentId, name);
    }

    const file = await prisma.projectFile.create({
      data: {
        projectId,
        parentId,
        kind: ProjectFileKind.FILE,
        name,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: ProjectFileStatus.PENDING,
      },
      select: {id: true},
    });

    try {
      return await issuePresignedUpload(projectId, file.id, name, input.contentType, input.sizeBytes);
    } catch (error) {
      await prisma.projectFile.delete({where: {id: file.id}}).catch(() => undefined);
      throw error;
    }
  }

  public static async confirmUpload(projectId: string, fileId: string): Promise<ProjectFileItem> {
    if (!S3Service.isS3Enabled()) {
      throw new BadRequest('File storage is not enabled.');
    }

    const file = await prisma.projectFile.findFirst({
      where: {id: fileId, projectId, kind: ProjectFileKind.FILE},
    });

    if (!file) {
      throw new NotFound('file', fileId);
    }

    if (file.status === ProjectFileStatus.READY) {
      return toItem(file);
    }

    if (!file.storageKey) {
      throw new BadRequest('Storage key is missing.');
    }

    const meta = await S3Service.headObject(file.storageKey);
    if (!meta || meta.contentLength <= 0) {
      await prisma.projectFile.update({
        where: {id: fileId},
        data: {status: ProjectFileStatus.FAILED},
      });
      throw new BadRequest('File was not found in storage. Please try uploading again.');
    }

    const updated = await prisma.projectFile.update({
      where: {id: fileId},
      data: {
        status: ProjectFileStatus.READY,
        sizeBytes: meta.contentLength,
        contentType: meta.contentType ?? undefined,
      },
    });

    return toItem(updated);
  }

  public static async delete(projectId: string, fileId: string): Promise<void> {
    const file = await prisma.projectFile.findFirst({
      where: {id: fileId, projectId},
      select: {id: true},
    });

    if (!file) {
      throw new NotFound('file', fileId);
    }

    const storageKeys = await collectDescendantStorageKeys(projectId, fileId);
    if (storageKeys.length > 0 && S3Service.isS3Enabled()) {
      await S3Service.deleteObjects(storageKeys);
    }

    await prisma.projectFile.delete({
      where: {id: fileId},
    });
  }

  public static async deletePreview(
    projectId: string,
    fileId: string,
    options: {listLimit?: number} = {},
  ): Promise<FolderDeletePreviewResponse> {
    const listLimit = options.listLimit ?? DELETE_PREVIEW_LIST_CAP;

    const root = await prisma.projectFile.findFirst({
      where: {id: fileId, projectId},
      select: {id: true, kind: true, name: true, sizeBytes: true},
    });

    if (!root) {
      throw new NotFound('file', fileId);
    }

    if (root.kind === ProjectFileKind.FILE) {
      return {
        name: root.name,
        kind: 'FILE',
        totalFiles: 1,
        totalFolders: 0,
        files: [{id: root.id, name: root.name, sizeBytes: root.sizeBytes}],
        truncated: false,
      };
    }

    let totalFiles = 0;
    let totalFolders = 0;
    const files: FolderDeletePreviewResponse['files'] = [];
    let truncated = false;
    const queue = [root.id];

    while (queue.length > 0) {
      const batch = queue.splice(0, TREE_WALK_BATCH);
      const children = await prisma.projectFile.findMany({
        where: {projectId, parentId: {in: batch}},
        select: {id: true, kind: true, name: true, sizeBytes: true},
        orderBy: [{kind: 'asc'}, {name: 'asc'}, {id: 'asc'}],
      });

      for (const child of children) {
        if (child.kind === ProjectFileKind.FOLDER) {
          totalFolders += 1;
          queue.push(child.id);
          continue;
        }

        totalFiles += 1;
        if (files.length < listLimit) {
          files.push({id: child.id, name: child.name, sizeBytes: child.sizeBytes});
        } else {
          truncated = true;
        }
      }
    }

    return {
      name: root.name,
      kind: 'FOLDER',
      totalFiles,
      totalFolders,
      files,
      truncated,
    };
  }
}
