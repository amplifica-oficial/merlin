import {Controller, Delete, Get, Middleware, Post} from '@overnightjs/core';
import type {SystemFolderKey} from '@merlin/types';
import type {NextFunction, Request, Response} from 'express';

import {requireAuth, requireEmailVerified} from '../middleware/auth.js';
import {FileService, SYSTEM_FOLDER_NAMES} from '../services/FileService.js';
import * as S3Service from '../services/S3Service.js';
import {CatchAsync} from '../utils/asyncHandler.js';

function isSystemFolderKey(value: unknown): value is SystemFolderKey {
  return typeof value === 'string' && value in SYSTEM_FOLDER_NAMES;
}

function parseOptionalId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Controller('files')
export class Files {
  /**
   * GET /files
   * List files and folders in the current directory.
   *
   * Query params:
   * - folder: parent folder id (omit for root)
   * - search: filter by name in the current folder
   * - cursor: pagination cursor
   * - limit: page size (default 50, max 100)
   */
  @Get('')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async list(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const folderId = parseOptionalId(req.query.folder);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const cursor = parseOptionalId(req.query.cursor);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const result = await FileService.list(auth.projectId!, {folderId, search, cursor, limit});
    return res.status(200).json(result);
  }

  /**
   * POST /files/folders
   * Create a folder in the current directory.
   */
  @Post('folders')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async createFolder(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const {name, parentId} = req.body as {name?: string; parentId?: string | null};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({error: 'Folder name is required.'});
    }

    const folder = await FileService.createFolder(auth.projectId!, {
      name,
      parentId: parseOptionalId(parentId),
    });

    return res.status(201).json(folder);
  }

  /**
   * POST /files/uploads
   * Create a pending file record and return a presigned PUT URL.
   */
  @Post('uploads')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async requestUpload(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const {fileName, contentType, sizeBytes, parentId, systemFolder} = req.body as {
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
      parentId?: string | null;
      systemFolder?: string;
    };

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({error: 'File name is required.'});
    }
    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({error: 'Content type is required.'});
    }
    if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes)) {
      return res.status(400).json({error: 'File size is required.'});
    }
    if (systemFolder != null && !isSystemFolderKey(systemFolder)) {
      return res.status(400).json({error: 'Invalid system folder.'});
    }

    const result = await FileService.requestUpload(auth.projectId!, {
      fileName,
      contentType,
      sizeBytes,
      parentId: parseOptionalId(parentId),
      systemFolder,
    });

    return res.status(201).json(result);
  }

  /**
   * POST /files/uploads/:id/confirm
   * Confirm a presigned upload after the object exists in S3.
   */
  @Post('uploads/:id/confirm')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async confirmUpload(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const fileId = req.params.id;

    if (!fileId) {
      return res.status(400).json({error: 'File ID is required.'});
    }

    const file = await FileService.confirmUpload(auth.projectId!, fileId);
    return res.status(200).json(file);
  }

  /**
   * GET /files/:id/delete-preview
   * Count descendants and return a capped file list before deleting a folder.
   */
  @Get(':id/delete-preview')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async deletePreview(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const fileId = req.params.id;

    if (!fileId) {
      return res.status(400).json({error: 'File ID is required.'});
    }

    const preview = await FileService.deletePreview(auth.projectId!, fileId);
    return res.status(200).json(preview);
  }

  /**
   * DELETE /files/:id
   * Delete a file or folder (and descendants).
   */
  @Delete(':id')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async delete(req: Request, res: Response, _next: NextFunction) {
    if (!S3Service.isS3Enabled()) {
      return res.status(400).json({error: 'File storage is not enabled.'});
    }

    const auth = res.locals.auth;
    const fileId = req.params.id;

    if (!fileId) {
      return res.status(400).json({error: 'File ID is required.'});
    }

    await FileService.delete(auth.projectId!, fileId);
    return res.status(204).send();
  }
}
