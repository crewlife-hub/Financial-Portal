import { getStorage } from '../storage';
import { invoiceService } from './InvoiceService';
import { auditService, RequestContext } from './AuditService';
import { createLogger } from '../utils/Logger';
import { PhaseRestrictionError } from '../utils/errors';
import { config } from '../config';

const logger = createLogger('ReconciliationService');

/**
 * Reconciliation Service - Syncs data with QuickBooks and handles overdue tracking
 */
export class ReconciliationService {
  /**
   * Check if reconciliation features are enabled
   */
  private checkPhaseForReconciliation(): void {
    if (!config.app.enableReconciliation) {
      throw new PhaseRestrictionError('Reconciliation sync', 3, config.app.phase);
    }
  }

  /**
   * Sync invoice statuses from QuickBooks
   * Phase 3 feature
   */
  async syncInvoiceStatuses(context: RequestContext): Promise<{
    synced: number;
    updated: number;
    errors: Array<{ invoiceId: string; error: string }>;
  }> {
    this.checkPhaseForReconciliation();

    const storage = await getStorage();
    const invoiceLinks = await storage.getAllInvoiceLinks();

    let synced = 0;
    let updated = 0;
    const errors: Array<{ invoiceId: string; error: string }> = [];

    for (const link of invoiceLinks) {
      try {
        // TODO: Phase 3 - Call QuickBooks API to get invoice status
        // const qbClient = await getQuickBooksClient();
        // const qbInvoice = await qbClient.getInvoice(link.qbInvoiceId);
        // const newStatus = mapQbStatusToPortalStatus(qbInvoice.status);

        // Stub: In production, fetch actual status from QB
        const qbStatus = await this.fetchQbInvoiceStatusStub(link.qbInvoiceId);
        synced++;

        if (qbStatus !== link.qbStatus) {
          await invoiceService.updateStatusFromQb(link.id, qbStatus);
          updated++;
        }
      } catch (error) {
        errors.push({
          invoiceId: link.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Audit log
    await auditService.logSync(
      context,
      'invoice_status',
      synced,
      errors.map(e => e.error)
    );

    logger.info('Invoice status sync completed', {
      synced,
      updated,
      errors: errors.length,
    });

    return { synced, updated, errors };
  }

  /**
   * Sync payments from QuickBooks
   * Phase 3 feature
   */
  async syncPayments(context: RequestContext): Promise<{
    synced: number;
    newPayments: number;
    errors: Array<{ invoiceId: string; error: string }>;
  }> {
    this.checkPhaseForReconciliation();

    // TODO: Phase 3 - Implement payment sync from QuickBooks
    // 1. Query QB for payments since last sync
    // 2. Match payments to invoices
    // 3. Record payments in portal

    logger.info('Payment sync - not yet implemented');

    return {
      synced: 0,
      newPayments: 0,
      errors: [],
    };
  }

  /**
   * Get overdue invoices with aging details
   */
  async getOverdueReport(): Promise<{
    summary: {
      totalOverdue: number;
      count: number;
      byAging: {
        '1-30': { count: number; amount: number };
        '31-60': { count: number; amount: number };
        '61-90': { count: number; amount: number };
        '90+': { count: number; amount: number };
      };
    };
    invoices: Array<{
      id: string;
      qbDocNumber: string;
      clientName: string;
      invoiceDate: string;
      dueDate: string;
      amount: number;
      balance: number;
      currency: string;
      daysOverdue: number;
      agingBucket: string;
    }>;
  }> {
    const overdueInvoices = await invoiceService.getOverdueInvoices();

    const summary = {
      totalOverdue: 0,
      count: overdueInvoices.length,
      byAging: {
        '1-30': { count: 0, amount: 0 },
        '31-60': { count: 0, amount: 0 },
        '61-90': { count: 0, amount: 0 },
        '90+': { count: 0, amount: 0 },
      },
    };

    const invoices = overdueInvoices.map(inv => {
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      let agingBucket: '1-30' | '31-60' | '61-90' | '90+';
      if (daysOverdue <= 30) {
        agingBucket = '1-30';
      } else if (daysOverdue <= 60) {
        agingBucket = '31-60';
      } else if (daysOverdue <= 90) {
        agingBucket = '61-90';
      } else {
        agingBucket = '90+';
      }

      summary.totalOverdue += inv.balance;
      summary.byAging[agingBucket].count++;
      summary.byAging[agingBucket].amount += inv.balance;

      return {
        id: inv.id,
        qbDocNumber: inv.qbDocNumber,
        clientName: inv.qbCustomerName,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        amount: inv.amount,
        balance: inv.balance,
        currency: inv.currency,
        daysOverdue,
        agingBucket,
      };
    });

    return { summary, invoices };
  }

  /**
   * Get reconciliation dashboard data
   */
  async getDashboard(): Promise<{
    invoiceSummary: Awaited<ReturnType<typeof invoiceService.getReconciliationSummary>>;
    overdueReport: Awaited<ReturnType<typeof this.getOverdueReport>>;
    lastSyncTime: string | null;
  }> {
    const invoiceSummary = await invoiceService.getReconciliationSummary();
    const overdueReport = await this.getOverdueReport();

    // TODO: Track last sync time in a settings/metadata store
    const lastSyncTime = null;

    return {
      invoiceSummary,
      overdueReport,
      lastSyncTime,
    };
  }

  /**
   * Stub for fetching QB invoice status - replace with actual API call
   */
  private async fetchQbInvoiceStatusStub(qbInvoiceId: string): Promise<'PENDING' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE'> {
    // TODO: Replace with actual QuickBooks API call
    // const qbClient = await getQuickBooksClient();
    // const invoice = await qbClient.getInvoice(qbInvoiceId);
    // return this.mapQbStatus(invoice);

    logger.debug('Fetching QB invoice status (stub)', { qbInvoiceId });
    
    // Stub: return current status or random for testing
    return 'PENDING';
  }
}

// Singleton instance
export const reconciliationService = new ReconciliationService();
