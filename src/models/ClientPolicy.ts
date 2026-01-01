import { z } from 'zod';
import { CurrencyCode, FeeType, TriggerRule } from '../utils/validators';

/**
 * Fee rule definition - how fees are calculated
 */
export const FeeRuleSchema = z.object({
  feeType: FeeType,
  calculationType: z.enum(['FIXED', 'PERCENTAGE', 'TIERED']),
  // For FIXED: this is the amount
  // For PERCENTAGE: this is the percentage (e.g., 15 for 15%)
  value: z.number(),
  // For PERCENTAGE: what the percentage is based on
  percentageBase: z.enum(['SALARY', 'CONTRACT_VALUE', 'MONTHLY_RATE']).optional(),
  // Minimum and maximum fee caps
  minimumFee: z.number().optional(),
  maximumFee: z.number().optional(),
  // Tiered pricing (for TIERED type)
  tiers: z.array(z.object({
    fromAmount: z.number(),
    toAmount: z.number().optional(),
    value: z.number(),
    calculationType: z.enum(['FIXED', 'PERCENTAGE']),
  })).optional(),
});
export type FeeRule = z.infer<typeof FeeRuleSchema>;

/**
 * Billing contact information
 */
export const BillingContactSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  notifyOnInvoice: z.boolean().default(true),
  notifyOnOverdue: z.boolean().default(true),
});
export type BillingContact = z.infer<typeof BillingContactSchema>;

/**
 * Refund/Credit rules
 */
export const RefundRuleSchema = z.object({
  // Days from event date
  fullRefundDays: z.number().default(0),
  partialRefundDays: z.number().default(30),
  partialRefundPercentage: z.number().default(50),
  noRefundAfterDays: z.number().default(90),
  creditValidityDays: z.number().default(365),
  notes: z.string().optional(),
});
export type RefundRule = z.infer<typeof RefundRuleSchema>;

/**
 * Proof/documentation requirements
 */
export const ProofRequirementSchema = z.object({
  type: z.enum(['PLACEMENT_LETTER', 'CONTRACT', 'ONBOARD_CONFIRMATION', 'ID_DOCUMENT', 'OTHER']),
  required: z.boolean().default(true),
  description: z.string().optional(),
});
export type ProofRequirement = z.infer<typeof ProofRequirementSchema>;

/**
 * Client Policy - defines all billing rules for a client
 */
export const ClientPolicySchema = z.object({
  // Unique identifiers
  id: z.string().uuid(),
  clientId: z.string(), // Internal client ID
  clientCode: z.string(), // Short code for idempotency key (e.g., "ACME")
  clientName: z.string(),
  
  // Version control
  version: z.number().default(1),
  effectiveDate: z.string(), // ISO date
  expiryDate: z.string().optional(), // ISO date, if policy expires
  
  // Billing rules
  triggerRule: TriggerRule,
  feeRules: z.array(FeeRuleSchema),
  
  // Payment terms
  paymentTermsDays: z.number().default(30),
  currency: CurrencyCode,
  acceptedCurrencies: z.array(CurrencyCode).default(['USD']),
  
  // Refund and credit rules
  refundRules: RefundRuleSchema.optional(),
  
  // Documentation requirements
  proofRequired: z.array(ProofRequirementSchema).default([]),
  
  // Contacts
  billingContacts: z.array(BillingContactSchema).default([]),
  
  // QuickBooks mapping
  qbCustomerId: z.string().optional(),
  qbItemId: z.string().optional(),
  
  // Additional settings
  autoApprove: z.boolean().default(false), // Auto-approve billable events
  requireManualReview: z.boolean().default(true),
  notes: z.string().optional(),
  
  // Plain English description
  policyDescription: z.string().optional(),
  
  // Metadata
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
});

export type ClientPolicy = z.infer<typeof ClientPolicySchema>;

/**
 * Create a new client policy with defaults
 */
export function createClientPolicy(input: Partial<ClientPolicy> & {
  clientId: string;
  clientCode: string;
  clientName: string;
  triggerRule: z.infer<typeof TriggerRule>;
  feeRules: FeeRule[];
  currency: z.infer<typeof CurrencyCode>;
  createdBy: string;
}): ClientPolicy {
  const now = new Date().toISOString();
  return ClientPolicySchema.parse({
    id: crypto.randomUUID(),
    version: 1,
    effectiveDate: now.split('T')[0],
    paymentTermsDays: 30,
    acceptedCurrencies: [input.currency],
    proofRequired: [],
    billingContacts: [],
    autoApprove: false,
    requireManualReview: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.createdBy,
    ...input,
  });
}

/**
 * Generate a plain English policy description
 */
export function generatePolicyDescription(policy: ClientPolicy): string {
  const lines: string[] = [];
  
  lines.push(`Client: ${policy.clientName} (${policy.clientCode})`);
  lines.push(`Billing Currency: ${policy.currency}`);
  lines.push(`Payment Terms: Net ${policy.paymentTermsDays} days`);
  lines.push(`Trigger: ${policy.triggerRule.replace(/_/g, ' ').toLowerCase()}`);
  
  if (policy.feeRules.length > 0) {
    lines.push('\nFee Structure:');
    policy.feeRules.forEach(rule => {
      if (rule.calculationType === 'FIXED') {
        lines.push(`  - ${rule.feeType}: ${policy.currency} ${rule.value.toFixed(2)}`);
      } else if (rule.calculationType === 'PERCENTAGE') {
        lines.push(`  - ${rule.feeType}: ${rule.value}% of ${rule.percentageBase?.toLowerCase() || 'amount'}`);
      }
    });
  }
  
  if (policy.refundRules) {
    lines.push('\nRefund Policy:');
    if (policy.refundRules.fullRefundDays > 0) {
      lines.push(`  - Full refund within ${policy.refundRules.fullRefundDays} days`);
    }
    if (policy.refundRules.partialRefundDays > 0) {
      lines.push(`  - ${policy.refundRules.partialRefundPercentage}% refund within ${policy.refundRules.partialRefundDays} days`);
    }
    lines.push(`  - No refund after ${policy.refundRules.noRefundAfterDays} days`);
  }
  
  return lines.join('\n');
}
