import { z } from 'zod';
import { BillableEventStatus, CurrencyCode, FeeType } from '../utils/validators';
import { format } from 'date-fns';

/**
 * Source data from Smartsheet/external system
 */
export const SourceDataSchema = z.object({
  smartsheetRowId: z.string().optional(),
  placementId: z.string().optional(),
  controlNumber: z.string(),
  candidateEmail: z.string().email().optional(),
  candidateName: z.string().optional(),
  vesselName: z.string().optional(),
  positionTitle: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  salary: z.number().optional(),
  currency: CurrencyCode.optional(),
  rawData: z.record(z.unknown()).optional(),
});
export type SourceData = z.infer<typeof SourceDataSchema>;

/**
 * Idempotency Key Structure
 * Format: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
 * Example: ACME-PL12345-20231215-PLACEMENT_FEE
 */
export const IdempotencyKeySchema = z.string().regex(
  /^[A-Z0-9]+-[A-Za-z0-9_-]+-\d{8}-[A-Z_]+$/,
  'Invalid idempotency key format. Expected: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE'
);

/**
 * Billable Event - represents a single billable occurrence
 */
export const BillableEventSchema = z.object({
  // Unique identifiers
  id: z.string().uuid(),
  
  /**
   * IDEMPOTENCY KEY - Critical for duplicate prevention
   * Format: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
   * This key MUST be stored in both:
   * 1. This portal's ledger
   * 2. QuickBooks invoice (memo or custom field)
   */
  idempotencyKey: IdempotencyKeySchema,
  
  // Client reference
  clientId: z.string(),
  clientCode: z.string(),
  clientName: z.string(),
  
  // Event details
  controlNumber: z.string(), // Unique identifier for the placement/transaction
  candidateEmail: z.string().email().optional(),
  candidateName: z.string().optional(),
  
  // Trigger information
  triggerDate: z.string(), // ISO date - when the billable event was triggered
  triggerType: z.string(), // What triggered this event
  
  // Financial details
  feeType: FeeType,
  amount: z.number(),
  currency: CurrencyCode,
  
  // Exchange rate (if converted)
  originalAmount: z.number().optional(),
  originalCurrency: CurrencyCode.optional(),
  exchangeRate: z.number().optional(),
  
  // Status tracking
  status: BillableEventStatus,
  statusHistory: z.array(z.object({
    status: BillableEventStatus,
    timestamp: z.string(),
    userId: z.string(),
    reason: z.string().optional(),
  })),
  
  // Policy reference (frozen at time of event)
  policyId: z.string(),
  policyVersion: z.number(),
  
  // Source data from Smartsheet/external system
  sourceData: SourceDataSchema.optional(),
  
  // Approval workflow
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  approvalNotes: z.string().optional(),
  
  // Hold information
  holdReason: z.string().optional(),
  holdAt: z.string().optional(),
  holdBy: z.string().optional(),
  
  // Metadata
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export type BillableEvent = z.infer<typeof BillableEventSchema>;

/**
 * Generate idempotency key from event components
 * Format: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
 */
export function generateIdempotencyKey(
  clientCode: string,
  controlNumber: string,
  triggerDate: string | Date,
  feeType: z.infer<typeof FeeType>
): string {
  const dateStr = typeof triggerDate === 'string' 
    ? format(new Date(triggerDate), 'yyyyMMdd')
    : format(triggerDate, 'yyyyMMdd');
  
  // Sanitize control number (remove special characters except hyphen/underscore)
  const sanitizedControlNumber = controlNumber
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase();
  
  return `${clientCode.toUpperCase()}-${sanitizedControlNumber}-${dateStr}-${feeType}`;
}

/**
 * Parse idempotency key into components
 */
export function parseIdempotencyKey(key: string): {
  clientCode: string;
  controlNumber: string;
  triggerDate: string;
  feeType: string;
} | null {
  const match = key.match(/^([A-Z0-9]+)-([A-Za-z0-9_-]+)-(\d{8})-([A-Z_]+)$/);
  if (!match) return null;
  
  const [, clientCode, controlNumber, dateStr, feeType] = match;
  const triggerDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  
  return { clientCode, controlNumber, triggerDate, feeType };
}

/**
 * Create a new billable event
 */
export function createBillableEvent(input: {
  clientId: string;
  clientCode: string;
  clientName: string;
  controlNumber: string;
  candidateEmail?: string;
  candidateName?: string;
  triggerDate: string;
  triggerType: string;
  feeType: z.infer<typeof FeeType>;
  amount: number;
  currency: z.infer<typeof CurrencyCode>;
  policyId: string;
  policyVersion: number;
  sourceData?: SourceData;
  createdBy: string;
  notes?: string;
}): BillableEvent {
  const now = new Date().toISOString();
  const idempotencyKey = generateIdempotencyKey(
    input.clientCode,
    input.controlNumber,
    input.triggerDate,
    input.feeType
  );
  
  return BillableEventSchema.parse({
    id: crypto.randomUUID(),
    idempotencyKey,
    ...input,
    status: 'PENDING',
    statusHistory: [{
      status: 'PENDING',
      timestamp: now,
      userId: input.createdBy,
      reason: 'Created from Smartsheet data',
    }],
    tags: [],
    createdAt: now,
    updatedAt: now,
    updatedBy: input.createdBy,
  });
}

/**
 * Update billable event status with history tracking
 */
export function updateEventStatus(
  event: BillableEvent,
  newStatus: z.infer<typeof BillableEventStatus>,
  userId: string,
  reason?: string
): BillableEvent {
  const now = new Date().toISOString();
  
  return {
    ...event,
    status: newStatus,
    statusHistory: [
      ...event.statusHistory,
      {
        status: newStatus,
        timestamp: now,
        userId,
        reason,
      },
    ],
    updatedAt: now,
    updatedBy: userId,
  };
}
