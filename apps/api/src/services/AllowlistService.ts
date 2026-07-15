import {ALLOWLIST_OPEN, ALLOWLIST_TRUSTED_DOMAINS} from '../app/constants.js';
import {prisma} from '../database/prisma.js';
import {BadRequest, HttpException, NotFound} from '../exceptions/index.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return '';
  }

  return email.slice(atIndex + 1);
}

export class AllowlistService {
  public static isTrustedDomain(email: string): boolean {
    const domain = extractDomain(normalizeEmail(email));
    if (!domain || ALLOWLIST_TRUSTED_DOMAINS.length === 0) {
      return false;
    }

    return ALLOWLIST_TRUSTED_DOMAINS.includes(domain);
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

  public static async add(email: string, addedById: string) {
    const normalized = normalizeEmail(email);

    if (AllowlistService.isTrustedDomain(normalized)) {
      throw new BadRequest('This email already belongs to a trusted domain and does not need to be allowlisted');
    }

    const existing = await prisma.allowlistedEmail.findUnique({
      where: {email: normalized},
      select: {id: true},
    });

    if (existing) {
      throw new HttpException(409, 'This email is already on the allowlist');
    }

    const entry = await prisma.allowlistedEmail.create({
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

    return {
      id: entry.id,
      email: entry.email,
      addedByEmail: entry.addedBy?.email ?? null,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  public static async remove(id: string) {
    const entry = await prisma.allowlistedEmail.findUnique({
      where: {id},
      select: {id: true},
    });

    if (!entry) {
      throw new NotFound('Allowlisted email not found');
    }

    await prisma.allowlistedEmail.delete({
      where: {id},
    });
  }
}
