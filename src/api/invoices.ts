import { Router, Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services';
import { RequestContext } from '../services/AuditService';
import { createLogger } from '../utils/Logger';
import { ValidationError, PhaseRestrictionError } from '../utils/errors';
import { config } from '../config';

const logger = createLogger('InvoicesAPI');
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
 * GET /api/invoices
 * List all invoice links
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    
    let invoices;
    if (status) {
      invoices = await invoiceService.getInvoicesByStatus(status as any);
    } else {
      invoices = await invoiceService.getAllInvoiceLinks();
    }
    
    res.json({
      success: true,
      data: invoices,
      count: invoices.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/overdue
 * Get overdue invoices
 */
router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await invoiceService.getOverdueInvoices();
    
    res.json({
      success: true,
      data: invoices,
      count: invoices.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id
 * Get invoice link by ID with full details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await invoiceService.getInvoiceDetail(req.params.id);
    
    res.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/event/:eventId
 * Get invoice link by billable event ID
 */
router.get('/event/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await invoiceService.getInvoiceLinkByEventId(req.params.eventId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'No invoice found for this event',
      });
    }
    
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/create
 * Create invoice in QuickBooks from approved billable event
 * Phase 2+ feature
 */
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    const { billableEventId } = req.body;
    
    if (!billableEventId) {
      throw new ValidationError('billableEventId is required');
    }
    
    // Check phase
    if (!config.app.enableQbWrite) {
      throw new PhaseRestrictionError('Invoice creation', 2, config.app.phase);
    }
    
    const invoice = await invoiceService.createInvoice(context, billableEventId);
    
    logger.info('Invoice created via API', {
      invoiceLinkId: invoice.id,
      qbDocNumber: invoice.qbDocNumber,
    });
    
    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created in QuickBooks',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/invoices/create-batch
 * Create invoices for multiple approved events
 * Phase 2+ feature
 */
router.post('/create-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    const { billableEventIds } = req.body;
    
    if (!billableEventIds || !Array.isArray(billableEventIds) || billableEventIds.length === 0) {
      throw new ValidationError('billableEventIds array is required');
    }
    
    // Check phase
    if (!config.app.enableQbWrite) {
      throw new PhaseRestrictionError('Invoice creation', 2, config.app.phase);
    }
    
    const results = {
      created: [] as any[],
      errors: [] as any[],
    };
    
    for (const eventId of billableEventIds) {
      try {
        const invoice = await invoiceService.createInvoice(context, eventId);
        results.created.push({
          eventId,
          invoiceLinkId: invoice.id,
          qbDocNumber: invoice.qbDocNumber,
        });
      } catch (error) {
        results.errors.push({
          eventId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    logger.info('Batch invoice creation completed', {
      total: billableEventIds.length,
      created: results.created.length,
      errors: results.errors.length,
    });
    
    res.json({
      success: true,
      data: results,
      summary: {
        total: billableEventIds.length,
        created: results.created.length,
        errors: results.errors.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
