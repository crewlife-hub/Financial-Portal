/**
 * Crew Finance Portal - TypeScript Type Definitions
 * Core types for the financial portal system
 */

// ============================================================================
// ENUMS
// ============================================================================

export type Currency = 'USD' | 'EUR' | 'GBP' | 'ZAR';

export type BillingCategory = 'recruitment_manning' | 'affiliate_training' | 'training_referral';

export type EligibilityTrigger = 
  | 'embarked'
  | '30_days_completed'
  | 'employment_contract_signed'
  | 'hire_or_rehire'
  | 'lms_sale'
  | 'training_completed_and_paid';

export type BillableEventStatus = 
  | 'pending'
  | 'approved'
  | 'invoiced'
  | 'paid'
  | 'partial'
  | 'hold'
  | 'refunded'
  | 'rejected';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type FeeType = 'one_time_fee' | 'daily_rate' | 'commission' | 'percentage';

export type AuditEventType =
  | 'policy_created'
  | 'policy_updated'
  | 'billable_event_detected'
  | 'billable_event_approved'
  | 'billable_event_rejected'
  | 'billable_event_hold'
  | 'invoice_created'
  | 'invoice_sent'
  | 'payment_received'
  | 'payment_matched'
  | 'sync_smartsheet'
  | 'sync_qbo'
  | 'manual_override'
  | 'exception_flagged'
  | 'exception_resolved';

export type ExceptionType =
  | 'missing_pin'
  | 'missing_control_number'
  | 'unmatched_invoice'
  | 'duplicate_detected'
  | 'late_invoice_risk'
  | 'deadline_exceeded'
  | 'returning_crew_detected'
  | 'fee_calculation_error'
  | 'currency_mismatch';

export type ExceptionSeverity = 'info' | 'warning' | 'critical';

// ============================================================================
// CLIENT POLICY
// ============================================================================

export interface FeeModel {
  type?: FeeType;
  groups?: Record<string, number>;
  newHire?: { rating: number; officer: number };
  rehire?: { type?: string; perDay?: number; ratingPerDay?: number; officerPerDay?: number };
  entryLevel?: { stripes: number; fee: number };
  specialty?: { stripes: string; fee: number };
  management?: { stripes: string; fee: string };
  marineOfficer?: string;
  perDay?: number;
  standard?: number;
  discounted?: number;
  rate?: number;
}

export interface RefundPolicy {
  probationDays?: number;
  refund?: string;
  reason?: string;
  rule?: string;
  within30Days?: string;
  tracking?: string[];
  autoDisqualification?: string[];
  autoNonPayment?: string[];
  partialFees?: boolean;
}

export interface ClientPolicy {
  clientId: string;
  clientCode: string;
  displayName: string;
  qboCustomerName: string | null;
  currency: Currency;
  category: BillingCategory;
  eligibilityTrigger: EligibilityTrigger;
  
  // Timing
  referralValidityDays?: number;
  ctracValidityDays?: number;
  offerAcceptanceWindowDays?: number;
  invoiceWindowDays?: number;
  invoiceDueDays: number;
  invoiceDeadlineDays?: number;
  invoiceCycle?: string;
  paymentDay?: number;
  
  // Fees
  feeModel: FeeModel;
  
  // Rules
  returningCrew?: { withinMonths: number; fee: string };
  refundPolicy: RefundPolicy | string;
  
  // Metadata
  riskLevel: RiskLevel;
  portalEnforcement: string[];
  auditRetentionYears?: number;
  billingContact: string | null;
  invoiceEmail?: string;
  notes: string | null;
  policyVersion: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CREW & PLACEMENT
// ============================================================================

export interface CrewIdentifiers {
  pin: string | null;
  pinKey?: string | null;
  controlNumber: string | null;
  email: string | null;
}

export interface CrewPlacement {
  id: string;
  identifiers: CrewIdentifiers;
  firstName: string;
  lastName: string;
  clientId: string;
  vessel?: string;
  position?: string;
  stripe?: number;
  group?: string;
  
  // Dates
  embarkationDate: string | null;
  signOffDate?: string | null;
  thirtyDayMark?: string | null;
  allSignOnDates?: string;
  
  // Source tracking
  sourceSheet: string;
  sourceRowId: string;
  
  // Billing
  billingMode: 'one_time_fee' | 'daily_rate';
  daysOnboard?: number;
  dailyRate?: number;
  
  // Status
  financeStatus?: 'pending' | 'invoiced' | 'paid';
  invoiceNumber?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// BILLABLE EVENT
// ============================================================================

export interface BillableEvent {
  id: string;
  idempotencyKey: string; // CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
  
  // Links
  clientId: string;
  policyVersion: number;
  crewPlacementId?: string;
  
  // Crew info (denormalized for display)
  crew: {
    pin: string | null;
    controlNumber: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
    position?: string;
    vessel?: string;
  };
  
  // Trigger
  triggerType: EligibilityTrigger;
  triggerDate: string;
  
  // Billing
  feeType: FeeType;
  currency: Currency;
  amount: number;
  calculationDetails?: {
    feeGroup?: string;
    stripe?: number;
    daysOnboard?: number;
    dailyRate?: number;
    billingPeriod?: { from: string; to: string };
  };
  
  // Status
  status: BillableEventStatus;
  statusHistory: Array<{
    status: BillableEventStatus;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
  
  // Approval
  approvedAt?: string;
  approvedBy?: string;
  
  // Invoice link
  invoiceLinkId?: string;
  
  // Metadata
  sourceSheet: string;
  sourceRowId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// INVOICE LINK
// ============================================================================

export interface InvoiceLink {
  id: string;
  billableEventId: string;
  
  // QuickBooks
  qboInvoiceId: string;
  qboInvoiceNumber: string;
  qboCustomerId: string;
  qboCustomerName: string;
  
  // Invoice details
  currency: Currency;
  amount: number;
  invoiceDate: string;
  dueDate: string;
  serviceDate?: string;
  
  // Status
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'voided';
  balance: number;
  
  // Payment tracking
  payments: Array<{
    qboPaymentId: string;
    amount: number;
    paymentDate: string;
    method?: string;
  }>;
  totalPaid: number;
  
  // Idempotency
  idempotencyKey: string;
  idempotencyStoredIn: 'memo' | 'custom_field' | 'line_description';
  
  // Metadata
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  actor: string; // user email or 'system'
  timestamp: string;
  
  // Context
  clientId?: string;
  billableEventId?: string;
  invoiceLinkId?: string;
  crewPin?: string;
  crewControlNumber?: string;
  
  // Details
  action: string;
  details: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  
  // Source
  source: 'portal' | 'sync' | 'api' | 'manual';
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// EXCEPTION
// ============================================================================

export interface Exception {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  
  // Context
  clientId?: string;
  billableEventId?: string;
  crewPin?: string;
  crewControlNumber?: string;
  invoiceId?: string;
  
  // Details
  description: string;
  details: Record<string, unknown>;
  suggestedAction?: string;
  
  // Resolution
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SMARTSHEET COLUMN MAPPING
// ============================================================================

export interface SmartsheetColumn {
  title: string;
  columnId: string;
  type: string;
  values?: Record<string, string>;
}

export interface SmartsheetSheetConfig {
  name: string;
  sheetId: string;
  billingMode: 'one_time_fee' | 'daily_rate';
  client?: string;
  vesselType?: string;
  description: string;
  columns: Record<string, SmartsheetColumn>;
}

// ============================================================================
// MAPPING MATRIX
// ============================================================================

export interface MappingEntry {
  value: string | null;
  type: 'hardcoded' | 'mapped';
  status?: 'active' | 'missing' | 'deprecated';
  usageCount: number;
  lastUsed: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ============================================================================
// RECONCILIATION
// ============================================================================

export interface ReconciliationSummary {
  asOf: string;
  byClient: Record<string, {
    clientId: string;
    displayName: string;
    currency: Currency;
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueCount: number;
    overdueAmount: number;
  }>;
  exceptions: {
    open: number;
    critical: number;
  };
  lastSync: {
    smartsheet: string | null;
    qbo: string | null;
  };
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

export interface IdempotencyKey {
  key: string;
  clientCode: string;
  controlNumber: string;
  triggerDate: string;
  feeType: string;
  createdAt: string;
  billableEventId: string;
  invoiceLinkId?: string;
}

/**
 * Generate idempotency key from components
 */
export function generateIdempotencyKey(
  clientCode: string,
  controlNumber: string,
  triggerDate: string,
  feeType: string
): string {
  return `${clientCode}-${controlNumber}-${triggerDate}-${feeType}`.toUpperCase();
}

/**
 * Parse idempotency key into components
 */
export function parseIdempotencyKey(key: string): {
  clientCode: string;
  controlNumber: string;
  triggerDate: string;
  feeType: string;
} | null {
  const parts = key.split('-');
  if (parts.length < 4) return null;
  
  return {
    clientCode: parts[0],
    controlNumber: parts[1],
    triggerDate: parts[2],
    feeType: parts.slice(3).join('-')
  };
}
