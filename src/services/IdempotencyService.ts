import { getStorage } from '../storage';
import { generateIdempotencyKey, parseIdempotencyKey } from '../models/BillableEvent';
import { createLogger } from '../utils/Logger';
import { DuplicateError } from '../utils/errors';

const logger = createLogger('IdempotencyService');

/**
 * Idempotency Service - Prevents duplicate billing
 * 
 * Key Format: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
 * Example: ACME-PL12345-20231215-PLACEMENT_FEE
 * 
 * This key is stored in:
 * 1. Portal's billable events ledger
 * 2. QuickBooks invoice memo/custom field
 */
export class IdempotencyService {
  /**
   * Generate an idempotency key from components
   */
  generateKey(
    clientCode: string,
    controlNumber: string,
    triggerDate: string | Date,
    feeType: string
  ): string {
    return generateIdempotencyKey(
      clientCode,
      controlNumber,
      triggerDate,
      feeType as any
    );
  }

  /**
   * Parse an idempotency key into its components
   */
  parseKey(key: string): {
    clientCode: string;
    controlNumber: string;
    triggerDate: string;
    feeType: string;
  } | null {
    return parseIdempotencyKey(key);
  }

  /**
   * Check if an idempotency key already exists
   * CRITICAL: This is the primary duplicate prevention mechanism
   */
  async keyExists(key: string): Promise<boolean> {
    const storage = await getStorage();
    const exists = await storage.idempotencyKeyExists(key);
    
    if (exists) {
      logger.warn('Duplicate idempotency key check: key exists', { key });
    }
    
    return exists;
  }

  /**
   * Validate and check key before creating a billable event
   * Throws DuplicateError if key already exists
   */
  async validateBeforeCreate(
    clientCode: string,
    controlNumber: string,
    triggerDate: string | Date,
    feeType: string
  ): Promise<string> {
    const key = this.generateKey(clientCode, controlNumber, triggerDate, feeType);
    
    const exists = await this.keyExists(key);
    if (exists) {
      logger.error('Duplicate entry blocked', {
        key,
        clientCode,
        controlNumber,
        feeType,
      });
      throw new DuplicateError(key);
    }
    
    logger.info('Idempotency key validated', { key });
    return key;
  }

  /**
   * Bulk check for existing keys
   * Returns array of keys that already exist
   */
  async checkBulkKeys(keys: string[]): Promise<string[]> {
    const storage = await getStorage();
    const existingKeys: string[] = [];
    
    for (const key of keys) {
      if (await storage.idempotencyKeyExists(key)) {
        existingKeys.push(key);
      }
    }
    
    if (existingKeys.length > 0) {
      logger.warn('Bulk check found existing keys', {
        total: keys.length,
        existing: existingKeys.length,
      });
    }
    
    return existingKeys;
  }

  /**
   * Get billable event by idempotency key
   */
  async getEventByKey(key: string) {
    const storage = await getStorage();
    return storage.getEventByIdempotencyKey(key);
  }

  /**
   * Generate memo text for QuickBooks invoice
   * This ensures the idempotency key is stored in QB for reference
   */
  generateQbMemo(key: string, additionalNotes?: string): string {
    const memoLines = [
      `[IDEMPOTENCY_KEY: ${key}]`,
    ];
    
    const parsed = this.parseKey(key);
    if (parsed) {
      memoLines.push(`Control #: ${parsed.controlNumber}`);
      memoLines.push(`Fee Type: ${parsed.feeType.replace(/_/g, ' ')}`);
    }
    
    if (additionalNotes) {
      memoLines.push('');
      memoLines.push(additionalNotes);
    }
    
    return memoLines.join('\n');
  }

  /**
   * Extract idempotency key from QuickBooks invoice memo
   */
  extractKeyFromQbMemo(memo: string): string | null {
    const match = memo.match(/\[IDEMPOTENCY_KEY:\s*([^\]]+)\]/);
    return match ? match[1].trim() : null;
  }
}

// Singleton instance
export const idempotencyService = new IdempotencyService();
