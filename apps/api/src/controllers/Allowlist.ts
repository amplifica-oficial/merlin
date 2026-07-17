import {Controller, Delete, Get, Middleware, Post} from '@overnightjs/core';
import {AllowlistSchemas, UtilitySchemas} from '@merlin/shared';
import type {NextFunction, Request, Response} from 'express';

import {isAuthenticated, requireEmailVerified, requireTrustedDomain} from '../middleware/auth.js';
import {AuditService} from '../services/AuditService.js';
import {AllowlistService} from '../services/AllowlistService.js';
import {MembershipService} from '../services/MembershipService.js';
import {ProjectShareService} from '../services/ProjectShareService.js';
import {UserService} from '../services/UserService.js';
import {NotAuthenticated} from '../exceptions/index.js';
import {CatchAsync} from '../utils/asyncHandler.js';

@Controller('allowlist')
export class Allowlist {
  @Get('')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async list(_req: Request, res: Response, _next: NextFunction) {
    const data = await AllowlistService.list();

    return res.status(200).json({success: true, data});
  }

  @Get('shareable-projects')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async shareableProjects(_req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const data = await ProjectShareService.listShareableProjects(auth.userId!);

    return res.status(200).json({success: true, data});
  }

  @Get('audit-logs')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async auditLogs(req: Request, res: Response, _next: NextFunction) {
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await AuditService.list(limit, cursor);

    return res.status(200).json({success: true, ...result});
  }

  @Post('')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async add(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {email, projectIds} = AllowlistSchemas.add.parse(req.body);

    for (const projectId of projectIds ?? []) {
      await MembershipService.requireAdminAccess(auth.userId!, projectId);
    }

    const {entry, created} = await AllowlistService.add(email, auth.userId!, {
      projectIds,
    });

    return res.status(created ? 201 : 200).json({success: true, data: entry});
  }

  @Delete(':id')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async remove(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {id} = UtilitySchemas.id.parse(req.params);

    const actor = await UserService.id(auth.userId!);
    if (!actor) {
      throw new NotAuthenticated();
    }

    await AllowlistService.remove(id, {id: actor.id, email: actor.email});

    return res.status(200).json({success: true});
  }
}
