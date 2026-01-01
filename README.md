# Crew Finance Portal

Flawless invoicing/payment tracking integrated with Smartsheet + QuickBooks Online (multi-currency), with strict anti-duplicate controls.

## Core Principles

1. **QuickBooks Online is the source of truth** for invoice + payment status
2. **Strict anti-duplicate controls** using idempotency keys: `CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE`
3. **Two-step approval flow**: System proposes "Billable Events" → Human approves → Invoice created in QuickBooks
4. **Full audit trail** for every action (who/when/what changed)

## Project Structure

```
crew-finance-portal/
├── src/
│   ├── server.ts                 # Express server entry point
│   ├── config/
│   │   └── index.ts              # Configuration loader
│   ├── models/                   # Data models & schemas
│   │   ├── index.ts
│   │   ├── ClientPolicy.ts       # Client billing policies
│   │   ├── BillableEvent.ts      # Billable events tracking
│   │   ├── InvoiceLink.ts        # QB invoice linkage
│   │   └── AuditLog.ts           # Audit trail
│   ├── storage/                  # Storage layer abstraction
│   │   ├── index.ts
│   │   ├── StorageInterface.ts   # Abstract storage interface
│   │   ├── JsonFileStorage.ts    # JSON file storage (Phase 1)
│   │   └── GoogleSheetsStorage.ts# Google Sheets storage (optional)
│   ├── services/                 # Business logic
│   │   ├── index.ts
│   │   ├── PolicyService.ts      # Policy management
│   │   ├── BillableEventService.ts # Billable event processing
│   │   ├── InvoiceService.ts     # Invoice lifecycle
│   │   ├── ReconciliationService.ts # QB sync & reconciliation
│   │   ├── IdempotencyService.ts # Duplicate prevention
│   │   └── AuditService.ts       # Audit logging
│   ├── integrations/             # External system connectors
│   │   ├── index.ts
│   │   ├── smartsheet/
│   │   │   ├── SmartsheetClient.ts
│   │   │   └── PlacementMapper.ts
│   │   └── quickbooks/
│   │       ├── QuickBooksClient.ts
│   │       ├── InvoiceMapper.ts
│   │       └── PaymentMapper.ts
│   ├── api/                      # REST API routes
│   │   ├── index.ts
│   │   ├── policies.ts
│   │   ├── billableEvents.ts
│   │   ├── invoices.ts
│   │   ├── reconciliation.ts
│   │   └── auth.ts
│   ├── utils/
│   │   ├── Logger.ts             # Winston logger wrapper
│   │   ├── errors.ts             # Custom error classes
│   │   └── validators.ts         # Input validation helpers
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── public/                       # Frontend static files
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       ├── pages/
│       │   ├── policyMatrix.js
│       │   ├── readyToInvoice.js
│       │   ├── invoiceDetail.js
│       │   └── reconciliation.js
│       └── utils/
│           └── api.js
├── data/                         # JSON storage (Phase 1)
│   ├── clientPolicies.json
│   ├── billableEvents.json
│   ├── invoiceLinks.json
│   └── auditLogs.json
├── logs/                         # Application logs
├── tests/                        # Test files
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Phases

### Phase 1: Read-Only Portal + Ledger ✅
- [x] Data models and storage layer
- [x] Policy Matrix UI (view/edit policies)
- [x] Ready to Invoice list (Smartsheet data + policy matching)
- [x] Billable Events ledger (JSON/Google Sheets)
- [x] Idempotency key generation and validation
- [x] Full audit logging
- [ ] Smartsheet read integration

### Phase 2: Invoice Creation
- [ ] QB OAuth2 authentication flow
- [ ] Approve billable event → Create invoice in QB
- [ ] Store idempotency key in QB invoice (memo/custom field)
- [ ] Invoice detail page with QB link
- [ ] Invoice status sync from QB

### Phase 3: Reconciliation + Overdue
- [ ] Scheduled QB invoice status polling
- [ ] Payment tracking and reconciliation
- [ ] Overdue invoice alerts
- [ ] Reconciliation dashboard

## Data Models

### ClientPolicy
- Client billing rules, fee structures, currency settings
- Trigger rules (when to bill)
- Terms and refund policies
- Required proof documents
- Billing contacts

### BillableEvent
- Linked to client/policy
- Contains idempotency key: `CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE`
- Status: Pending → Approved → Invoiced → Paid → (Hold/Refunded)
- Tracks policy version at time of event

### InvoiceLink
- Links BillableEvent to QuickBooks invoice
- Tracks QB invoice ID, number, status
- Payment tracking

## API Endpoints

### Policies
- `GET /api/policies` - List all client policies
- `GET /api/policies/:clientId` - Get specific policy
- `POST /api/policies` - Create policy
- `PUT /api/policies/:clientId` - Update policy

### Billable Events
- `GET /api/billable-events` - List events (with filters)
- `GET /api/billable-events/:id` - Get event details
- `POST /api/billable-events/generate` - Generate from Smartsheet
- `POST /api/billable-events/:id/approve` - Approve for invoicing
- `POST /api/billable-events/:id/hold` - Put on hold

### Invoices
- `GET /api/invoices` - List invoices
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices/create` - Create invoice in QB (Phase 2)

### Reconciliation
- `GET /api/reconciliation/summary` - Dashboard data
- `POST /api/reconciliation/sync` - Sync from QB (Phase 3)

## Setup

1. Copy `.env.example` to `.env` and configure
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run: `npm start`

## Development

```bash
npm run dev    # Run with ts-node
npm run lint   # Lint code
npm run test   # Run tests
```
