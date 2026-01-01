import { z } from 'zod';
import { AuditAction } from '../utils/validators';

/**
 * Audit Log Entry - tracks all system actions
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  
  // Action details
  action: AuditAction,
  entityType: z.enum(['CLIENT_POLICY', 'BILLABLE_EVENT', 'INVOICE_LINK', 'SYSTEM', 'USER']),
  entityId: z.string().optional(),
  
  // Who performed the action
  userId: z.string(),
  userName: z.string().optional(),
  userEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  
  // What changed
  description: z.string(),
  previousValue: z.record(z.unknown()).optional(),
  newValue: z.record(z.unknown()).optional(),
  
  // Additional context
  metadata: z.record(z.unknown()).optional(),
  
  // Timestamp
  timestamp: z.string(),
  
  // Related entities
  relatedEntities: z.array(z.object({
    entityType: z.string(),
    entityId: z.string(),
  })).default([]),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * Create an audit log entry
 */
export function createAuditLog(input: {
  action: z.infer<typeof AuditAction>;
  entityType: 'CLIENT_POLICY' | 'BILLABLE_EVENT' | 'INVOICE_LINK' | 'SYSTEM' | 'USER';
  entityId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  relatedEntities?: Array<{ entityType: string; entityId: string }>;
}): AuditLog {
  return AuditLogSchema.parse({
    id: crypto.randomUUID(),
    ...input,
    timestamp: new Date().toISOString(),
    relatedEntities: input.relatedEntities || [],
  });
}

/**
 * Format audit log for display
 */
export function formatAuditLogEntry(log: AuditLog): string {
  const timestamp = new Date(log.timestamp).toLocaleString();
  const user = log.userName || log.userId;
  
  return `[${timestamp}] ${user}: ${log.action} ${log.entityType}${log.entityId ? ` (${log.entityId})` : ''} - ${log.description}`;
}

/**
 * Filter audit logs by entity
 */
export function filterByEntity(
  logs: AuditLog[],
  entityType: string,
  entityId?: string
): AuditLog[] {
  return logs.filter(log => {
    if (log.entityType !== entityType) return false;
    if (entityId && log.entityId !== entityId) return false;
    return true;
  });
}

/**
 * Filter audit logs by date range
 */
export function filterByDateRange(
  logs: AuditLog[],
  startDate: Date,
  endDate: Date
): AuditLog[] {
  return logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= startDate && logDate <= endDate;
  });
}

/**
 * Filter audit logs by user
 */
export function filterByUser(logs: AuditLog[], userId: string): AuditLog[] {
  return logs.filter(log => log.userId === userId);
}
