import type {Prisma} from '@prisma/client';
import type {AuditLogEntry, PaginatedResponse} from '@merlin/types';

import {prisma} from '../database/prisma.js';

type TransactionClient = Prisma.TransactionClient;

const MAX_PAGE_SIZE = 100;

export interface AuditRecordInput {
  action: string;
  actorId: string;
  actorEmail: string;
  targetEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  public static async list(page: number, pageSize: number): Promise<PaginatedResponse<AuditLogEntry>> {
    const effectivePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
    const effectivePage = Math.max(page, 1);
    const skip = (effectivePage - 1) * effectivePageSize;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: effectivePageSize,
        orderBy: {createdAt: 'desc'},
        select: {
          id: true,
          action: true,
          actorEmail: true,
          targetEmail: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      data: entries.map(entry => ({
        id: entry.id,
        action: entry.action,
        actorEmail: entry.actorEmail,
        targetEmail: entry.targetEmail,
        metadata: entry.metadata as Record<string, unknown> | null,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
      page: effectivePage,
      pageSize: effectivePageSize,
      totalPages: Math.ceil(total / effectivePageSize),
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
