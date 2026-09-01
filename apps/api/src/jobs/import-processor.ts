/**
 * Background Job: Contact Import Processor
 * Processes CSV contact imports with validation and batch processing
 */

import type {ContactImportJobData} from '@merlin/types';
import {type Job, Worker} from 'bullmq';
import {parse} from 'csv-parse/sync';
import signale from 'signale';

import {prisma} from '../database/prisma.js';
import {ContactService} from '../services/ContactService.js';
import {EventService} from '../services/EventService.js';
import {NtfyService} from '../services/NtfyService.js';
import {importQueue} from '../services/QueueService.js';

const BATCH_SIZE = 100; // Process contacts in batches of 100

interface ImportResult {
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  failureCount: number;
  errors: {row: number; email: string; error: string}[];
}

export function createImportWorker() {
  const worker = new Worker<ContactImportJobData>(
    importQueue.name,
    async (job: Job<ContactImportJobData>) => {
      const {projectId, csvData, filename, options} = job.data;
      const doubleOptIn = options?.doubleOptIn === true;
      const confirmationEventName = options?.confirmationEventName ?? 'contact.imported';

      signale.info(`[IMPORT-PROCESSOR] Processing import for project ${projectId} (${filename})`);

      // Fetch project information for notifications
      const project = await prisma.project.findUnique({
        where: {id: projectId},
        select: {name: true},
      });

      const projectName = project?.name || projectId;

      const result: ImportResult = {
        totalRows: 0,
        successCount: 0,
        createdCount: 0,
        updatedCount: 0,
        failureCount: 0,
        errors: [],
      };

      try {
        // Decode base64 CSV data
        const csvContent = Buffer.from(csvData, 'base64').toString('utf-8');

        // Parse CSV with column header normalization
        const records = parse(csvContent, {
          columns: (header: string[]) => header.map(h => h.toLowerCase()), // Normalize headers to lowercase
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true, // Allow rows with different column counts
        }) as Record<string, string>[];

        result.totalRows = records.length;

        // Validate row count
        if (records.length === 0) {
          throw new Error('CSV file is empty');
        }

        signale.info(`[IMPORT-PROCESSOR] Parsed ${records.length} rows from CSV`);

        // Notify that import has started
        await NtfyService.notifyContactImportStarted(projectName, projectId, filename, result.totalRows);

        // Validate that 'email' column exists (case-insensitive)
        const firstRecord = records[0];
        if (firstRecord && typeof firstRecord === 'object' && !('email' in firstRecord)) {
          throw new Error('CSV must have an "email" column (case-insensitive)');
        }

        // Process contacts in batches
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, Math.min(i + BATCH_SIZE, records.length));

          // Process batch sequentially (to avoid overwhelming the database)
          for (const [batchIndex, record] of batch.entries()) {
            const rowNumber = i + batchIndex + 2; // +2 for header row and 1-based index

            try {
              const rowResult = await processImportContactRow({
                projectId,
                record,
                doubleOptIn,
                confirmationEventName,
                filename,
              });

              if (!rowResult.success) {
                result.failureCount++;
                result.errors.push({
                  row: rowNumber,
                  email: rowResult.email,
                  error: rowResult.error,
                });
                continue;
              }

              result.successCount++;
              if (rowResult.isUpdate) {
                result.updatedCount++;
              } else {
                result.createdCount++;
              }
            } catch (error) {
              result.failureCount++;
              result.errors.push({
                row: rowNumber,
                email: record.email || '',
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }

          // Update progress
          const progress = Math.round(((i + batch.length) / records.length) * 100);
          await job.updateProgress(progress);
        }

        signale.info(
          `[IMPORT-PROCESSOR] Import completed: ${result.createdCount} created, ${result.updatedCount} updated, ${result.failureCount} failed`,
        );

        // Notify that import has completed
        await NtfyService.notifyContactImportCompleted(
          projectName,
          projectId,
          filename,
          result.successCount,
          result.createdCount,
          result.updatedCount,
          result.failureCount,
        );

        return result;
      } catch (error) {
        signale.error(`[IMPORT-PROCESSOR] Failed to process import:`, error);

        // Notify that import has failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await NtfyService.notifyContactImportFailed(projectName, projectId, filename, errorMessage);

        // Return partial results with error
        result.errors.push({
          row: 0,
          email: '',
          error: errorMessage,
        });

        throw error; // Re-throw to mark job as failed
      }
    },
    {
      connection: importQueue.opts.connection,
      concurrency: 2, // Process max 2 imports concurrently
    },
  );

  worker.on('completed', job => {
    signale.info(`[IMPORT-PROCESSOR] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    signale.error(`[IMPORT-PROCESSOR] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', err => {
    signale.error('[IMPORT-PROCESSOR] Worker error:', err);
  });

  return worker;
}

export interface ProcessImportContactRowParams {
  projectId: string;
  record: Record<string, string>;
  doubleOptIn: boolean;
  confirmationEventName: string;
  filename: string;
}

export type ProcessImportContactRowResult =
  | {success: true; isUpdate: boolean}
  | {success: false; email: string; error: string};

/**
 * Process a single CSV row during contact import.
 */
export async function processImportContactRow(
  params: ProcessImportContactRowParams,
): Promise<ProcessImportContactRowResult> {
  const {projectId, record, doubleOptIn, confirmationEventName, filename} = params;

  const email = record.email?.trim();
  if (!email) {
    return {success: false, email: '', error: 'Email is required'};
  }

  if (!isValidEmail(email)) {
    return {success: false, email, error: 'Invalid email format'};
  }

  const subscribedValue = record.subscribed;
  let subscribed: boolean | undefined;

  if (!doubleOptIn) {
    if (subscribedValue !== undefined && subscribedValue !== '') {
      const lowerValue = subscribedValue.toLowerCase().trim();
      subscribed = lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
    }
  }

  const {email: _, subscribed: __, ...customData} = record;
  const customEntries = Object.entries(customData);
  const data =
    customEntries.length > 0
      ? Object.fromEntries(customEntries.map(([k, v]) => [k, coerceCustomValue(v)]))
      : undefined;

  const existingContact = await ContactService.findByEmail(projectId, email);
  const isUpdate = !!existingContact;

  const contact = doubleOptIn
    ? await ContactService.upsert(projectId, email, data, undefined, false)
    : await ContactService.upsert(projectId, email, data, subscribed);

  if (doubleOptIn && !isUpdate) {
    await EventService.trackEvent(projectId, confirmationEventName, contact.id, undefined, {
      source: 'import',
      filename,
    });
  }

  return {success: true, isUpdate};
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Values considered as boolean during import.
// Numbers (0, 1) are intentionally absent.
const BOOLEAN_TRUE = new Set(['true', 'yes']);
const BOOLEAN_FALSE = new Set(['false', 'no']);

// Strict integer-or-decimal number detection pattern.
// Valid: 0, 42, -42, 3.14
// Rejected: 007, +42, 1.2.3, 1e5
const NUMERIC_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/**
 * Coerces a raw string into its most natural primitive type: `boolean`,
 * `number`, or `string`. Values that match neither are
 * returned unchanged.
 *
 * @param value The raw string to coerce.
 * @returns The coerced value as `boolean`, `number`, or `string`.
 */
export function coerceCustomValue(value: string): string | boolean | number {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (BOOLEAN_TRUE.has(lower)) return true;
  if (BOOLEAN_FALSE.has(lower)) return false;
  if (NUMERIC_RE.test(trimmed)) return Number(trimmed);
  return value;
}
