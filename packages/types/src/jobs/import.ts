/**
 * Import and bulk operation queue job data types
 */

/**
 * Options for contact CSV import jobs
 */
export interface ContactImportOptions {
  /** When true, new contacts are created unsubscribed and receive a confirmation email */
  doubleOptIn?: boolean;
  /** Event name emitted for each newly imported contact (default: contact.imported) */
  confirmationEventName?: string;
  /** Transactional template used for the confirmation email */
  confirmationTemplateId?: string;
}

/**
 * Job data for importing contacts from CSV
 * Used by: importQueue worker
 */
export interface ContactImportJobData {
  projectId: string;
  csvData: string; // Base64 encoded CSV content
  filename: string;
  options?: ContactImportOptions;
}

/**
 * Selector describing which contacts a bulk action should target.
 * - `ids`: explicit list, hard-capped at 1000.
 * - `query`: every contact matching the filter, optionally excluding specific ids.
 *   Snapshot semantics: the worker iterates current matches at execution time, so
 *   contacts created after the job is queued may or may not be included.
 */
export type BulkContactActionSelector =
  | {mode: 'ids'; contactIds: string[]}
  | {mode: 'query'; filter: {search?: string; subscribed?: boolean}; excludeIds?: string[]};

/**
 * Job data for bulk contact actions (subscribe, unsubscribe, delete)
 * Used by: bulkContactQueue worker
 */
export interface BulkContactActionJobData {
  projectId: string;
  operation: 'subscribe' | 'unsubscribe' | 'delete';
  selector: BulkContactActionSelector;
}
