import { z } from 'zod';
import { CurrencyCode, QBInvoiceStatus } from '../utils/validators';

/**
 * Payment record from QuickBooks
 */
export const PaymentRecordSchema = z.object({
  qbPaymentId: z.string(),
  paymentDate: z.string(), // ISO date
  amount: z.number(),
  currency: CurrencyCode,
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  memo: z.string().optional(),
  syncedAt: z.string(),
});
export type PaymentRecord = z.infer<typeof PaymentRecordSchema>;

/**
 * Invoice Link - connects BillableEvent to QuickBooks Invoice
 */
export const InvoiceLinkSchema = z.object({
  // Unique identifier
  id: z.string().uuid(),
  
  // Link to billable event
  billableEventId: z.string().uuid(),
  idempotencyKey: z.string(), // Duplicate of event key for quick lookup
  
  // QuickBooks invoice details
  qbInvoiceId: z.string(), // QuickBooks internal ID
  qbDocNumber: z.string(), // Invoice number shown to customer
  qbTxnId: z.string().optional(), // Transaction ID
  
  // Invoice details
  invoiceDate: z.string(), // ISO date
  dueDate: z.string(), // ISO date
  amount: z.number(),
  currency: CurrencyCode,
  
  // Customer info
  qbCustomerId: z.string(),
  qbCustomerName: z.string(),
  
  // Status tracking
  qbStatus: QBInvoiceStatus,
  statusHistory: z.array(z.object({
    status: QBInvoiceStatus,
    timestamp: z.string(),
    source: z.enum(['PORTAL', 'QB_SYNC']),
  })),
  
  // Payment tracking
  totalPaid: z.number().default(0),
  balance: z.number(),
  payments: z.array(PaymentRecordSchema).default([]),
  paidInFullDate: z.string().optional(),
  
  // Sync info
  lastSyncedAt: z.string(),
  syncErrors: z.array(z.object({
    timestamp: z.string(),
    error: z.string(),
  })).default([]),
  
  // QuickBooks data snapshot
  qbInvoiceUrl: z.string().optional(), // Link to view in QB
  qbRawData: z.record(z.unknown()).optional(),
  
  // Metadata
  notes: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
});

export type InvoiceLink = z.infer<typeof InvoiceLinkSchema>;

/**
 * Create a new invoice link after QB invoice creation
 */
export function createInvoiceLink(input: {
  billableEventId: string;
  idempotencyKey: string;
  qbInvoiceId: string;
  qbDocNumber: string;
  qbTxnId?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: z.infer<typeof CurrencyCode>;
  qbCustomerId: string;
  qbCustomerName: string;
  qbInvoiceUrl?: string;
  qbRawData?: Record<string, unknown>;
  createdBy: string;
}): InvoiceLink {
  const now = new Date().toISOString();
  
  return InvoiceLinkSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    qbStatus: 'PENDING',
    statusHistory: [{
      status: 'PENDING',
      timestamp: now,
      source: 'PORTAL',
    }],
    totalPaid: 0,
    balance: input.amount,
    payments: [],
    syncErrors: [],
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Update invoice link with payment information
 */
export function recordPayment(
  invoiceLink: InvoiceLink,
  payment: z.infer<typeof PaymentRecordSchema>
): InvoiceLink {
  const now = new Date().toISOString();
  const newTotalPaid = invoiceLink.totalPaid + payment.amount;
  const newBalance = invoiceLink.amount - newTotalPaid;
  
  let newStatus: z.infer<typeof QBInvoiceStatus> = invoiceLink.qbStatus;
  let paidInFullDate: string | undefined = invoiceLink.paidInFullDate;
  
  if (newBalance <= 0) {
    newStatus = 'PAID';
    paidInFullDate = payment.paymentDate;
  } else if (newTotalPaid > 0) {
    newStatus = 'PARTIAL';
  }
  
  return {
    ...invoiceLink,
    totalPaid: newTotalPaid,
    balance: Math.max(0, newBalance),
    payments: [...invoiceLink.payments, payment],
    paidInFullDate,
    qbStatus: newStatus,
    statusHistory: [
      ...invoiceLink.statusHistory,
      {
        status: newStatus,
        timestamp: now,
        source: 'QB_SYNC' as const,
      },
    ],
    lastSyncedAt: now,
    updatedAt: now,
  };
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(invoiceLink: InvoiceLink): number {
  if (invoiceLink.qbStatus === 'PAID' || invoiceLink.balance <= 0) {
    return 0;
  }
  
  const dueDate = new Date(invoiceLink.dueDate);
  const today = new Date();
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Check if invoice is overdue
 */
export function isOverdue(invoiceLink: InvoiceLink): boolean {
  return getDaysOverdue(invoiceLink) > 0;
}
