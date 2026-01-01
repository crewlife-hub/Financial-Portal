import { getStorage } from '../storage';
import { AuditLog, createAuditLog } from '../models/AuditLog';
import { AuditAction } from '../utils/validators';
import { createLogger } from '../utils/Logger';

const logger = createLogger('AuditService');

/**
 * Request context for audit logging
 */
export interface RequestContext {
  userId: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Service - Centralized audit logging for all system actions
 */
export class AuditService {
  /**
   * Log an action to the audit trail
   */
  async log(
    context: RequestContext,
    action: AuditAction,
    entityType: 'CLIENT_POLICY' | 'BILLABLE_EVENT' | 'INVOICE_LINK' | 'SYSTEM' | 'USER',
    description: string,
    options?: {
      entityId?: string;
      previousValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      relatedEntities?: Array<{ entityType: string; entityId: string }>;
    }
  ): Promise<AuditLog> {
    const storage = await getStorage();

    const auditLog = createAuditLog({
      action,
      entityType,
      entityId: options?.entityId,
      userId: context.userId,
      userName: context.userName,
      userEmail: context.userEmail,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      description,
      previousValue: options?.previousValue,
      newValue: options?.newValue,
      metadata: options?.metadata,
      relatedEntities: options?.relatedEntities,
    });

    await storage.saveAuditLog(auditLog);

    logger.audit(action, {
      entityType,
      entityId: options?.entityId,
      userId: context.userId,
      description,
    });

    return auditLog;
  }

  /**
   * Log a policy creation
   */
  async logPolicyCreate(
    context: RequestContext,
    policyId: string,
    clientCode: string,
    policyData: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.log(
      context,
      'CREATE',
      'CLIENT_POLICY',
      `Created billing policy for client ${clientCode}`,
      {
        entityId: policyId,
        newValue: policyData,
      }
    );
  }

  /**
   * Log a policy update
   */
  async logPolicyUpdate(
    context: RequestContext,
    policyId: string,
    clientCode: string,
    previousData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.log(
      context,
      'UPDATE',
      'CLIENT_POLICY',
      `Updated billing policy for client ${clientCode}`,
      {
        entityId: policyId,
        previousValue: previousData,
        newValue: newData,
      }
    );
  }

  /**
   * Log billable event creation
   */
  async logEventCreate(
    context: RequestContext,
    eventId: string,
    idempotencyKey: string,
    eventData: Record<string, unknown>
  ): Promise<AuditLog> {
    return this.log(
      context,
      'CREATE',
      'BILLABLE_EVENT',
      `Created billable event with key ${idempotencyKey}`,
      {
        entityId: eventId,
        newValue: eventData,
        metadata: { idempotencyKey },
      }
    );
  }

  /**
   * Log billable event approval
   */
  async logEventApprove(
    context: RequestContext,
    eventId: string,
    idempotencyKey: string,
    notes?: string
  ): Promise<AuditLog> {
    return this.log(
      context,
      'APPROVE',
      'BILLABLE_EVENT',
      `Approved billable event for invoicing: ${idempotencyKey}`,
      {
        entityId: eventId,
        metadata: { idempotencyKey, notes },
      }
    );
  }

  /**
   * Log billable event hold
   */
  async logEventHold(
    context: RequestContext,
    eventId: string,
    idempotencyKey: string,
    reason: string
  ): Promise<AuditLog> {
    return this.log(
      context,
      'HOLD',
      'BILLABLE_EVENT',
      `Put billable event on hold: ${idempotencyKey}`,
      {
        entityId: eventId,
        metadata: { idempotencyKey, reason },
      }
    );
  }

  /**
   * Log invoice creation in QuickBooks
   */
  async logInvoiceCreate(
    context: RequestContext,
    invoiceLinkId: string,
    qbInvoiceId: string,
    qbDocNumber: string,
    billableEventId: string,
    amount: number,
    currency: string
  ): Promise<AuditLog> {
    return this.log(
      context,
      'INVOICE_CREATE',
      'INVOICE_LINK',
      `Created invoice ${qbDocNumber} in QuickBooks`,
      {
        entityId: invoiceLinkId,
        metadata: {
          qbInvoiceId,
          qbDocNumber,
          amount,
          currency,
        },
        relatedEntities: [
          { entityType: 'BILLABLE_EVENT', entityId: billableEventId },
        ],
      }
    );
  }

  /**
   * Log payment recording
   */
  async logPaymentRecord(
    context: RequestContext,
    invoiceLinkId: string,
    qbDocNumber: string,
    paymentAmount: number,
    currency: string
  ): Promise<AuditLog> {
    return this.log(
      context,
      'PAYMENT_RECORD',
      'INVOICE_LINK',
      `Recorded payment of ${currency} ${paymentAmount.toFixed(2)} for invoice ${qbDocNumber}`,
      {
        entityId: invoiceLinkId,
        metadata: {
          paymentAmount,
          currency,
        },
      }
    );
  }

  /**
   * Log QB sync operation
   */
  async logSync(
    context: RequestContext,
    syncType: string,
    recordsProcessed: number,
    errors?: string[]
  ): Promise<AuditLog> {
    return this.log(
      context,
      'SYNC',
      'SYSTEM',
      `Completed ${syncType} sync: ${recordsProcessed} records processed`,
      {
        metadata: {
          syncType,
          recordsProcessed,
          errors,
          hasErrors: (errors?.length || 0) > 0,
        },
      }
    );
  }

  /**
   * Get audit logs for an entity
   */
  async getLogsForEntity(
    entityType: string,
    entityId?: string
  ): Promise<AuditLog[]> {
    const storage = await getStorage();
    return storage.getAuditLogsByEntity(entityType, entityId);
  }

  /**
   * Get audit logs for a user
   */
  async getLogsForUser(userId: string): Promise<AuditLog[]> {
    const storage = await getStorage();
    return storage.getAuditLogsByUser(userId);
  }

  /**
   * Get audit logs for a date range
   */
  async getLogsForDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    const storage = await getStorage();
    return storage.getAuditLogsByDateRange(startDate, endDate);
  }

  /**
   * Get all audit logs
   */
  async getAllLogs(): Promise<AuditLog[]> {
    const storage = await getStorage();
    return storage.getAllAuditLogs();
  }
}

// Singleton instance
export const auditService = new AuditService();
