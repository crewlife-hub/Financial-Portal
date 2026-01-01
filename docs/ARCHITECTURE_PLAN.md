# Crew Life at Sea – Financial Portal Architecture Plan

## Overview

**Goal**: Single source of truth for crew recruitment billing, invoice tracking, commission calculations, and payment reconciliation.

**Non-Negotiables**:
- Store ALL Smartsheet column IDs permanently (never ask user to paste again)
- Control Number is a key identifier everywhere (not only PIN)
- Mapping Matrix tracks hardcoded vs mapped fields with usage counts
- Separate repo from recruiter portal
- Header-aware writing only for Google Sheets (no layout changes)

---

## 1. Repository Structure

```
Financial-Portal/
├── src/
│   ├── config/
│   │   ├── smartsheet-sources.json    # All sheet IDs + ALL column mappings
│   │   ├── client-policies.json       # Contract rules per client
│   │   ├── qbo-config.json            # QBO settings + customer names
│   │   └── mapping-matrix.json        # Hardcoded vs mapped tracking
│   ├── services/
│   │   ├── QBOSyncService.ts          # QuickBooks sync (invoices, payments)
│   │   ├── SmartsheetSyncService.ts   # Smartsheet data pull
│   │   ├── ReconciliationService.ts   # QBO ↔ Smartsheet matching
│   │   ├── PolicyService.ts           # Contract rule evaluation
│   │   ├── BillableEventService.ts    # Detect billable events
│   │   ├── InvoiceService.ts          # Invoice generation + validation
│   │   └── AuditService.ts            # Audit logging for all actions
│   ├── models/
│   │   ├── CrewPlacement.ts           # Core placement entity
│   │   ├── Invoice.ts                 # Invoice entity
│   │   ├── Payment.ts                 # Payment entity
│   │   ├── PolicyRule.ts              # Policy rule entity
│   │   ├── Exception.ts               # Exception/alert entity
│   │   └── AuditEvent.ts              # Audit log entry
│   ├── integrations/
│   │   ├── quickbooks/
│   │   ├── smartsheet/
│   │   └── googleappsscript/
│   ├── storage/
│   │   └── JsonFileStorage.ts         # Local file storage
│   └── server.ts                      # API server
├── docs/
│   ├── ARCHITECTURE_PLAN.md           # This file
│   ├── DATA_MODEL.md                  # Entity definitions
│   └── IMPLEMENTATION_TASKS.md        # Epic/task breakdown
├── public/
│   └── index.html                     # Dashboard UI
└── package.json
```

---

## 2. Data Model

### Core Entities

#### CrewPlacement
```typescript
{
  id: string;
  pin: string;                    // Primary identifier
  controlNumber: string;          // Secondary identifier
  email: string;                  // Fallback identifier
  firstName: string;
  lastName: string;
  company: string;                // Client code (rcg, costa, etc.)
  vessel: string;
  embarkationDate: Date;
  signOffDate?: Date;
  thirtyDayMark?: Date;
  billingMode: 'one_time_fee' | 'daily_rate';
  workflowState: string;
  sourceSheet: string;
  sourceRowId: string;
}
```

#### Invoice
```typescript
{
  id: string;
  qboInvoiceId?: string;
  invoiceNumber: string;
  client: string;
  currency: string;
  amount: number;
  invoiceDate: Date;
  dueDate: Date;
  serviceDate?: Date;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';
  crewPins: string[];             // PIN(s) on this invoice
  controlNumbers: string[];       // Control number(s)
  createdAt: Date;
  paidAt?: Date;
}
```

#### Payment
```typescript
{
  id: string;
  qboPaymentId?: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  unappliedAmount: number;
}
```

#### PolicyRule
```typescript
{
  client: string;
  currency: string;
  eligibilityTrigger: string;
  invoiceDueDays: number;
  invoiceDeadlineDays?: number;
  feeModel: object;
  refundPolicy: object;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}
```

#### Exception
```typescript
{
  id: string;
  type: 'missing_pin' | 'unmatched_invoice' | 'duplicate' | 'late_invoice' | 'deadline_risk';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  relatedPin?: string;
  relatedInvoice?: string;
  createdAt: Date;
  resolvedAt?: Date;
}
```

#### AuditEvent
```typescript
{
  id: string;
  eventType: string;              // sync_run, rule_update, manual_override, invoice_created, payment_matched
  actor: string;
  timestamp: Date;
  details: object;
  affectedEntities: string[];
}
```

---

## 3. Billing Modes

### Mode 1: One-Time Fee (OTF)
- **Source**: Seabound Master sheet
- **Trigger**: Embarkation or 30 days completed (client-dependent)
- **Clients**: RCG, QRC, Crystal, CSCS, Seachefs Ocean, Costa new hire

### Mode 2: Daily Rate
- **Source**: Costa Day Count sheet, Seachefs River sheet
- **Trigger**: Monthly billing based on days onboard
- **Clients**: Costa rehire, Seachefs River

---

## 4. Matching Strategy

**Identifier Priority**:
1. **PIN** (primary) - unique crew identifier
2. **Control Number** (secondary) - placement-specific
3. **Email** (fallback) - when PIN missing

**Edge Cases**:
- Missing PIN → flag as exception, attempt control number match
- Duplicate control numbers → flag for manual review
- Rehires → check historical onboard dates

---

## 5. Rule Engine Evaluation Order

```
1. Validate crew has required identifiers (PIN or Control Number)
2. Look up client from company field
3. Load policy rules for client
4. Check eligibility trigger (embarked vs 30 days completed)
5. Check returning crew exclusion (RCG/QRC 12-month rule)
6. Calculate fee based on stripe/group/position
7. Check invoice deadline (120-day rule for RCG/QRC)
8. Check duplicate invoice prevention
9. Generate invoice or flag exception
```

---

## 6. Guardrails & Risk Rules

| Rule | Clients | Enforcement |
|------|---------|-------------|
| No invoice before 30 days | RCG, QRC | Hard block |
| Invoice deadline 120 days | RCG, QRC | Auto-lock, forfeit warning |
| Duplicate prevention | All | Same PIN + contract window = block |
| Returning crew no fee | RCG, QRC | Check 12-month history |
| Stripe-based fee | RCG, QRC | Fee by stripe, not title |

---

## 7. Integration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Smartsheet │────▶│   Portal    │◀────│     QBO     │
│  (Who/When) │     │  (Merge &   │     │ (Financial  │
│             │     │  Validate)  │     │   Truth)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Dashboard  │
                    │  + Alerts   │
                    └─────────────┘
```

---

## 8. Outstanding Questions (Need User Input)

Before implementation, confirm:

1. **QBO Customer names** (exact as they appear):
   - RCG = ?
   - QRC = ?
   - Costa = ?
   - Seachefs = ?
   - CSCS = ?
   - Crystal = ?

2. **PIN location in QBO**:
   - Custom field name?
   - Memo field?
   - Line description?

3. **Invoice structure**:
   - One invoice per crew?
   - Or batched monthly?

---

## 9. Next Steps

1. ✅ Plan approved (this document)
2. ⏳ User provides QBO customer names
3. ⏳ Implement config modules with all mappings
4. ⏳ Implement QBO sync service
5. ⏳ Implement Smartsheet sync service
6. ⏳ Implement matching engine
7. ⏳ Build dashboard + exception queue
8. ⏳ Testing + migration of historical data
