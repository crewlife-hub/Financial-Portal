import { QBInvoice, QBPayment, QBCustomer } from './QuickBooksClient';
import { InvoiceLink } from '../../models/InvoiceLink';
import { BillableEvent } from '../../models/BillableEvent';
import { ClientPolicy } from '../../models/ClientPolicy';
import { createLogger } from '../../utils/Logger';
import { QBInvoiceStatus, CurrencyCode } from '../../utils/validators';
import { z } from 'zod';

const logger = createLogger('InvoiceMapper');

/**
 * Invoice Mapper - Maps between portal data and QuickBooks invoice formats
 */
export class InvoiceMapper {
  /**
   * Map BillableEvent + Policy to QB invoice creation data
   */
  mapEventToQbInvoice(
    event: BillableEvent,
    policy: ClientPolicy,
    memo: string
  ): {
    customerId: string;
    lineItems: Array<{
      description: string;
      amount: number;
      itemId?: string;
    }>;
    dueDate: string;
    currency: string;
    memo: string;
    customerMemo: string;
  } {
    // Calculate due date based on policy terms
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + policy.paymentTermsDays);

    // Build line item description
    const description = this.buildLineDescription(event);

    return {
      customerId: policy.qbCustomerId || '',
      lineItems: [
        {
          description,
          amount: event.amount,
          itemId: policy.qbItemId,
        },
      ],
      dueDate: dueDate.toISOString().split('T')[0],
      currency: event.currency,
      memo, // Contains idempotency key
      customerMemo: `Invoice for ${event.feeType.replace(/_/g, ' ')} - ${event.controlNumber}`,
    };
  }

  /**
   * Build line item description from event data
   */
  private buildLineDescription(event: BillableEvent): string {
    const parts = [
      event.feeType.replace(/_/g, ' '),
      `Control #: ${event.controlNumber}`,
    ];

    if (event.candidateName) {
      parts.push(`Candidate: ${event.candidateName}`);
    }

    if (event.sourceData?.vesselName) {
      parts.push(`Vessel: ${event.sourceData.vesselName}`);
    }

    if (event.sourceData?.positionTitle) {
      parts.push(`Position: ${event.sourceData.positionTitle}`);
    }

    return parts.join(' | ');
  }

  /**
   * Map QB invoice response to InvoiceLink data
   */
  mapQbInvoiceToLink(
    qbInvoice: QBInvoice,
    billableEventId: string,
    idempotencyKey: string
  ): Omit<InvoiceLink, 'id' | 'createdAt' | 'createdBy' | 'updatedAt'> {
    return {
      billableEventId,
      idempotencyKey,
      qbInvoiceId: qbInvoice.Id,
      qbDocNumber: qbInvoice.DocNumber,
      qbTxnId: qbInvoice.Id,
      invoiceDate: qbInvoice.TxnDate,
      dueDate: qbInvoice.DueDate,
      amount: qbInvoice.TotalAmt,
      currency: qbInvoice.CurrencyRef.value as z.infer<typeof CurrencyCode>,
      qbStatus: this.mapQbStatus(qbInvoice),
      statusHistory: [{
        status: this.mapQbStatus(qbInvoice),
        timestamp: new Date().toISOString(),
        source: 'QB_SYNC' as const,
      }],
      qbCustomerId: qbInvoice.CustomerRef.value,
      qbCustomerName: qbInvoice.CustomerRef.name || '',
      totalPaid: qbInvoice.TotalAmt - qbInvoice.Balance,
      balance: qbInvoice.Balance,
      payments: [],
      lastSyncedAt: new Date().toISOString(),
      syncErrors: [],
      qbRawData: qbInvoice as unknown as Record<string, unknown>,
    };
  }

  /**
   * Map QuickBooks invoice status to portal status
   */
  mapQbStatus(qbInvoice: QBInvoice): z.infer<typeof QBInvoiceStatus> {
    // Check balance
    if (qbInvoice.Balance === 0 && qbInvoice.TotalAmt > 0) {
      return 'PAID';
    }

    if (qbInvoice.Balance > 0 && qbInvoice.Balance < qbInvoice.TotalAmt) {
      return 'PARTIAL';
    }

    // Check if overdue
    const dueDate = new Date(qbInvoice.DueDate);
    const today = new Date();
    if (today > dueDate && qbInvoice.Balance > 0) {
      return 'OVERDUE';
    }

    // Check email status
    switch (qbInvoice.EmailStatus) {
      case 'EmailSent':
        return 'SENT';
      case 'NeedToSend':
        return 'PENDING';
      case 'NotSet':
      default:
        return 'PENDING';
    }
  }

  /**
   * Extract invoice link updates from QB invoice sync
   */
  extractUpdatesFromQbInvoice(
    existingLink: InvoiceLink,
    qbInvoice: QBInvoice
  ): Partial<InvoiceLink> {
    const newStatus = this.mapQbStatus(qbInvoice);
    const now = new Date().toISOString();

    const updates: Partial<InvoiceLink> = {
      qbStatus: newStatus,
      totalPaid: qbInvoice.TotalAmt - qbInvoice.Balance,
      balance: qbInvoice.Balance,
      lastSyncedAt: now,
      updatedAt: now,
      qbRawData: qbInvoice as unknown as Record<string, unknown>,
    };

    // Add status to history if changed
    if (newStatus !== existingLink.qbStatus) {
      updates.statusHistory = [
        ...existingLink.statusHistory,
        {
          status: newStatus,
          timestamp: now,
          source: 'QB_SYNC' as const,
        },
      ];
    }

    // Set paid date if just became fully paid
    if (newStatus === 'PAID' && !existingLink.paidInFullDate) {
      updates.paidInFullDate = now.split('T')[0];
    }

    return updates;
  }
}

/**
 * Payment Mapper - Maps between portal data and QuickBooks payment formats
 */
export class PaymentMapper {
  /**
   * Map QB payment to portal payment record
   */
  mapQbPaymentToRecord(
    qbPayment: QBPayment,
    invoiceId: string
  ): {
    qbPaymentId: string;
    paymentDate: string;
    amount: number;
    currency: z.infer<typeof CurrencyCode>;
    paymentMethod?: string;
    referenceNumber?: string;
    memo?: string;
  } | null {
    // Find the line that references this invoice
    const invoiceLine = qbPayment.Line.find(line =>
      line.LinkedTxn.some(txn => txn.TxnId === invoiceId && txn.TxnType === 'Invoice')
    );

    if (!invoiceLine) {
      logger.debug('Payment does not apply to invoice', {
        paymentId: qbPayment.Id,
        invoiceId,
      });
      return null;
    }

    return {
      qbPaymentId: qbPayment.Id,
      paymentDate: qbPayment.TxnDate,
      amount: invoiceLine.Amount,
      currency: qbPayment.CurrencyRef.value as z.infer<typeof CurrencyCode>,
      paymentMethod: qbPayment.PaymentMethodRef?.name,
      referenceNumber: qbPayment.PaymentRefNum,
      memo: qbPayment.PrivateNote,
    };
  }
}

// Singleton instances
export const invoiceMapper = new InvoiceMapper();
export const paymentMapper = new PaymentMapper();
