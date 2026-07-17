import type {Prisma} from '@prisma/client';
import type {PendingMember} from '@merlin/types';
import signale from 'signale';

import {prisma} from '../database/prisma.js';
import {HttpException} from '../exceptions/index.js';
import {normalizeEmail} from '../utils/email.js';
import {AllowlistService} from './AllowlistService.js';
import {MembershipService} from './MembershipService.js';
import {UserService} from './UserService.js';

type TransactionClient = Prisma.TransactionClient;

export class ProjectShareService {
  /**
   * Share projects with an email address. If the user already exists, create memberships immediately.
   * Otherwise, store pending shares to be materialized on signup/login.
   *
   * When called inside a transaction, returns cache invalidation targets for the caller to apply after commit.
   */
  public static async shareWithEmail(
    email: string,
    projectIds: string[],
    role: 'ADMIN' | 'MEMBER',
    addedById: string,
    tx?: TransactionClient,
  ): Promise<Array<{userId: string; projectId: string}>> {
    if (projectIds.length === 0) {
      return [];
    }

    const db = tx ?? prisma;
    const normalized = normalizeEmail(email);
    const effectiveRole = AllowlistService.resolveEffectiveRole(normalized, role);
    const existingUser = tx
      ? await db.user.findFirst({
          where: {
            email: {
              equals: normalized,
              mode: 'insensitive',
            },
          },
        })
      : await UserService.email(normalized);

    const cacheInvalidations: Array<{userId: string; projectId: string}> = [];

    for (const projectId of projectIds) {
      if (existingUser) {
        const membership = await db.membership.findUnique({
          where: {
            userId_projectId: {
              userId: existingUser.id,
              projectId,
            },
          },
        });

        if (!membership) {
          await db.membership.create({
            data: {
              userId: existingUser.id,
              projectId,
              role: effectiveRole,
            },
          });
          cacheInvalidations.push({userId: existingUser.id, projectId});
        }
      } else {
        await db.pendingProjectShare.upsert({
          where: {
            email_projectId: {
              email: normalized,
              projectId,
            },
          },
          create: {
            email: normalized,
            projectId,
            role: effectiveRole,
            addedById,
          },
          update: {
            role: effectiveRole,
            addedById,
          },
        });
      }
    }

    if (!tx) {
      await MembershipService.invalidateCaches(cacheInvalidations);
    }

    return cacheInvalidations;
  }

  /**
   * Materialize pending project shares for a user after signup/login.
   */
  public static async materializePendingShares(userId: string, email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const pendingShares = await prisma.pendingProjectShare.findMany({
      where: {email: normalized},
    });

    if (pendingShares.length === 0) {
      return;
    }

    const cacheInvalidations: Array<{userId: string; projectId: string}> = [];

    for (const share of pendingShares) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId: share.projectId,
          },
        },
      });

      if (!membership) {
        const effectiveRole = AllowlistService.resolveEffectiveRole(normalized, share.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
        await prisma.membership.create({
          data: {
            userId,
            projectId: share.projectId,
            role: effectiveRole,
          },
        });
        cacheInvalidations.push({userId, projectId: share.projectId});
      }
    }

    await prisma.pendingProjectShare.deleteMany({
      where: {email: normalized},
    });

    await MembershipService.invalidateCaches(cacheInvalidations);
  }

  /**
   * Best-effort materialization on login; never blocks authentication.
   */
  public static async tryMaterializePendingShares(userId: string, email: string): Promise<void> {
    try {
      await ProjectShareService.materializePendingShares(userId, email);
    } catch (error) {
      signale.error('[ProjectShare] Failed to materialize pending shares:', error);
    }
  }

  /**
   * List projects where the user has admin or owner access (for allowlist share picker).
   */
  public static async listShareableProjects(userId: string): Promise<Array<{id: string; name: string}>> {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        role: {
          in: ['ADMIN', 'OWNER'],
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        project: {
          name: 'asc',
        },
      },
    });

    return memberships.map(m => ({
      id: m.project.id,
      name: m.project.name,
    }));
  }

  /**
   * List pending project shares for a project (emails without accounts yet).
   */
  public static async listPendingShares(projectId: string): Promise<PendingMember[]> {
    const shares = await prisma.pendingProjectShare.findMany({
      where: {projectId},
      orderBy: {createdAt: 'desc'},
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return shares;
  }

  /**
   * Revoke a pending project share scoped to a project.
   */
  public static async revokePendingShare(projectId: string, shareId: string): Promise<void> {
    const result = await prisma.pendingProjectShare.deleteMany({
      where: {
        id: shareId,
        projectId,
      },
    });

    if (result.count === 0) {
      throw new HttpException(404, 'Pending invite not found');
    }
  }
}
