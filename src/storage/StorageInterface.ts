import { ClientPolicy } from '../models/ClientPolicy';
import { BillableEvent } from '../models/BillableEvent';
import { InvoiceLink } from '../models/InvoiceLink';
import { AuditLog } from '../models/AuditLog';

/**
 * Storage Interface - Abstract storage layer for the portal
 * Implementations: JsonFileStorage, GoogleSheetsStorage, DatabaseStorage
 */
export interface StorageInterface {
  // Initialize storage
  initialize(): Promise<void>;
  
  // =========================================================================
  // Client Policies
  // =========================================================================
  getAllPolicies(): Promise<ClientPolicy[]>;
  getPolicyById(id: string): Promise<ClientPolicy | null>;
  getPolicyByClientId(clientId: string): Promise<ClientPolicy | null>;
  getPolicyByClientCode(clientCode: string): Promise<ClientPolicy | null>;
  savePolicy(policy: ClientPolicy): Promise<ClientPolicy>;
  updatePolicy(id: string, updates: Partial<ClientPolicy>): Promise<ClientPolicy>;
  deletePolicy(id: string): Promise<boolean>;
  
  // =========================================================================
  // Billable Events
  // =========================================================================
  getAllEvents(): Promise<BillableEvent[]>;
  getEventById(id: string): Promise<BillableEvent | null>;
  getEventByIdempotencyKey(key: string): Promise<BillableEvent | null>;
  getEventsByClientId(clientId: string): Promise<BillableEvent[]>;
  getEventsByStatus(status: string): Promise<BillableEvent[]>;
  saveEvent(event: BillableEvent): Promise<BillableEvent>;
  updateEvent(id: string, updates: Partial<BillableEvent>): Promise<BillableEvent>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Check if idempotency key exists (critical for duplicate prevention)
  idempotencyKeyExists(key: string): Promise<boolean>;
  
  // =========================================================================
  // Invoice Links
  // =========================================================================
  getAllInvoiceLinks(): Promise<InvoiceLink[]>;
  getInvoiceLinkById(id: string): Promise<InvoiceLink | null>;
  getInvoiceLinkByEventId(billableEventId: string): Promise<InvoiceLink | null>;
  getInvoiceLinkByQbInvoiceId(qbInvoiceId: string): Promise<InvoiceLink | null>;
  getInvoiceLinksByStatus(status: string): Promise<InvoiceLink[]>;
  getOverdueInvoiceLinks(): Promise<InvoiceLink[]>;
  saveInvoiceLink(link: InvoiceLink): Promise<InvoiceLink>;
  updateInvoiceLink(id: string, updates: Partial<InvoiceLink>): Promise<InvoiceLink>;
  
  // =========================================================================
  // Audit Logs
  // =========================================================================
  getAllAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId?: string): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string): Promise<AuditLog[]>;
  getAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]>;
  saveAuditLog(log: AuditLog): Promise<AuditLog>;
  
  // =========================================================================
  // Utility
  // =========================================================================
  backup(): Promise<string>; // Returns backup path/id
  restore(backupId: string): Promise<void>;
}

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
