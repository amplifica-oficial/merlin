import type {Prisma} from '@prisma/client';
import type {AuditLogEntry, CursorPaginatedResponse} from '@merlin/types';

import {prisma} from '../database/prisma.js';

type TransactionClient = Prisma.TransactionClient;

const DEFAULT_LIMIT = 20;
const MAX_PAGE_SIZE = 100;

export interface AuditRecordInput {
  action: string;
  actorId: string;
  actorEmail: string;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  public static async list(limit = DEFAULT_LIMIT, cursor?: string): Promise<CursorPaginatedResponse<AuditLogEntry>> {
    const effectiveLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);

    const entries = await prisma.auditLog.findMany({
      take: effectiveLimit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {id: cursor} : undefined,
      orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
      select: {
        id: true,
        action: true,
        actorEmail: true,
        targetEmail: true,
        metadata: true,
        createdAt: true,
      },
    });

    const hasMore = entries.length > effectiveLimit;
    const results = hasMore ? entries.slice(0, -1) : entries;
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

    const total = !cursor ? await prisma.auditLog.count() : undefined;

    return {
      data: results.map(entry => ({
        id: entry.id,
        action: entry.action,
        actorEmail: entry.actorEmail,
        targetEmail: entry.targetEmail,
        metadata: entry.metadata as Record<string, unknown> | null,
        createdAt: entry.createdAt.toISOString(),
      })),
      cursor: nextCursor,
      hasMore,
      total,
    };
  }

  public static async record(tx: TransactionClient, input: AuditRecordInput): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        targetEmail: input.targetEmail ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
