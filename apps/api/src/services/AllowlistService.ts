import {ALLOWLIST_OPEN, ALLOWLIST_TRUSTED_DOMAINS} from '../app/constants.js';
import {prisma} from '../database/prisma.js';
import {BadRequest, NotFound} from '../exceptions/index.js';
import {normalizeEmail} from '../utils/email.js';
import {AuditService} from './AuditService.js';
import {MembershipService} from './MembershipService.js';
import {ProjectShareService} from './ProjectShareService.js';

function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return '';
  }

  return email.slice(atIndex + 1);
}

export class AllowlistService {
  public static hasTrustedDomains(): boolean {
    return ALLOWLIST_TRUSTED_DOMAINS.length > 0;
  }

  public static isTrustedDomain(email: string): boolean {
    const domain = extractDomain(normalizeEmail(email));
    if (!domain || !AllowlistService.hasTrustedDomains()) {
      return false;
    }

    return ALLOWLIST_TRUSTED_DOMAINS.includes(domain);
  }

  public static resolveEffectiveRole(email: string, requested: 'ADMIN' | 'MEMBER'): 'ADMIN' | 'MEMBER' {
    return AllowlistService.isTrustedDomain(email) ? requested : 'MEMBER';
  }

  public static async isAllowlisted(email: string): Promise<boolean> {
    const normalized = normalizeEmail(email);
    const entry = await prisma.allowlistedEmail.findUnique({
      where: {email: normalized},
      select: {id: true},
    });

    return entry !== null;
  }

  public static async isSignupAllowed(email: string): Promise<boolean> {
    if (ALLOWLIST_OPEN) {
      return true;
    }

    if (AllowlistService.isTrustedDomain(email)) {
      return true;
    }

    return AllowlistService.isAllowlisted(email);
  }

  public static async list() {
    const entries = await prisma.allowlistedEmail.findMany({
      orderBy: {createdAt: 'desc'},
      include: {
        addedBy: {
          select: {email: true},
        },
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      email: entry.email,
      addedByEmail: entry.addedBy?.email ?? null,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  public static async add(
    email: string,
    addedById: string,
    options?: {projectIds?: string[]},
  ): Promise<{entry: {id: string; email: string; addedByEmail: string | null; createdAt: string}; created: boolean}> {
    const normalized = normalizeEmail(email);

    if (AllowlistService.isTrustedDomain(normalized)) {
      throw new BadRequest('This email already belongs to a trusted domain and does not need to be allowlisted');
    }

    const projectIds = options?.projectIds ?? [];
    const role = 'MEMBER' as const;

    const {entry, created, cacheInvalidations} = await prisma.$transaction(async tx => {
      const existing = await tx.allowlistedEmail.findUnique({
        where: {email: normalized},
        include: {
          addedBy: {
            select: {email: true},
          },
        },
      });

      let allowlistEntry = existing;
      let wasCreated = false;

      if (!allowlistEntry) {
        allowlistEntry = await tx.allowlistedEmail.create({
          data: {
            email: normalized,
            addedById,
          },
          include: {
            addedBy: {
              select: {email: true},
            },
          },
        });
        wasCreated = true;
      }

      const invalidations =
        projectIds.length > 0
          ? await ProjectShareService.shareWithEmail(normalized, projectIds, role, addedById, tx)
          : [];

      const actor = await tx.user.findUnique({
        where: {id: addedById},
        select: {email: true},
      });

      await AuditService.record(tx, {
        action: 'allowlist.add',
        actorId: addedById,
        actorEmail: actor?.email ?? '',
        targetEmail: normalized,
        metadata: {
          created: wasCreated,
          projectIds,
        },
      });

      return {
        entry: allowlistEntry,
        created: wasCreated,
        cacheInvalidations: invalidations,
      };
    });

    await MembershipService.invalidateCaches(cacheInvalidations);

    return {
      entry: {
        id: entry.id,
        email: entry.email,
        addedByEmail: entry.addedBy?.email ?? null,
        createdAt: entry.createdAt.toISOString(),
      },
      created,
    };
  }

  public static async remove(id: string, actor: {id: string; email: string}) {
    const entry = await prisma.allowlistedEmail.findUnique({
      where: {id},
      select: {id: true, email: true},
    });

    if (!entry) {
      throw new NotFound('Allowlisted email not found');
    }

    const cacheInvalidations = await prisma.$transaction(async tx => {
      const user = await tx.user.findFirst({
        where: {
          email: {
            equals: entry.email,
            mode: 'insensitive',
          },
        },
        select: {id: true},
      });

      const invalidations: Array<{userId: string; projectId: string}> = [];

      if (user) {
        const memberships = await tx.membership.findMany({
          where: {
            userId: user.id,
            role: {
              not: 'OWNER',
            },
          },
          select: {
            userId: true,
            projectId: true,
          },
        });

        invalidations.push(...memberships);

        // Intentional: removing an email from the allowlist revokes that user's access
        // across the entire instance (all non-OWNER memberships). Allowlist managers
        // use this to fully de-authorize an external collaborator, not just one project.
        await tx.membership.deleteMany({
          where: {
            userId: user.id,
            role: {
              not: 'OWNER',
            },
          },
        });
      }

      await tx.allowlistedEmail.delete({
        where: {id},
      });

      await tx.pendingProjectShare.deleteMany({
        where: {email: entry.email},
      });

      const projectIds = [...new Set(invalidations.map(invalidation => invalidation.projectId))];

      await AuditService.record(tx, {
        action: 'allowlist.remove',
        actorId: actor.id,
        actorEmail: actor.email,
        targetEmail: entry.email,
        metadata: {
          removedMembershipCount: invalidations.length,
          projectIds,
        },
      });

      return invalidations;
    });

    await MembershipService.invalidateCaches(cacheInvalidations);
  }
}
