import { Router, Request, Response, NextFunction } from 'express';
import { reconciliationService, invoiceService } from '../services';
import { RequestContext } from '../services/AuditService';
import { createLogger } from '../utils/Logger';
import { PhaseRestrictionError } from '../utils/errors';
import { config } from '../config';

const logger = createLogger('ReconciliationAPI');
const router = Router();

/**
 * Extract request context for audit logging
 */
function getRequestContext(req: Request): RequestContext {
  return {
    userId: (req as any).userId || 'system',
    userName: (req as any).userName,
    userEmail: (req as any).userEmail,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };
}

/**
 * GET /api/reconciliation/summary
 * Get reconciliation summary for dashboard
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await invoiceService.getReconciliationSummary();
    
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reconciliation/dashboard
 * Get full reconciliation dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await reconciliationService.getDashboard();
    
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reconciliation/overdue
 * Get overdue invoice report
 */
router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reconciliationService.getOverdueReport();
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reconciliation/sync-invoices
 * Sync invoice statuses from QuickBooks
 * Phase 3 feature
 */
router.post('/sync-invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    // Check phase
    if (!config.app.enableReconciliation) {
      throw new PhaseRestrictionError('Invoice sync', 3, config.app.phase);
    }
    
    const result = await reconciliationService.syncInvoiceStatuses(context);
    
    logger.info('Invoice sync completed via API', result);
    
    res.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} invoices, ${result.updated} updated`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reconciliation/sync-payments
 * Sync payments from QuickBooks
 * Phase 3 feature
 */
router.post('/sync-payments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    // Check phase
    if (!config.app.enableReconciliation) {
      throw new PhaseRestrictionError('Payment sync', 3, config.app.phase);
    }
    
    const result = await reconciliationService.syncPayments(context);
    
    logger.info('Payment sync completed via API', result);
    
    res.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} payments, ${result.newPayments} new`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
