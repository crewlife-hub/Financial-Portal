import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../services';
import { createLogger } from '../utils/Logger';

const logger = createLogger('AuditAPI');
const router = Router();

/**
 * GET /api/audit
 * Get all audit logs
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 100 } = req.query;
    
    const logs = await auditService.getAllLogs();
    const limitedLogs = logs.slice(0, parseInt(limit as string, 10));
    
    res.json({
      success: true,
      data: limitedLogs,
      count: limitedLogs.length,
      total: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/entity/:entityType/:entityId?
 * Get audit logs for specific entity
 */
router.get('/entity/:entityType/:entityId?', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;
    
    const logs = await auditService.getLogsForEntity(entityType, entityId);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit logs for specific user
 */
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await auditService.getLogsForUser(req.params.userId);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit/date-range
 * Get audit logs for date range
 */
router.get('/date-range', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters are required',
      });
    }
    
    const logs = await auditService.getLogsForDateRange(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
