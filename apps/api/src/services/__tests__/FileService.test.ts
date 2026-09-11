import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ProjectFileKind, ProjectFileStatus} from '@merlin/db';

import {BadRequest, ConflictError, NotAllowed, NotFound} from '../../exceptions/index.js';
import {AllowlistService} from '../AllowlistService.js';
import {FileService} from '../FileService';
import {S3_MAX_UPLOAD_BYTES} from '../fileUploadValidation';
import * as S3Service from '../S3Service.js';
import {factories, getPrismaClient} from '../../../../../test/helpers';

vi.mock('../AllowlistService.js', () => ({
  AllowlistService: {
    hasTrustedDomains: vi.fn(() => false),
    isTrustedDomain: vi.fn(() => false),
  },
}));

const apiKeyActor = {type: 'apiKey' as const};

vi.mock('../S3Service.js', () => ({
  isS3Enabled: vi.fn(() => true),
  getPresignedPutUrl: vi.fn(async () => 'https://s3.example/presigned'),
  headObject: vi.fn(async () => ({contentLength: 1024, contentType: 'image/png'})),
  deleteObjects: vi.fn(async () => undefined),
  getPublicObjectUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

describe('FileService', () => {
  let projectId: string;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    const {project} = await factories.createUserWithProject();
    projectId = project.id;
    vi.mocked(S3Service.isS3Enabled).mockReturnValue(true);
    vi.mocked(S3Service.getPresignedPutUrl).mockResolvedValue('https://s3.example/presigned');
    vi.mocked(S3Service.headObject).mockResolvedValue({contentLength: 1024, contentType: 'image/png'});
    vi.mocked(S3Service.deleteObjects).mockResolvedValue(undefined);
    vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(false);
    vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);
  });

  describe('createFolder', () => {
    it('creates a folder at the project root', async () => {
      const folder = await FileService.createFolder(projectId, {name: 'Assets'});

      expect(folder.kind).toBe(ProjectFileKind.FOLDER);
      expect(folder.name).toBe('Assets');
      expect(folder.parentId).toBeNull();
      expect(folder.status).toBe(ProjectFileStatus.READY);
    });

    it('rejects a duplicate name in the same folder', async () => {
      await FileService.createFolder(projectId, {name: 'Assets'});

      await expect(FileService.createFolder(projectId, {name: 'assets'})).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects an empty name', async () => {
      await expect(FileService.createFolder(projectId, {name: '   '})).rejects.toBeInstanceOf(BadRequest);
    });

    it('rejects a missing parent folder', async () => {
      await expect(
        FileService.createFolder(projectId, {name: 'Nested', parentId: '00000000-0000-0000-0000-000000000000'}),
      ).rejects.toBeInstanceOf(NotFound);
    });
  });

  describe('list', () => {
    it('returns folders before files and includes a breadcrumb', async () => {
      const folder = await FileService.createFolder(projectId, {name: 'Images'});
      await FileService.createFolder(projectId, {name: 'Nested', parentId: folder.id});

      const upload = await FileService.requestUpload(projectId, {
        parentId: folder.id,
        fileName: 'logo.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });
      vi.mocked(S3Service.headObject).mockResolvedValue({contentLength: 2048, contentType: 'image/png'});
      await FileService.confirmUpload(projectId, upload.fileId);

      const result = await FileService.list(projectId, {folderId: folder.id});

      expect(result.breadcrumb).toEqual([{id: folder.id, name: 'Images'}]);
      expect(result.items.map(item => item.name)).toEqual(['Nested', 'logo.png']);
      expect(result.items[0]?.kind).toBe('FOLDER');
      expect(result.items[1]?.kind).toBe('FILE');
      expect(result.items[1]?.publicUrl).toMatch(/^https:\/\/cdn\.example\//);
      expect(result.items[0]?.canDelete).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('sets canDelete from the requester actor', async () => {
      const {user} = await factories.createUserWithProject();
      await FileService.createFolder(projectId, {name: 'Images', createdById: user.id});

      const allowed = await FileService.list(projectId, {}, {
        type: 'jwt',
        userId: user.id,
        email: user.email,
        role: 'OWNER',
      });
      const denied = await FileService.list(projectId, {}, {
        type: 'jwt',
        userId: 'other-user',
        email: 'guest@example.com',
        role: 'MEMBER',
      });

      expect(allowed.items[0]?.canDelete).toBe(true);
      expect(denied.items[0]?.canDelete).toBe(false);
    });

    it('filters by name in the current folder', async () => {
      await FileService.createFolder(projectId, {name: 'Images'});
      await FileService.createFolder(projectId, {name: 'Docs'});

      const result = await FileService.list(projectId, {search: 'doc'});

      expect(result.items.map(item => item.name)).toEqual(['Docs']);
    });

    it('hides pending uploads', async () => {
      await FileService.requestUpload(projectId, {
        fileName: 'pending.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });

      const result = await FileService.list(projectId, {});

      expect(result.items).toHaveLength(0);
    });

    it('paginates with a cursor', async () => {
      for (const name of ['A', 'B', 'C']) {
        await FileService.createFolder(projectId, {name});
      }

      const first = await FileService.list(projectId, {limit: 2});
      expect(first.items.map(item => item.name)).toEqual(['A', 'B']);
      expect(first.nextCursor).toBeTruthy();

      const second = await FileService.list(projectId, {limit: 2, cursor: first.nextCursor});
      expect(second.items.map(item => item.name)).toEqual(['C']);
      expect(second.nextCursor).toBeNull();
    });
  });

  describe('requestUpload', () => {
    it('creates a pending file and returns a presigned URL', async () => {
      const result = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });

      expect(result.fileId).toBeTruthy();
      expect(result.presignedUrl).toBe('https://s3.example/presigned');
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\//);

      const row = await prisma.projectFile.findUnique({where: {id: result.fileId}});
      expect(row?.status).toBe(ProjectFileStatus.PENDING);
      expect(row?.storageKey).toContain(`${projectId}/files/${result.fileId}/`);
      expect(S3Service.getPresignedPutUrl).toHaveBeenCalled();
    });

    it('stores createdById when provided', async () => {
      const {user} = await factories.createUserWithProject();
      const result = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        createdById: user.id,
      });

      const row = await prisma.projectFile.findUnique({where: {id: result.fileId}});
      expect(row?.createdById).toBe(user.id);
    });

    it('rejects blocked file types', async () => {
      await expect(
        FileService.requestUpload(projectId, {
          fileName: 'malware.exe',
          contentType: 'application/octet-stream',
          sizeBytes: 100,
        }),
      ).rejects.toBeInstanceOf(BadRequest);
    });

    it('rejects a duplicate name in the same folder', async () => {
      await FileService.requestUpload(projectId, {
        fileName: 'Merlin.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });

      await expect(
        FileService.requestUpload(projectId, {
          fileName: 'Merlin.png',
          contentType: 'image/png',
          sizeBytes: 2048,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('confirmUpload', () => {
    it('marks the file ready after the object exists', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });

      await FileService.confirmUpload(projectId, fileId);

      const row = await prisma.projectFile.findUnique({where: {id: fileId}});
      expect(row?.status).toBe(ProjectFileStatus.READY);
      expect(row?.sizeBytes).toBe(1024);
    });

    it('marks the file failed when the object is missing', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      vi.mocked(S3Service.headObject).mockResolvedValue(null);

      await expect(FileService.confirmUpload(projectId, fileId)).rejects.toBeInstanceOf(BadRequest);

      const row = await prisma.projectFile.findUnique({where: {id: fileId}});
      expect(row?.status).toBe(ProjectFileStatus.FAILED);
    });

    it('rejects objects larger than the upload limit and deletes them from storage', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      const pending = await prisma.projectFile.findUnique({where: {id: fileId}});
      vi.mocked(S3Service.headObject).mockResolvedValue({
        contentLength: S3_MAX_UPLOAD_BYTES + 1,
        contentType: 'image/png',
      });

      await expect(FileService.confirmUpload(projectId, fileId)).rejects.toBeInstanceOf(BadRequest);

      const row = await prisma.projectFile.findUnique({where: {id: fileId}});
      expect(row?.status).toBe(ProjectFileStatus.FAILED);
      expect(S3Service.deleteObjects).toHaveBeenCalledWith([pending?.storageKey]);
    });

    it('still rejects an oversized object when storage cleanup fails', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      vi.mocked(S3Service.headObject).mockResolvedValue({
        contentLength: S3_MAX_UPLOAD_BYTES + 1,
        contentType: 'image/png',
      });
      vi.mocked(S3Service.deleteObjects).mockRejectedValueOnce(new Error('S3 down'));

      await expect(FileService.confirmUpload(projectId, fileId)).rejects.toBeInstanceOf(BadRequest);

      const row = await prisma.projectFile.findUnique({where: {id: fileId}});
      expect(row?.status).toBe(ProjectFileStatus.FAILED);
    });

    it('sets canDelete when an actor is provided', async () => {
      const {user} = await factories.createUserWithProject();
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        createdById: user.id,
      });

      const item = await FileService.confirmUpload(projectId, fileId, {
        type: 'jwt',
        userId: user.id,
        email: user.email,
        role: 'OWNER',
      });

      expect(item.canDelete).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes a file and its S3 object', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      await FileService.confirmUpload(projectId, fileId);
      const row = await prisma.projectFile.findUnique({where: {id: fileId}});

      await FileService.delete(projectId, fileId, apiKeyActor);

      expect(S3Service.deleteObjects).toHaveBeenCalledWith([row?.storageKey]);
      expect(await prisma.projectFile.findUnique({where: {id: fileId}})).toBeNull();
    });

    it('deletes a folder and descendant file objects in the tree', async () => {
      const folder = await FileService.createFolder(projectId, {name: 'Assets'});
      const nested = await FileService.createFolder(projectId, {name: 'Nested', parentId: folder.id});
      const {fileId} = await FileService.requestUpload(projectId, {
        parentId: nested.id,
        fileName: 'logo.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });
      await FileService.confirmUpload(projectId, fileId);
      const file = await prisma.projectFile.findUnique({where: {id: fileId}});

      await FileService.delete(projectId, folder.id, apiKeyActor);

      expect(S3Service.deleteObjects).toHaveBeenCalledWith([file?.storageKey]);
      expect(await prisma.projectFile.count({where: {projectId}})).toBe(0);
    });

    it('keeps the database record when S3 deletion fails', async () => {
      const {fileId} = await FileService.requestUpload(projectId, {
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      await FileService.confirmUpload(projectId, fileId);
      vi.mocked(S3Service.deleteObjects).mockRejectedValueOnce(new Error('Failed to delete objects: key'));

      await expect(FileService.delete(projectId, fileId, apiKeyActor)).rejects.toThrow('Failed to delete objects');
      expect(await prisma.projectFile.findUnique({where: {id: fileId}})).not.toBeNull();
    });

    it('allows the creator to delete when trusted domains are not configured', async () => {
      const {user} = await factories.createUserWithProject();
      const folder = await FileService.createFolder(projectId, {name: 'Mine', createdById: user.id});

      await FileService.delete(projectId, folder.id, {
        type: 'jwt',
        userId: user.id,
        email: user.email,
        role: 'OWNER',
      });

      expect(await prisma.projectFile.findUnique({where: {id: folder.id}})).toBeNull();
    });

    it('blocks a non-creator when trusted domains are not configured', async () => {
      const {user: creator} = await factories.createUserWithProject();
      const {user: other} = await factories.createUserWithProject();
      const folder = await FileService.createFolder(projectId, {name: 'Theirs', createdById: creator.id});

      await expect(
        FileService.delete(projectId, folder.id, {
          type: 'jwt',
          userId: other.id,
          email: other.email,
          role: 'MEMBER',
        }),
      ).rejects.toBeInstanceOf(NotAllowed);

      expect(await prisma.projectFile.findUnique({where: {id: folder.id}})).not.toBeNull();
    });

    it('allows the creator to delete their own file when they are not on a trusted domain', async () => {
      const {user} = await factories.createUserWithProject({email: 'guest@example.com'});
      const folder = await FileService.createFolder(projectId, {name: 'Guest', createdById: user.id});
      vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
      vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(false);

      await FileService.delete(projectId, folder.id, {
        type: 'jwt',
        userId: user.id,
        email: user.email,
        role: 'MEMBER',
      });

      expect(await prisma.projectFile.findUnique({where: {id: folder.id}})).toBeNull();
    });

    it('does not delete a folder that contains files created by another user', async () => {
      const {user: owner} = await factories.createUserWithProject();
      const {user: other} = await factories.createUserWithProject();
      const folder = await FileService.createFolder(projectId, {name: 'Shared', createdById: owner.id});
      const {fileId} = await FileService.requestUpload(projectId, {
        parentId: folder.id,
        fileName: 'theirs.png',
        contentType: 'image/png',
        sizeBytes: 1024,
        createdById: other.id,
      });
      await FileService.confirmUpload(projectId, fileId);
      vi.mocked(S3Service.deleteObjects).mockClear();

      await expect(
        FileService.delete(projectId, folder.id, {
          type: 'jwt',
          userId: owner.id,
          email: owner.email,
          role: 'OWNER',
        }),
      ).rejects.toBeInstanceOf(NotAllowed);

      expect(S3Service.deleteObjects).not.toHaveBeenCalled();
      expect(await prisma.projectFile.findUnique({where: {id: folder.id}})).not.toBeNull();
      expect(await prisma.projectFile.findUnique({where: {id: fileId}})).not.toBeNull();
    });

    it('allows a trusted-domain user to delete a folder containing others files', async () => {
      const {user: owner} = await factories.createUserWithProject({email: 'owner@company.com'});
      const {user: other} = await factories.createUserWithProject();
      const folder = await FileService.createFolder(projectId, {name: 'Shared', createdById: owner.id});
      const {fileId} = await FileService.requestUpload(projectId, {
        parentId: folder.id,
        fileName: 'theirs.png',
        contentType: 'image/png',
        sizeBytes: 1024,
        createdById: other.id,
      });
      await FileService.confirmUpload(projectId, fileId);
      vi.mocked(AllowlistService.hasTrustedDomains).mockReturnValue(true);
      vi.mocked(AllowlistService.isTrustedDomain).mockReturnValue(true);

      await FileService.delete(projectId, folder.id, {
        type: 'jwt',
        userId: owner.id,
        email: owner.email,
        role: 'OWNER',
      });

      expect(await prisma.projectFile.findUnique({where: {id: folder.id}})).toBeNull();
      expect(await prisma.projectFile.findUnique({where: {id: fileId}})).toBeNull();
    });
  });

  describe('getOrCreateSystemFolder and registerUploadedObject', () => {
    it('creates a system folder once and reuses it', async () => {
      const first = await FileService.getOrCreateSystemFolder(projectId, 'Email images');
      const second = await FileService.getOrCreateSystemFolder(projectId, 'email images');

      expect(first.id).toBe(second.id);
      expect(first.name).toBe('Email images');
      expect(await prisma.projectFile.count({where: {projectId, kind: ProjectFileKind.FOLDER}})).toBe(1);
    });

    it('creates only one folder when called concurrently', async () => {
      const folders = await Promise.all(
        Array.from({length: 8}, () => FileService.getOrCreateSystemFolder(projectId, 'Quick uploads')),
      );

      const ids = new Set(folders.map(folder => folder.id));
      expect(ids.size).toBe(1);
      expect(await prisma.projectFile.count({where: {projectId, kind: ProjectFileKind.FOLDER}})).toBe(1);
    });

    it('registers an uploaded object and deduplicates sibling names', async () => {
      const folder = await FileService.getOrCreateSystemFolder(projectId, 'Email images');

      const first = await FileService.registerUploadedObject(projectId, {
        name: 'logo.png',
        storageKey: `${projectId}/legacy/logo.png`,
        contentType: 'image/png',
        sizeBytes: 512,
        folderId: folder.id,
      });
      const second = await FileService.registerUploadedObject(projectId, {
        name: 'logo.png',
        storageKey: `${projectId}/legacy/logo-2.png`,
        contentType: 'image/png',
        sizeBytes: 1024,
        folderId: folder.id,
      });

      expect(first.name).toBe('logo.png');
      expect(second.name).toBe('logo (2).png');
      expect(second.publicUrl).toBe(`https://cdn.example/${projectId}/legacy/logo-2.png`);
      expect(second.sizeBytes).toBe(1024);
    });

    it('sets canDelete when an actor is provided', async () => {
      const {user} = await factories.createUserWithProject();
      const folder = await FileService.getOrCreateSystemFolder(projectId, 'Email images');

      const item = await FileService.registerUploadedObject(
        projectId,
        {
          name: 'logo.png',
          storageKey: `${projectId}/legacy/logo.png`,
          contentType: 'image/png',
          sizeBytes: 512,
          folderId: folder.id,
          createdById: user.id,
        },
        {
          type: 'jwt',
          userId: user.id,
          email: user.email,
          role: 'MEMBER',
        },
      );

      expect(item.canDelete).toBe(true);
    });
  });

  describe('requestUpload systemFolder', () => {
    it('creates the Quick uploads folder and uses it as parent', async () => {
      const result = await FileService.requestUpload(projectId, {
        fileName: 'shot.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        systemFolder: 'quick-uploads',
      });

      const file = await prisma.projectFile.findUnique({where: {id: result.fileId}});
      const folder = await prisma.projectFile.findFirst({
        where: {projectId, name: 'Quick uploads', kind: ProjectFileKind.FOLDER},
      });

      expect(folder).toBeTruthy();
      expect(file?.parentId).toBe(folder?.id);
    });

    it('deduplicates names inside a system folder', async () => {
      await FileService.requestUpload(projectId, {
        fileName: 'shot.png',
        contentType: 'image/png',
        sizeBytes: 1024,
        systemFolder: 'quick-uploads',
      });
      const second = await FileService.requestUpload(projectId, {
        fileName: 'shot.png',
        contentType: 'image/png',
        sizeBytes: 2048,
        systemFolder: 'quick-uploads',
      });

      const row = await prisma.projectFile.findUnique({where: {id: second.fileId}});
      expect(row?.name).toBe('shot (2).png');
    });
  });

  describe('deletePreview', () => {
    it('returns exact counts for a nested folder tree', async () => {
      const folder = await FileService.createFolder(projectId, {name: 'Assets'});
      const nested = await FileService.createFolder(projectId, {name: 'Nested', parentId: folder.id});
      const {fileId} = await FileService.requestUpload(projectId, {
        parentId: nested.id,
        fileName: 'logo.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });
      await FileService.confirmUpload(projectId, fileId);
      const extra = await FileService.requestUpload(projectId, {
        parentId: folder.id,
        fileName: 'banner.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      });
      await FileService.confirmUpload(projectId, extra.fileId);

      const preview = await FileService.deletePreview(projectId, folder.id);

      expect(preview.kind).toBe('FOLDER');
      expect(preview.totalFiles).toBe(2);
      expect(preview.totalFolders).toBe(1);
      expect(preview.files.map(file => file.name).sort()).toEqual(['banner.png', 'logo.png']);
      expect(preview.truncated).toBe(false);
    });

    it('truncates the listed files while keeping exact totals', async () => {
      const folder = await FileService.createFolder(projectId, {name: 'Many'});
      for (const name of ['a.png', 'b.png', 'c.png']) {
        const upload = await FileService.requestUpload(projectId, {
          parentId: folder.id,
          fileName: name,
          contentType: 'image/png',
          sizeBytes: 100,
        });
        await FileService.confirmUpload(projectId, upload.fileId);
      }

      const preview = await FileService.deletePreview(projectId, folder.id, {listLimit: 2});

      expect(preview.totalFiles).toBe(3);
      expect(preview.files).toHaveLength(2);
      expect(preview.truncated).toBe(true);
    });

    it('rejects a file from another project', async () => {
      const {project: other} = await factories.createUserWithProject();
      const folder = await FileService.createFolder(projectId, {name: 'Assets'});

      await expect(FileService.deletePreview(other.id, folder.id)).rejects.toBeInstanceOf(NotFound);
    });
  });
});
