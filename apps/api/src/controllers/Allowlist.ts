import {Controller, Delete, Get, Middleware, Post} from '@overnightjs/core';
import {AllowlistSchemas, UtilitySchemas} from '@merlin/shared';
import type {NextFunction, Request, Response} from 'express';

import {isAuthenticated, requireEmailVerified, requireTrustedDomain} from '../middleware/auth.js';
import {AllowlistService} from '../services/AllowlistService.js';
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

  @Post('')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async add(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const {email} = AllowlistSchemas.add.parse(req.body);
    const data = await AllowlistService.add(email, auth.userId!);

    return res.status(201).json({success: true, data});
  }

  @Delete(':id')
  @Middleware([isAuthenticated, requireEmailVerified, requireTrustedDomain])
  @CatchAsync
  public async remove(req: Request, res: Response, _next: NextFunction) {
    const {id} = UtilitySchemas.id.parse(req.params);
    await AllowlistService.remove(id);

    return res.status(200).json({success: true});
  }
}
