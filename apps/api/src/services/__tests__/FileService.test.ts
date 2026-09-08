import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ProjectFileKind, ProjectFileStatus} from '@merlin/db';

import {BadRequest, ConflictError, NotFound} from '../../exceptions/index.js';
import {FileService} from '../FileService';
import * as S3Service from '../S3Service.js';
import {factories, getPrismaClient} from '../../../../../test/helpers';

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
      expect(result.nextCursor).toBeNull();
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

      await FileService.delete(projectId, fileId);

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

      await FileService.delete(projectId, folder.id);

      expect(S3Service.deleteObjects).toHaveBeenCalledWith([file?.storageKey]);
      expect(await prisma.projectFile.count({where: {projectId}})).toBe(0);
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
