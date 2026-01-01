import { Router, Request, Response, NextFunction } from 'express';
import { billableEventService, idempotencyService } from '../services';
import { placementMapper } from '../integrations';
import { RequestContext } from '../services/AuditService';
import { createLogger } from '../utils/Logger';
import { ValidationError } from '../utils/errors';

const logger = createLogger('BillableEventsAPI');
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
 * GET /api/billable-events
 * List all billable events with optional filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, clientId } = req.query;
    
    let events;
    if (status) {
      events = await billableEventService.getEventsByStatus(status as string);
    } else if (clientId) {
      events = await billableEventService.getEventsByClient(clientId as string);
    } else {
      events = await billableEventService.getAllEvents();
    }
    
    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billable-events/ready-to-invoice
 * Get events ready for invoicing (pending approval)
 */
router.get('/ready-to-invoice', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await billableEventService.getReadyToInvoiceList();
    
    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billable-events/approved
 * Get approved events ready for QB invoice creation
 */
router.get('/approved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await billableEventService.getApprovedEvents();
    
    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billable-events/:id
 * Get billable event by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await billableEventService.getEventById(req.params.id);
    
    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billable-events/key/:idempotencyKey
 * Get billable event by idempotency key
 */
router.get('/key/:idempotencyKey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await billableEventService.getEventByIdempotencyKey(req.params.idempotencyKey);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found with this idempotency key',
      });
    }
    
    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billable-events
 * Create a new billable event
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    const { clientId, controlNumber, triggerDate, triggerType, feeType, ...rest } = req.body;
    
    // Validate required fields
    if (!clientId || !controlNumber || !triggerDate || !triggerType || !feeType) {
      throw new ValidationError('Missing required fields', {
        clientId: !clientId ? 'Required' : undefined,
        controlNumber: !controlNumber ? 'Required' : undefined,
        triggerDate: !triggerDate ? 'Required' : undefined,
        triggerType: !triggerType ? 'Required' : undefined,
        feeType: !feeType ? 'Required' : undefined,
      });
    }
    
    const event = await billableEventService.createEvent(context, {
      clientId,
      controlNumber,
      triggerDate,
      triggerType,
      feeType,
      ...rest,
    });
    
    logger.info('Billable event created via API', {
      eventId: event.id,
      idempotencyKey: event.idempotencyKey,
    });
    
    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billable-events/generate
 * Generate billable events from Smartsheet data
 */
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    const { statusFilter, triggerType = 'PLACEMENT' } = req.body;
    
    // Fetch triggers from Smartsheet
    const triggers = await placementMapper.fetchBillableTriggers(statusFilter, triggerType);
    
    if (triggers.length === 0) {
      return res.json({
        success: true,
        message: 'No placements found matching criteria',
        data: { created: [], duplicates: [], errors: [] },
      });
    }
    
    // Bulk create events
    const result = await billableEventService.bulkCreateFromSmartsheet(context, triggers);
    
    logger.info('Billable events generated from Smartsheet', {
      total: triggers.length,
      created: result.created.length,
      duplicates: result.duplicates.length,
      errors: result.errors.length,
    });
    
    res.json({
      success: true,
      data: result,
      summary: {
        total: triggers.length,
        created: result.created.length,
        duplicates: result.duplicates.length,
        errors: result.errors.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billable-events/:id/approve
 * Approve a billable event for invoicing
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    const { notes } = req.body;
    
    const event = await billableEventService.approveEvent(context, req.params.id, notes);
    
    logger.info('Billable event approved via API', {
      eventId: event.id,
      idempotencyKey: event.idempotencyKey,
    });
    
    res.json({
      success: true,
      data: event,
      message: 'Event approved for invoicing',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billable-events/:id/hold
 * Put a billable event on hold
 */
router.post('/:id/hold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    const { reason } = req.body;
    
    if (!reason) {
      throw new ValidationError('Hold reason is required', { reason: 'Required' });
    }
    
    const event = await billableEventService.holdEvent(context, req.params.id, reason);
    
    logger.info('Billable event put on hold via API', {
      eventId: event.id,
      reason,
    });
    
    res.json({
      success: true,
      data: event,
      message: 'Event put on hold',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billable-events/check-key
 * Check if an idempotency key exists
 */
router.post('/check-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientCode, controlNumber, triggerDate, feeType } = req.body;
    
    if (!clientCode || !controlNumber || !triggerDate || !feeType) {
      throw new ValidationError('All key components are required');
    }
    
    const key = idempotencyService.generateKey(clientCode, controlNumber, triggerDate, feeType);
    const exists = await idempotencyService.keyExists(key);
    
    res.json({
      success: true,
      data: {
        key,
        exists,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
