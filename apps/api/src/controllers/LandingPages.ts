import {Controller, Delete, Get, Middleware, Patch, Post} from '@overnightjs/core';
import {LandingPageAiSchemas, LandingPageSchemas} from '@merlin/shared';
import type {LandingPageSettings, PuckData} from '@merlin/types';
import type {NextFunction, Request, Response} from 'express';

import {LANDING_AI_RATE_LIMIT_PER_MINUTE} from '../app/constants.js';
import {redis} from '../database/redis.js';
import {ErrorCode, HttpException, RateLimitError} from '../exceptions/index.js';
import {requireAuth, requireEmailVerified} from '../middleware/auth.js';
import {Keys} from '../services/keys.js';
import {isLandingAiEnabled, isUserTurn, LandingPageAiService} from '../services/LandingPageAiService.js';
import {LandingPageService} from '../services/LandingPageService.js';
import {CatchAsync} from '../utils/asyncHandler.js';

const SLUG_CHECK_RATE_LIMIT = 60;
const SLUG_CHECK_RATE_WINDOW_SECONDS = 60;

@Controller('landing-pages')
export class LandingPages {
  /**
   * GET /landing-pages/public/:slug
   * PUBLIC: Get landing page configuration for rendering (no auth required).
   * `slug` is the vanity slug; a UUID publicId still resolves for legacy links.
   */
  @Get('public/:slug')
  @CatchAsync
  public async getPublic(req: Request, res: Response, _next: NextFunction) {
    const slug = req.params.slug;

    if (!slug) {
      return res.status(400).json({error: 'Landing page slug is required'});
    }

    const config = await LandingPageService.getPublicConfig(slug);
    return res.status(200).json(config);
  }

  /**
   * GET /landing-pages
   * List all landing pages for the authenticated project
   */
  @Get('')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async list(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const pages = await LandingPageService.list(auth.projectId!);
    return res.status(200).json(pages);
  }

  /**
   * GET /landing-pages/slug-available
   * Check whether a vanity slug is free (global uniqueness)
   */
  @Get('slug-available')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async slugAvailable(req: Request, res: Response, _next: NextFunction) {
    const projectId = res.locals.auth.projectId!;
    const key = Keys.LandingPage.slugCheckRateLimit(projectId);
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, SLUG_CHECK_RATE_WINDOW_SECONDS);
    }

    if (count > SLUG_CHECK_RATE_LIMIT) {
      throw new RateLimitError('Too many slug checks. Please try again later.');
    }

    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;

    const result = await LandingPageService.isSlugAvailable(slug, excludeId);
    return res.status(200).json(result);
  }

  /**
   * GET /landing-pages/ai/config
   * Whether the landing page AI editor is enabled for this instance
   */
  @Get('ai/config')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async aiConfig(_req: Request, res: Response, _next: NextFunction) {
    return res.status(200).json({enabled: isLandingAiEnabled()});
  }

  /**
   * POST /landing-pages/:id/ai/chat
   * Stream an AI editor turn (client-side tools)
   */
  @Post(':id/ai/chat')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async aiChat(req: Request, res: Response, _next: NextFunction) {
    if (!isLandingAiEnabled()) {
      throw new HttpException(
        503,
        'Landing page AI is not configured. Set OPENAI_API_KEY.',
        ErrorCode.EXTERNAL_SERVICE_ERROR,
      );
    }

    const auth = res.locals.auth;
    const landingPageId = req.params.id;

    if (!landingPageId) {
      return res.status(400).json({error: 'Landing page ID is required'});
    }

    await LandingPageService.get(auth.projectId!, landingPageId);

    const payload = LandingPageAiSchemas.chat.parse(req.body);

    if (isUserTurn(payload.messages)) {
      const key = Keys.LandingPage.aiChatRateLimit(auth.projectId!);
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, 60);
      }

      if (count > LANDING_AI_RATE_LIMIT_PER_MINUTE) {
        throw new RateLimitError('Too many AI requests. Please try again later.');
      }
    }

    await LandingPageAiService.streamChat(res, payload);
  }

  /**
   * POST /landing-pages
   * Create a new landing page
   */
  @Post('')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async create(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const data = LandingPageSchemas.create.parse(req.body);

    const page = await LandingPageService.create(auth.projectId!, {
      name: data.name,
      slug: data.slug,
      data: data.data as PuckData,
      settings: data.settings as LandingPageSettings,
      published: data.published,
    });

    return res.status(201).json(page);
  }

  /**
   * GET /landing-pages/:id
   * Get a specific landing page by ID
   */
  @Get(':id')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async get(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const landingPageId = req.params.id;

    if (!landingPageId) {
      return res.status(400).json({error: 'Landing page ID is required'});
    }

    const page = await LandingPageService.get(auth.projectId!, landingPageId);
    return res.status(200).json(page);
  }

  /**
   * PATCH /landing-pages/:id
   * Update a landing page
   */
  @Patch(':id')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async update(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const landingPageId = req.params.id;

    if (!landingPageId) {
      return res.status(400).json({error: 'Landing page ID is required'});
    }

    const data = LandingPageSchemas.update.parse(req.body);

    const page = await LandingPageService.update(auth.projectId!, landingPageId, {
      name: data.name,
      slug: data.slug,
      data: data.data as PuckData | undefined,
      settings: data.settings as LandingPageSettings | undefined,
      published: data.published,
    });

    return res.status(200).json(page);
  }

  /**
   * DELETE /landing-pages/:id
   * Delete a landing page
   */
  @Delete(':id')
  @Middleware([requireAuth, requireEmailVerified])
  @CatchAsync
  public async delete(req: Request, res: Response, _next: NextFunction) {
    const auth = res.locals.auth;
    const landingPageId = req.params.id;

    if (!landingPageId) {
      return res.status(400).json({error: 'Landing page ID is required'});
    }

    await LandingPageService.delete(auth.projectId!, landingPageId);
    return res.status(204).send();
  }
}
