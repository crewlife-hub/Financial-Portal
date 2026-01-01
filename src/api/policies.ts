import { Router, Request, Response, NextFunction } from 'express';
import { policyService } from '../services';
import { RequestContext } from '../services/AuditService';
import { createLogger } from '../utils/Logger';
import { AppError, ValidationError } from '../utils/errors';

const logger = createLogger('PoliciesAPI');
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
 * GET /api/policies
 * List all client policies
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.active === 'true';
    
    const policies = activeOnly 
      ? await policyService.getActivePolicies()
      : await policyService.getAllPolicies();
    
    res.json({
      success: true,
      data: policies,
      count: policies.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/policies/matrix
 * Get policy matrix for UI display
 */
router.get('/matrix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matrix = await policyService.getPolicyMatrix();
    
    res.json({
      success: true,
      data: matrix,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/policies/:id
 * Get policy by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await policyService.getPolicyById(req.params.id);
    
    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/policies/client/:clientId
 * Get policy by client ID
 */
router.get('/client/:clientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await policyService.getPolicyByClientId(req.params.clientId);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'No active policy found for client',
      });
    }
    
    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/policies
 * Create a new client policy
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    const { clientId, clientCode, clientName, triggerRule, feeRules, currency, ...rest } = req.body;
    
    // Validate required fields
    if (!clientId || !clientCode || !clientName || !triggerRule || !feeRules || !currency) {
      throw new ValidationError('Missing required fields', {
        clientId: !clientId ? 'Required' : undefined,
        clientCode: !clientCode ? 'Required' : undefined,
        clientName: !clientName ? 'Required' : undefined,
        triggerRule: !triggerRule ? 'Required' : undefined,
        feeRules: !feeRules ? 'Required' : undefined,
        currency: !currency ? 'Required' : undefined,
      });
    }
    
    const policy = await policyService.createPolicy(context, {
      clientId,
      clientCode,
      clientName,
      triggerRule,
      feeRules,
      currency,
      ...rest,
    });
    
    logger.info('Policy created via API', { policyId: policy.id });
    
    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/policies/:id
 * Update a client policy
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    const policy = await policyService.updatePolicy(context, req.params.id, req.body);
    
    logger.info('Policy updated via API', { policyId: policy.id });
    
    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/policies/:id
 * Deactivate a policy (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = getRequestContext(req);
    
    const policy = await policyService.deactivatePolicy(context, req.params.id);
    
    logger.info('Policy deactivated via API', { policyId: policy.id });
    
    res.json({
      success: true,
      data: policy,
      message: 'Policy deactivated',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
