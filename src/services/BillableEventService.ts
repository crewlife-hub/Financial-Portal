import { getStorage } from '../storage';
import {
  BillableEvent,
  createBillableEvent,
  updateEventStatus,
  SourceData,
} from '../models/BillableEvent';
import { policyService } from './PolicyService';
import { idempotencyService } from './IdempotencyService';
import { auditService, RequestContext } from './AuditService';
import { createLogger } from '../utils/Logger';
import { NotFoundError, ValidationError, DuplicateError } from '../utils/errors';
import { BillableEventStatus, FeeType, CurrencyCode } from '../utils/validators';
import { z } from 'zod';

const logger = createLogger('BillableEventService');

/**
 * Billable Event Service - Manages billable events lifecycle
 */
export class BillableEventService {
  /**
   * Get all billable events
   */
  async getAllEvents(): Promise<BillableEvent[]> {
    const storage = await getStorage();
    return storage.getAllEvents();
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<BillableEvent> {
    const storage = await getStorage();
    const event = await storage.getEventById(id);
    
    if (!event) {
      throw new NotFoundError('BillableEvent', id);
    }
    
    return event;
  }

  /**
   * Get event by idempotency key
   */
  async getEventByIdempotencyKey(key: string): Promise<BillableEvent | null> {
    const storage = await getStorage();
    return storage.getEventByIdempotencyKey(key);
  }

  /**
   * Get events by status
   */
  async getEventsByStatus(status: z.infer<typeof BillableEventStatus>): Promise<BillableEvent[]> {
    const storage = await getStorage();
    return storage.getEventsByStatus(status);
  }

  /**
   * Get events by client
   */
  async getEventsByClient(clientId: string): Promise<BillableEvent[]> {
    const storage = await getStorage();
    return storage.getEventsByClientId(clientId);
  }

  /**
   * Get events ready to invoice (pending approval)
   */
  async getPendingEvents(): Promise<BillableEvent[]> {
    return this.getEventsByStatus('PENDING');
  }

  /**
   * Get approved events ready for QB invoice creation
   */
  async getApprovedEvents(): Promise<BillableEvent[]> {
    return this.getEventsByStatus('APPROVED');
  }

  /**
   * Create a new billable event
   * CRITICAL: Enforces idempotency key uniqueness
   */
  async createEvent(
    context: RequestContext,
    input: {
      clientId: string;
      controlNumber: string;
      candidateEmail?: string;
      candidateName?: string;
      triggerDate: string;
      triggerType: string;
      feeType: z.infer<typeof FeeType>;
      amount?: number; // If not provided, will be calculated from policy
      sourceData?: SourceData;
      notes?: string;
    }
  ): Promise<BillableEvent> {
    const storage = await getStorage();

    // Get client policy
    const policy = await policyService.getPolicyByClientId(input.clientId);
    if (!policy) {
      throw new ValidationError('No active policy found for client', {
        clientId: 'No active billing policy',
      });
    }

    // Validate idempotency key (throws DuplicateError if exists)
    const idempotencyKey = await idempotencyService.validateBeforeCreate(
      policy.clientCode,
      input.controlNumber,
      input.triggerDate,
      input.feeType
    );

    // Calculate fee if not provided
    let amount = input.amount;
    if (amount === undefined) {
      const feeCalc = policyService.calculateFee(
        policy,
        input.feeType,
        input.sourceData?.salary
      );
      if (!feeCalc) {
        throw new ValidationError('Unable to calculate fee', {
          feeType: `No fee rule found for ${input.feeType}`,
        });
      }
      amount = feeCalc.amount;
    }

    // Create the event
    const event = createBillableEvent({
      clientId: input.clientId,
      clientCode: policy.clientCode,
      clientName: policy.clientName,
      controlNumber: input.controlNumber,
      candidateEmail: input.candidateEmail,
      candidateName: input.candidateName,
      triggerDate: input.triggerDate,
      triggerType: input.triggerType,
      feeType: input.feeType,
      amount,
      currency: policy.currency,
      policyId: policy.id,
      policyVersion: policy.version,
      sourceData: input.sourceData,
      createdBy: context.userId,
      notes: input.notes,
    });

    await storage.saveEvent(event);

    // Audit log
    await auditService.logEventCreate(
      context,
      event.id,
      idempotencyKey,
      event as unknown as Record<string, unknown>
    );

    logger.info('Billable event created', {
      eventId: event.id,
      idempotencyKey,
      amount,
      currency: policy.currency,
    });

    return event;
  }

  /**
   * Approve a billable event for invoicing
   * This is the human approval step before creating an invoice in QB
   */
  async approveEvent(
    context: RequestContext,
    id: string,
    notes?: string
  ): Promise<BillableEvent> {
    const storage = await getStorage();
    const event = await this.getEventById(id);

    // Validate current status
    if (event.status !== 'PENDING' && event.status !== 'HOLD') {
      throw new ValidationError('Event cannot be approved', {
        status: `Current status is ${event.status}, expected PENDING or HOLD`,
      });
    }

    // Update status
    const updated = updateEventStatus(event, 'APPROVED', context.userId, notes);
    updated.approvedAt = new Date().toISOString();
    updated.approvedBy = context.userId;
    updated.approvalNotes = notes;

    await storage.updateEvent(id, updated);

    // Audit log
    await auditService.logEventApprove(
      context,
      id,
      event.idempotencyKey,
      notes
    );

    logger.info('Billable event approved', {
      eventId: id,
      idempotencyKey: event.idempotencyKey,
    });

    return updated;
  }

  /**
   * Put an event on hold
   */
  async holdEvent(
    context: RequestContext,
    id: string,
    reason: string
  ): Promise<BillableEvent> {
    const storage = await getStorage();
    const event = await this.getEventById(id);

    // Validate - can only hold pending or approved events
    if (event.status !== 'PENDING' && event.status !== 'APPROVED') {
      throw new ValidationError('Event cannot be put on hold', {
        status: `Current status is ${event.status}`,
      });
    }

    const updated = updateEventStatus(event, 'HOLD', context.userId, reason);
    updated.holdReason = reason;
    updated.holdAt = new Date().toISOString();
    updated.holdBy = context.userId;

    await storage.updateEvent(id, updated);

    // Audit log
    await auditService.logEventHold(
      context,
      id,
      event.idempotencyKey,
      reason
    );

    logger.info('Billable event put on hold', {
      eventId: id,
      reason,
    });

    return updated;
  }

  /**
   * Mark event as invoiced (called after QB invoice creation)
   */
  async markAsInvoiced(
    context: RequestContext,
    id: string
  ): Promise<BillableEvent> {
    const storage = await getStorage();
    const event = await this.getEventById(id);

    if (event.status !== 'APPROVED') {
      throw new ValidationError('Only approved events can be marked as invoiced', {
        status: event.status,
      });
    }

    const updated = updateEventStatus(
      event,
      'INVOICED',
      context.userId,
      'Invoice created in QuickBooks'
    );

    await storage.updateEvent(id, updated);

    logger.info('Billable event marked as invoiced', {
      eventId: id,
      idempotencyKey: event.idempotencyKey,
    });

    return updated;
  }

  /**
   * Mark event as paid
   */
  async markAsPaid(context: RequestContext, id: string): Promise<BillableEvent> {
    const storage = await getStorage();
    const event = await this.getEventById(id);

    const updated = updateEventStatus(
      event,
      'PAID',
      context.userId,
      'Payment received'
    );

    await storage.updateEvent(id, updated);

    logger.info('Billable event marked as paid', { eventId: id });

    return updated;
  }

  /**
   * Bulk create events from Smartsheet data
   * Returns created events and any duplicates that were skipped
   */
  async bulkCreateFromSmartsheet(
    context: RequestContext,
    placements: Array<{
      clientId: string;
      controlNumber: string;
      candidateEmail?: string;
      candidateName?: string;
      triggerDate: string;
      triggerType: string;
      feeType: z.infer<typeof FeeType>;
      sourceData?: SourceData;
    }>
  ): Promise<{
    created: BillableEvent[];
    duplicates: Array<{ controlNumber: string; idempotencyKey: string }>;
    errors: Array<{ controlNumber: string; error: string }>;
  }> {
    const created: BillableEvent[] = [];
    const duplicates: Array<{ controlNumber: string; idempotencyKey: string }> = [];
    const errors: Array<{ controlNumber: string; error: string }> = [];

    for (const placement of placements) {
      try {
        const event = await this.createEvent(context, placement);
        created.push(event);
      } catch (error) {
        if (error instanceof DuplicateError) {
          duplicates.push({
            controlNumber: placement.controlNumber,
            idempotencyKey: error.idempotencyKey,
          });
        } else {
          errors.push({
            controlNumber: placement.controlNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    logger.info('Bulk create completed', {
      total: placements.length,
      created: created.length,
      duplicates: duplicates.length,
      errors: errors.length,
    });

    return { created, duplicates, errors };
  }

  /**
   * Get ready-to-invoice list for UI
   */
  async getReadyToInvoiceList(): Promise<Array<{
    id: string;
    idempotencyKey: string;
    clientCode: string;
    clientName: string;
    controlNumber: string;
    candidateName: string;
    triggerDate: string;
    feeType: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    canApprove: boolean;
  }>> {
    const events = await this.getPendingEvents();

    return events.map(event => ({
      id: event.id,
      idempotencyKey: event.idempotencyKey,
      clientCode: event.clientCode,
      clientName: event.clientName,
      controlNumber: event.controlNumber,
      candidateName: event.candidateName || 'N/A',
      triggerDate: event.triggerDate,
      feeType: event.feeType.replace(/_/g, ' '),
      amount: event.amount,
      currency: event.currency,
      status: event.status,
      createdAt: event.createdAt,
      canApprove: event.status === 'PENDING',
    }));
  }
}

// Singleton instance
export const billableEventService = new BillableEventService();
