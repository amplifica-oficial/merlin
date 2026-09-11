import {randomUUID} from 'node:crypto';

import type {LandingPage} from '@merlin/db';
import {Prisma} from '@merlin/db';
import {classifyLandingPageSlug, isLandingPageUuidShape} from '@merlin/shared';
import type {LandingPageSlugReason} from '@merlin/shared';
import type {LandingPageSettings, PublicLandingPageConfig, PuckData} from '@merlin/types';
import {fromPrismaJson, toPrismaJson} from '@merlin/types';

import {prisma} from '../database/prisma.js';
import {redis, TEN_MINUTES_IN_SECONDS, wrapRedis} from '../database/redis.js';
import {HttpException} from '../exceptions/index.js';
import {Keys} from './keys.js';

export type LandingPageSlugAvailability = {
  available: boolean;
  reason?: LandingPageSlugReason;
};

export class LandingPageService {
  public static async list(projectId: string): Promise<LandingPage[]> {
    return prisma.landingPage.findMany({
      where: {projectId},
      orderBy: {createdAt: 'desc'},
    });
  }

  public static async get(projectId: string, landingPageId: string): Promise<LandingPage> {
    const page = await prisma.landingPage.findFirst({
      where: {id: landingPageId, projectId},
    });

    if (!page) {
      throw new HttpException(404, 'Landing page not found');
    }

    return page;
  }

  public static async create(
    projectId: string,
    data: {
      name: string;
      slug: string;
      data: PuckData;
      settings: LandingPageSettings;
      published?: boolean;
    },
  ): Promise<LandingPage> {
    await this.assertSlugAvailable(data.slug);

    try {
      return await prisma.landingPage.create({
        data: {
          projectId,
          publicId: randomUUID(),
          slug: data.slug,
          name: data.name,
          data: toPrismaJson(data.data),
          settings: toPrismaJson(data.settings),
          published: data.published ?? false,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new HttpException(409, 'This slug is already taken');
      }
      throw error;
    }
  }

  public static async update(
    projectId: string,
    landingPageId: string,
    data: {
      name?: string;
      slug?: string;
      data?: PuckData;
      settings?: LandingPageSettings;
      published?: boolean;
    },
  ): Promise<LandingPage> {
    const existing = await this.get(projectId, landingPageId);

    if (data.slug !== undefined && data.slug !== existing.slug) {
      await this.assertSlugAvailable(data.slug, landingPageId);
    }

    const updateData: Prisma.LandingPageUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined && data.slug !== existing.slug) updateData.slug = data.slug;
    if (data.data !== undefined) updateData.data = toPrismaJson(data.data);
    if (data.settings !== undefined) {
      const merged = {
        ...fromPrismaJson<LandingPageSettings>(existing.settings),
        ...data.settings,
      };
      updateData.settings = toPrismaJson(merged);
    }
    if (data.published !== undefined) updateData.published = data.published;

    let updated: LandingPage;
    try {
      updated = await prisma.landingPage.update({
        where: {id: landingPageId},
        data: updateData,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new HttpException(409, 'This slug is already taken');
      }
      throw error;
    }

    await this.invalidatePublicCache(existing.publicId, existing.slug, data.slug);

    return updated;
  }

  public static async delete(projectId: string, landingPageId: string): Promise<void> {
    const existing = await this.get(projectId, landingPageId);
    await prisma.landingPage.delete({where: {id: landingPageId}});
    await this.invalidatePublicCache(existing.publicId, existing.slug);
  }

  public static async getPublicConfig(identifier: string): Promise<PublicLandingPageConfig> {
    return wrapRedis(
      Keys.LandingPage.public(identifier),
      () => this.fetchPublicConfig(identifier),
      TEN_MINUTES_IN_SECONDS,
    );
  }

  public static async isSlugAvailable(slug: string, excludeId?: string): Promise<LandingPageSlugAvailability> {
    const classification = classifyLandingPageSlug(slug);
    if (classification === 'invalid') {
      return {available: false, reason: 'invalid'};
    }
    if (classification === 'reserved') {
      return {available: false, reason: 'reserved'};
    }

    const existing = await prisma.landingPage.findFirst({
      where: {
        slug,
        ...(excludeId ? {NOT: {id: excludeId}} : {}),
      },
      select: {id: true},
    });

    if (existing) {
      return {available: false, reason: 'taken'};
    }

    return {available: true};
  }

  private static pickPublicSettings(settings: LandingPageSettings): LandingPageSettings {
    return {
      title: settings.title,
      description: settings.description,
      faviconUrl: settings.faviconUrl,
      canonicalUrl: settings.canonicalUrl,
      ogTitle: settings.ogTitle,
      ogDescription: settings.ogDescription,
      ogImageUrl: settings.ogImageUrl,
      twitterCard: settings.twitterCard,
      gtmId: settings.gtmId,
      ga4Id: settings.ga4Id,
      fbPixelId: settings.fbPixelId,
    };
  }

  private static async fetchPublicConfig(identifier: string): Promise<PublicLandingPageConfig> {
    const page = await prisma.landingPage.findFirst({
      where: isLandingPageUuidShape(identifier)
        ? {publicId: identifier, published: true}
        : {slug: identifier, published: true},
      include: {
        project: {
          select: {disabled: true},
        },
      },
    });

    if (!page || page.project.disabled) {
      throw new HttpException(404, 'Landing page not found');
    }

    const settings = fromPrismaJson<LandingPageSettings>(page.settings);
    const puckData = fromPrismaJson<PuckData>(page.data);

    return {
      publicId: page.publicId,
      slug: page.slug,
      name: page.name,
      data: puckData,
      settings: this.pickPublicSettings(settings),
    };
  }

  private static async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const result = await this.isSlugAvailable(slug, excludeId);

    if (result.available) {
      return;
    }

    if (result.reason === 'reserved') {
      throw new HttpException(400, 'Slug cannot be a UUID');
    }

    if (result.reason === 'invalid') {
      throw new HttpException(400, 'Slug must be lowercase alphanumeric with hyphens');
    }

    throw new HttpException(409, 'This slug is already taken');
  }

  private static async invalidatePublicCache(publicId: string, ...slugs: Array<string | undefined>): Promise<void> {
    const keys = [Keys.LandingPage.public(publicId)];

    for (const slug of slugs) {
      if (slug) {
        keys.push(Keys.LandingPage.public(slug));
      }
    }

    await redis.del(...new Set(keys));
  }
}
