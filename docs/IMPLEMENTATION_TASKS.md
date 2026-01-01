# Financial Portal – Implementation Tasks

## Epic 1: Configuration & Data Model Setup

### Task 1.1: Finalize Smartsheet Column Mappings
- **Status**: ✅ Complete
- **Acceptance Criteria**:
  - All 3 sheets have ALL column IDs stored
  - Column mapping JSON validated
  - Identifier priority defined (PIN > Control Number > Email)

### Task 1.2: Finalize Client Policy Rules
- **Status**: ✅ Complete
- **Acceptance Criteria**:
  - All 8 clients have policy JSON configs
  - Fee models defined per client
  - Refund/clawback rules captured
  - Risk levels assigned

### Task 1.3: QBO Customer Name Mapping
- **Status**: ⏳ Awaiting user input
- **Acceptance Criteria**:
  - Exact QBO customer names confirmed for all clients
  - PIN location in QBO confirmed

### Task 1.4: Build Mapping Matrix System
- **Status**: ✅ Structure created
- **Acceptance Criteria**:
  - Track hardcoded vs mapped fields
  - Track usage counts per mapping
  - Track last updated + updated by
  - Identify missing mappings

---

## Epic 2: QBO Sync Service

### Task 2.1: Invoice Sync
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Pull invoices with robust pagination
  - Extract PIN from custom field / memo / description
  - Store in staging sheet with headers preserved
  - Log sync runs to audit

### Task 2.2: Payment Sync
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Pull payments with pagination
  - Link to invoices
  - Track unapplied amounts

### Task 2.3: Invoice Lines Extraction
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Extract line items per invoice
  - Parse PIN from line descriptions
  - Handle multi-crew invoices

---

## Epic 3: Smartsheet Sync Service

### Task 3.1: Seabound Master Sync
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Pull all rows with finance-relevant columns
  - Extract PIN, Control Number, Email, Company
  - Parse finance status (Yellow/Green/Blue)
  - Store 30-day mark dates

### Task 3.2: Costa Daily Rate Sync
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Pull daily rate rows
  - Calculate monthly totals
  - Track payment status

### Task 3.3: Seachefs River Daily Rate Sync
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Pull river daily rate rows
  - Calculate monthly totals
  - Track payment status

---

## Epic 4: Matching Engine

### Task 4.1: QBO ↔ Smartsheet Matching
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Join on PIN (primary)
  - Fallback to Control Number (secondary)
  - Fallback to Email (tertiary)
  - Flag unmatched records as exceptions

### Task 4.2: Duplicate Detection
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Detect same PIN + same contract window
  - Block duplicate invoices
  - Log to audit

### Task 4.3: Exception Queue
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Missing PIN exceptions
  - Unmatched invoice lines
  - Late invoice warnings (120-day deadline)
  - Returning crew alerts

---

## Epic 5: Policy Engine

### Task 5.1: Eligibility Evaluation
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Check trigger per client (embarked vs 30 days)
  - Check returning crew exclusion
  - Validate referral validity period

### Task 5.2: Fee Calculation
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Calculate OTF fees by group/stripe
  - Calculate daily rate fees
  - Handle multi-currency (EUR, USD, GBP, ZAR)

### Task 5.3: Invoice Deadline Enforcement
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - 5-day invoice window (RCG/QRC)
  - 120-day hard deadline (RCG/QRC)
  - Auto-lock and forfeit warning

---

## Epic 6: Dashboard & Reporting

### Task 6.1: Client Totals View
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Billed / Paid / Outstanding per client
  - Currency breakdown
  - Period filters

### Task 6.2: Crew-Level Reconciliation
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Search by PIN / Control Number / Email
  - Show all invoices + payments for crew
  - Show placement history

### Task 6.3: Exception Queue UI
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - List all open exceptions
  - Severity indicators
  - Resolution actions

---

## Epic 7: Audit & Compliance

### Task 7.1: Audit Logging
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Log all sync runs
  - Log rule updates
  - Log manual overrides
  - Log invoice/payment events

### Task 7.2: Retention Policy
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - 3-year minimum retention (RCG requirement)
  - Exportable audit trail

---

## Epic 8: Migration & Historical Data

### Task 8.1: Import Historical QBO Data
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Backfill invoices from last 12 months
  - Backfill payments
  - Reconcile with existing Smartsheet statuses

### Task 8.2: Validate Existing Invoice Statuses
- **Status**: ⏳ Not started
- **Acceptance Criteria**:
  - Compare Smartsheet $ column with QBO balances
  - Flag discrepancies

---

## Priority Order

1. **Epic 1** - Config & Data Model (Foundation)
2. **Epic 2** - QBO Sync (Get financial data)
3. **Epic 3** - Smartsheet Sync (Get operational data)
4. **Epic 4** - Matching Engine (Reconcile)
5. **Epic 5** - Policy Engine (Enforce rules)
6. **Epic 6** - Dashboard (Visibility)
7. **Epic 7** - Audit (Compliance)
8. **Epic 8** - Migration (Historical)

---

## Guardrails (DO NOT BREAK)

- ❌ Never modify Smartsheet layout/columns
- ❌ Never create duplicate invoices
- ❌ Never invoice before eligibility trigger
- ❌ Never miss 120-day deadline alerts
- ✅ Always log to audit trail
- ✅ Always preserve header-aware writing
- ✅ Always use Control Number alongside PIN
