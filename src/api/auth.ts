import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../services';
import { quickBooksClient } from '../integrations';
import { createLogger } from '../utils/Logger';
import { config } from '../config';

const logger = createLogger('AuthAPI');
const router = Router();

/**
 * GET /api/auth/status
 * Get authentication status for integrations
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        quickbooks: {
          configured: quickBooksClient.isConfigured(),
          authenticated: quickBooksClient.isAuthenticated(),
        },
        phase: config.app.phase,
        features: {
          qbWrite: config.app.enableQbWrite,
          reconciliation: config.app.enableReconciliation,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/quickbooks
 * Initiate QuickBooks OAuth flow
 */
router.get('/quickbooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!quickBooksClient.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'QuickBooks client not configured. Please set QB_CLIENT_ID and QB_CLIENT_SECRET.',
      });
    }

    // Generate state token for CSRF protection
    const state = crypto.randomUUID();
    
    // TODO: Store state in session for validation
    // req.session.qbOAuthState = state;

    const authUrl = quickBooksClient.getAuthorizationUrl(state);

    logger.info('Initiating QuickBooks OAuth flow');

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        state,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/quickbooks/callback
 * QuickBooks OAuth callback handler
 */
router.get('/quickbooks/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, realmId, error } = req.query;

    if (error) {
      logger.error('QuickBooks OAuth error', { error });
      return res.status(400).json({
        success: false,
        error: `OAuth error: ${error}`,
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code not received',
      });
    }

    // TODO: Validate state token
    // if (state !== req.session.qbOAuthState) {
    //   return res.status(400).json({ error: 'Invalid state token' });
    // }

    // Exchange code for tokens
    const tokens = await quickBooksClient.exchangeCodeForTokens(code as string);

    logger.info('QuickBooks OAuth completed', { realmId });

    // TODO: Store tokens securely
    // In production, encrypt and store in database

    res.json({
      success: true,
      message: 'QuickBooks connected successfully',
      data: {
        realmId,
        expiresAt: tokens.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/quickbooks/refresh
 * Refresh QuickBooks access token
 */
router.post('/quickbooks/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await quickBooksClient.refreshAccessToken();

    logger.info('QuickBooks token refreshed');

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        expiresAt: tokens.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/quickbooks/disconnect
 * Disconnect QuickBooks integration
 */
router.post('/quickbooks/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Revoke tokens with Intuit
    // TODO: Clear stored tokens

    logger.info('QuickBooks disconnected');

    res.json({
      success: true,
      message: 'QuickBooks disconnected',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
