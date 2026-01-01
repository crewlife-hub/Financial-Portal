import { z } from 'zod';

/**
 * Currency codes supported by the portal
 */
export const CurrencyCode = z.enum([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK'
]);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/**
 * Fee types for billing
 */
export const FeeType = z.enum([
  'PLACEMENT_FEE',
  'ONBOARD_FEE',
  'PROCESSING_FEE',
  'EXTENSION_FEE',
  'CANCELLATION_FEE',
  'REFUND',
  'CREDIT',
  'OTHER'
]);
export type FeeType = z.infer<typeof FeeType>;

/**
 * Billable event status lifecycle
 */
export const BillableEventStatus = z.enum([
  'PENDING',     // Awaiting approval
  'APPROVED',    // Approved, ready for invoicing
  'INVOICED',    // Invoice created in QuickBooks
  'PAID',        // Payment received
  'PARTIAL',     // Partial payment received
  'OVERDUE',     // Past due date
  'HOLD',        // On hold (dispute, review, etc.)
  'CANCELLED',   // Cancelled
  'REFUNDED',    // Refunded
  'CREDITED'     // Credit applied
]);
export type BillableEventStatus = z.infer<typeof BillableEventStatus>;

/**
 * QuickBooks invoice status
 */
export const QBInvoiceStatus = z.enum([
  'DRAFT',
  'PENDING',
  'SENT',
  'VIEWED',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'VOIDED'
]);
export type QBInvoiceStatus = z.infer<typeof QBInvoiceStatus>;

/**
 * Audit action types
 */
export const AuditAction = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'HOLD',
  'INVOICE_CREATE',
  'INVOICE_SEND',
  'PAYMENT_RECORD',
  'SYNC',
  'LOGIN',
  'EXPORT'
]);
export type AuditAction = z.infer<typeof AuditAction>;

/**
 * Trigger rule types - when billing is triggered
 */
export const TriggerRule = z.enum([
  'ON_PLACEMENT',        // Bill when placement is confirmed
  'ON_ONBOARD',          // Bill when crew member boards
  'ON_CONTRACT_START',   // Bill on contract start date
  'ON_EXTENSION',        // Bill on contract extension
  'MANUAL'               // Manual trigger only
]);
export type TriggerRule = z.infer<typeof TriggerRule>;

/**
 * Common validation helpers
 */
export function isValidCurrency(code: string): code is CurrencyCode {
  return CurrencyCode.safeParse(code).success;
}

export function isValidStatus(status: string): status is BillableEventStatus {
  return BillableEventStatus.safeParse(status).success;
}

export function isValidFeeType(type: string): type is FeeType {
  return FeeType.safeParse(type).success;
}

/**
 * Date validation
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Amount validation
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && !isNaN(amount) && isFinite(amount) && amount >= 0;
}

/**
 * Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Client code validation (alphanumeric, 2-20 chars)
 */
export function isValidClientCode(code: string): boolean {
  const codeRegex = /^[A-Z0-9]{2,20}$/;
  return codeRegex.test(code.toUpperCase());
}

/**
 * Control number validation
 */
export function isValidControlNumber(controlNumber: string): boolean {
  // Alphanumeric, allowing hyphens and underscores, 3-50 chars
  const regex = /^[A-Za-z0-9_-]{3,50}$/;
  return regex.test(controlNumber);
}
