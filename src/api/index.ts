import { Router } from 'express';
import policiesRouter from './policies';
import billableEventsRouter from './billableEvents';
import invoicesRouter from './invoices';
import reconciliationRouter from './reconciliation';
import authRouter from './auth';
import auditRouter from './audit';

const router = Router();

// Mount route modules
router.use('/policies', policiesRouter);
router.use('/billable-events', billableEventsRouter);
router.use('/invoices', invoicesRouter);
router.use('/reconciliation', reconciliationRouter);
router.use('/auth', authRouter);
router.use('/audit', auditRouter);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
