import { getStorage } from '../storage';
import { InvoiceLink, createInvoiceLink, recordPayment, PaymentRecord } from '../models/InvoiceLink';
import { billableEventService } from './BillableEventService';
import { idempotencyService } from './IdempotencyService';
import { auditService, RequestContext } from './AuditService';
import { createLogger } from '../utils/Logger';
import { NotFoundError, ValidationError, PhaseRestrictionError } from '../utils/errors';
import { config } from '../config';
import { CurrencyCode, QBInvoiceStatus } from '../utils/validators';
import { z } from 'zod';

const logger = createLogger('InvoiceService');

/**
 * Invoice Service - Manages invoice lifecycle and QB integration
 */
export class InvoiceService {
  /**
   * Check if QB write operations are enabled
   */
  private checkPhaseForWrite(): void {
    if (!config.app.enableQbWrite) {
      throw new PhaseRestrictionError('QuickBooks invoice creation', 2, config.app.phase);
    }
  }

  /**
   * Get all invoice links
   */
  async getAllInvoiceLinks(): Promise<InvoiceLink[]> {
    const storage = await getStorage();
    return storage.getAllInvoiceLinks();
  }

  /**
   * Get invoice link by ID
   */
  async getInvoiceLinkById(id: string): Promise<InvoiceLink> {
    const storage = await getStorage();
    const link = await storage.getInvoiceLinkById(id);
    
    if (!link) {
      throw new NotFoundError('InvoiceLink', id);
    }
    
    return link;
  }

  /**
   * Get invoice link by billable event ID
   */
  async getInvoiceLinkByEventId(eventId: string): Promise<InvoiceLink | null> {
    const storage = await getStorage();
    return storage.getInvoiceLinkByEventId(eventId);
  }

  /**
   * Get invoices by status
   */
  async getInvoicesByStatus(status: z.infer<typeof QBInvoiceStatus>): Promise<InvoiceLink[]> {
    const storage = await getStorage();
    return storage.getInvoiceLinksByStatus(status);
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<InvoiceLink[]> {
    const storage = await getStorage();
    return storage.getOverdueInvoiceLinks();
  }

  /**
   * Create invoice in QuickBooks (Phase 2+)
   * This is the main entry point for invoice creation
   */
  async createInvoice(
    context: RequestContext,
    billableEventId: string
  ): Promise<InvoiceLink> {
    this.checkPhaseForWrite();

    const storage = await getStorage();
    const event = await billableEventService.getEventById(billableEventId);

    // Validate event status
    if (event.status !== 'APPROVED') {
      throw new ValidationError('Only approved events can be invoiced', {
        status: `Current status is ${event.status}`,
      });
    }

    // Check if invoice already exists
    const existingLink = await storage.getInvoiceLinkByEventId(billableEventId);
    if (existingLink) {
      throw new ValidationError('Invoice already exists for this event', {
        invoiceLinkId: existingLink.id,
        qbDocNumber: existingLink.qbDocNumber,
      });
    }

    // Generate memo with idempotency key
    const memo = idempotencyService.generateQbMemo(
      event.idempotencyKey,
      event.notes
    );

    // TODO: Phase 2 - Call QuickBooks API to create invoice
    // For now, create a stub invoice link
    logger.info('Creating invoice in QuickBooks (stub)', {
      eventId: billableEventId,
      idempotencyKey: event.idempotencyKey,
    });

    // Stub QB response - replace with actual QB API call
    const qbInvoice = await this.createQbInvoiceStub(event, memo);

    // Create invoice link
    const invoiceLink = createInvoiceLink({
      billableEventId: event.id,
      idempotencyKey: event.idempotencyKey,
      qbInvoiceId: qbInvoice.id,
      qbDocNumber: qbInvoice.docNumber,
      qbTxnId: qbInvoice.txnId,
      invoiceDate: qbInvoice.invoiceDate,
      dueDate: qbInvoice.dueDate,
      amount: event.amount,
      currency: event.currency,
      qbCustomerId: qbInvoice.customerId,
      qbCustomerName: qbInvoice.customerName,
      qbInvoiceUrl: qbInvoice.invoiceUrl,
      qbRawData: qbInvoice.rawData,
      createdBy: context.userId,
    });

    await storage.saveInvoiceLink(invoiceLink);

    // Mark event as invoiced
    await billableEventService.markAsInvoiced(context, billableEventId);

    // Audit log
    await auditService.logInvoiceCreate(
      context,
      invoiceLink.id,
      qbInvoice.id,
      qbInvoice.docNumber,
      billableEventId,
      event.amount,
      event.currency
    );

    logger.info('Invoice created', {
      invoiceLinkId: invoiceLink.id,
      qbDocNumber: qbInvoice.docNumber,
      amount: event.amount,
      currency: event.currency,
    });

    return invoiceLink;
  }

  /**
   * Stub for QB invoice creation - replace with actual API call in Phase 2
   */
  private async createQbInvoiceStub(
    event: Awaited<ReturnType<typeof billableEventService.getEventById>>,
    memo: string
  ): Promise<{
    id: string;
    docNumber: string;
    txnId: string;
    invoiceDate: string;
    dueDate: string;
    customerId: string;
    customerName: string;
    invoiceUrl?: string;
    rawData: Record<string, unknown>;
  }> {
    // TODO: Replace with actual QuickBooks Online API call
    // const qbClient = await getQuickBooksClient();
    // const invoice = await qbClient.createInvoice({
    //   CustomerRef: { value: policy.qbCustomerId },
    //   Line: [{
    //     Amount: event.amount,
    //     Description: `${event.feeType} - ${event.controlNumber}`,
    //     DetailType: 'SalesItemLineDetail',
    //     SalesItemLineDetail: {
    //       ItemRef: { value: policy.qbItemId },
    //     },
    //   }],
    //   PrivateNote: memo, // Stores idempotency key
    //   CurrencyRef: { value: event.currency },
    // });

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30); // Net 30

    return {
      id: `QB-INV-${Date.now()}`,
      docNumber: `INV-${Date.now().toString().slice(-6)}`,
      txnId: `TXN-${Date.now()}`,
      invoiceDate: now.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      customerId: `QB-CUST-${event.clientId}`,
      customerName: event.clientName,
      invoiceUrl: undefined, // Will be populated by actual QB response
      rawData: {
        stub: true,
        memo,
        createdAt: now.toISOString(),
      },
    };
  }

  /**
   * Record a payment against an invoice
   */
  async recordPaymentFromQb(
    context: RequestContext,
    invoiceLinkId: string,
    payment: Omit<PaymentRecord, 'syncedAt'>
  ): Promise<InvoiceLink> {
    const storage = await getStorage();
    const invoiceLink = await this.getInvoiceLinkById(invoiceLinkId);

    const paymentRecord: PaymentRecord = {
      ...payment,
      syncedAt: new Date().toISOString(),
    };

    const updated = recordPayment(invoiceLink, paymentRecord);
    await storage.updateInvoiceLink(invoiceLinkId, updated);

    // Update billable event status if fully paid
    if (updated.qbStatus === 'PAID') {
      await billableEventService.markAsPaid(context, updated.billableEventId);
    }

    // Audit log
    await auditService.logPaymentRecord(
      context,
      invoiceLinkId,
      invoiceLink.qbDocNumber,
      payment.amount,
      payment.currency
    );

    logger.info('Payment recorded', {
      invoiceLinkId,
      paymentAmount: payment.amount,
      newBalance: updated.balance,
      status: updated.qbStatus,
    });

    return updated;
  }

  /**
   * Update invoice status from QB sync
   */
  async updateStatusFromQb(
    invoiceLinkId: string,
    newStatus: z.infer<typeof QBInvoiceStatus>
  ): Promise<InvoiceLink> {
    const storage = await getStorage();
    const invoiceLink = await this.getInvoiceLinkById(invoiceLinkId);

    const now = new Date().toISOString();
    const updated = {
      ...invoiceLink,
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

    await storage.updateInvoiceLink(invoiceLinkId, updated);

    logger.info('Invoice status updated from QB', {
      invoiceLinkId,
      newStatus,
    });

    return updated;
  }

  /**
   * Get invoice detail for UI
   */
  async getInvoiceDetail(invoiceLinkId: string): Promise<{
    invoice: InvoiceLink;
    event: Awaited<ReturnType<typeof billableEventService.getEventById>>;
    auditLogs: Awaited<ReturnType<typeof auditService.getLogsForEntity>>;
  }> {
    const invoiceLink = await this.getInvoiceLinkById(invoiceLinkId);
    const event = await billableEventService.getEventById(invoiceLink.billableEventId);
    const auditLogs = await auditService.getLogsForEntity('INVOICE_LINK', invoiceLinkId);

    return {
      invoice: invoiceLink,
      event,
      auditLogs,
    };
  }

  /**
   * Get reconciliation summary for dashboard
   */
  async getReconciliationSummary(): Promise<{
    totalOutstanding: number;
    totalOverdue: number;
    byStatus: Record<string, { count: number; amount: number }>;
    byCurrency: Record<string, { outstanding: number; overdue: number }>;
    overdueInvoices: Array<{
      id: string;
      qbDocNumber: string;
      clientName: string;
      amount: number;
      currency: string;
      daysOverdue: number;
      balance: number;
    }>;
  }> {
    const allInvoices = await this.getAllInvoiceLinks();
    const overdueInvoices = await this.getOverdueInvoices();

    // Calculate totals
    let totalOutstanding = 0;
    let totalOverdue = 0;
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const byCurrency: Record<string, { outstanding: number; overdue: number }> = {};

    for (const invoice of allInvoices) {
      // By status
      if (!byStatus[invoice.qbStatus]) {
        byStatus[invoice.qbStatus] = { count: 0, amount: 0 };
      }
      byStatus[invoice.qbStatus].count++;
      byStatus[invoice.qbStatus].amount += invoice.balance;

      // Outstanding (not fully paid)
      if (invoice.balance > 0) {
        totalOutstanding += invoice.balance;

        if (!byCurrency[invoice.currency]) {
          byCurrency[invoice.currency] = { outstanding: 0, overdue: 0 };
        }
        byCurrency[invoice.currency].outstanding += invoice.balance;
      }
    }

    // Overdue details
    const overdueDetails = overdueInvoices.map(inv => {
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      totalOverdue += inv.balance;
      if (byCurrency[inv.currency]) {
        byCurrency[inv.currency].overdue += inv.balance;
      }

      return {
        id: inv.id,
        qbDocNumber: inv.qbDocNumber,
        clientName: inv.qbCustomerName,
        amount: inv.amount,
        currency: inv.currency,
        daysOverdue,
        balance: inv.balance,
      };
    });

    return {
      totalOutstanding,
      totalOverdue,
      byStatus,
      byCurrency,
      overdueInvoices: overdueDetails,
    };
  }
}

// Singleton instance
export const invoiceService = new InvoiceService();
