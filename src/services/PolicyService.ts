import { getStorage } from '../storage';
import {
  ClientPolicy,
  createClientPolicy,
  generatePolicyDescription,
  FeeRule,
} from '../models/ClientPolicy';
import { auditService, RequestContext } from './AuditService';
import { createLogger } from '../utils/Logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { CurrencyCode, TriggerRule } from '../utils/validators';
import { z } from 'zod';

const logger = createLogger('PolicyService');

/**
 * Policy Service - Manages client billing policies
 */
export class PolicyService {
  /**
   * Get all client policies
   */
  async getAllPolicies(): Promise<ClientPolicy[]> {
    const storage = await getStorage();
    return storage.getAllPolicies();
  }

  /**
   * Get active policies only
   */
  async getActivePolicies(): Promise<ClientPolicy[]> {
    const all = await this.getAllPolicies();
    return all.filter(p => p.isActive);
  }

  /**
   * Get policy by ID
   */
  async getPolicyById(id: string): Promise<ClientPolicy> {
    const storage = await getStorage();
    const policy = await storage.getPolicyById(id);
    
    if (!policy) {
      throw new NotFoundError('ClientPolicy', id);
    }
    
    return policy;
  }

  /**
   * Get policy by client ID
   */
  async getPolicyByClientId(clientId: string): Promise<ClientPolicy | null> {
    const storage = await getStorage();
    return storage.getPolicyByClientId(clientId);
  }

  /**
   * Get policy by client code
   */
  async getPolicyByClientCode(clientCode: string): Promise<ClientPolicy | null> {
    const storage = await getStorage();
    return storage.getPolicyByClientCode(clientCode);
  }

  /**
   * Create a new client policy
   */
  async createPolicy(
    context: RequestContext,
    input: {
      clientId: string;
      clientCode: string;
      clientName: string;
      triggerRule: z.infer<typeof TriggerRule>;
      feeRules: FeeRule[];
      currency: z.infer<typeof CurrencyCode>;
      paymentTermsDays?: number;
      acceptedCurrencies?: z.infer<typeof CurrencyCode>[];
      notes?: string;
      policyDescription?: string;
      qbCustomerId?: string;
      qbItemId?: string;
    }
  ): Promise<ClientPolicy> {
    const storage = await getStorage();

    // Check for existing policy with same client code
    const existing = await storage.getPolicyByClientCode(input.clientCode);
    if (existing && existing.isActive) {
      throw new ValidationError('Client code already has an active policy', {
        clientCode: `Active policy exists: ${existing.id}`,
      });
    }

    const policy = createClientPolicy({
      ...input,
      createdBy: context.userId,
    });

    // Generate plain English description if not provided
    if (!policy.policyDescription) {
      policy.policyDescription = generatePolicyDescription(policy);
    }

    await storage.savePolicy(policy);

    // Audit log
    await auditService.logPolicyCreate(
      context,
      policy.id,
      policy.clientCode,
      policy as unknown as Record<string, unknown>
    );

    logger.info('Policy created', {
      policyId: policy.id,
      clientCode: policy.clientCode,
    });

    return policy;
  }

  /**
   * Update a client policy
   */
  async updatePolicy(
    context: RequestContext,
    id: string,
    updates: Partial<Omit<ClientPolicy, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<ClientPolicy> {
    const storage = await getStorage();

    const existing = await this.getPolicyById(id);
    const previousData = { ...existing };

    // Increment version if fee rules or trigger rule changed
    let version = existing.version;
    if (updates.feeRules || updates.triggerRule) {
      version = existing.version + 1;
    }

    const updated = await storage.updatePolicy(id, {
      ...updates,
      version,
      updatedBy: context.userId,
    });

    // Regenerate description if not explicitly provided
    if (!updates.policyDescription) {
      updated.policyDescription = generatePolicyDescription(updated);
      await storage.updatePolicy(id, { policyDescription: updated.policyDescription });
    }

    // Audit log
    await auditService.logPolicyUpdate(
      context,
      id,
      updated.clientCode,
      previousData as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );

    logger.info('Policy updated', {
      policyId: id,
      clientCode: updated.clientCode,
      newVersion: version,
    });

    return updated;
  }

  /**
   * Deactivate a policy (soft delete)
   */
  async deactivatePolicy(context: RequestContext, id: string): Promise<ClientPolicy> {
    return this.updatePolicy(context, id, { isActive: false });
  }

  /**
   * Get policy matrix data for UI display
   */
  async getPolicyMatrix(): Promise<Array<{
    clientCode: string;
    clientName: string;
    triggerRule: string;
    currency: string;
    paymentTerms: string;
    feeStructure: string;
    policyDescription: string;
    isActive: boolean;
    version: number;
    lastUpdated: string;
  }>> {
    const policies = await this.getAllPolicies();

    return policies.map(policy => {
      // Format fee structure for display
      const feeStructure = policy.feeRules
        .map(rule => {
          if (rule.calculationType === 'FIXED') {
            return `${rule.feeType}: ${policy.currency} ${rule.value.toFixed(2)}`;
          } else if (rule.calculationType === 'PERCENTAGE') {
            return `${rule.feeType}: ${rule.value}%`;
          }
          return `${rule.feeType}: Tiered`;
        })
        .join('; ');

      return {
        clientCode: policy.clientCode,
        clientName: policy.clientName,
        triggerRule: policy.triggerRule.replace(/_/g, ' '),
        currency: policy.currency,
        paymentTerms: `Net ${policy.paymentTermsDays}`,
        feeStructure,
        policyDescription: policy.policyDescription || '',
        isActive: policy.isActive,
        version: policy.version,
        lastUpdated: policy.updatedAt,
      };
    });
  }

  /**
   * Calculate fee amount based on policy rules
   */
  calculateFee(
    policy: ClientPolicy,
    feeType: string,
    baseAmount?: number
  ): { amount: number; currency: string } | null {
    const feeRule = policy.feeRules.find(r => r.feeType === feeType);
    if (!feeRule) {
      return null;
    }

    let amount: number;

    switch (feeRule.calculationType) {
      case 'FIXED':
        amount = feeRule.value;
        break;

      case 'PERCENTAGE':
        if (baseAmount === undefined) {
          logger.warn('Percentage fee requires base amount', { feeType });
          return null;
        }
        amount = (baseAmount * feeRule.value) / 100;
        break;

      case 'TIERED':
        if (!feeRule.tiers || baseAmount === undefined) {
          logger.warn('Tiered fee requires tiers and base amount', { feeType });
          return null;
        }
        const tier = feeRule.tiers.find(
          t => baseAmount >= t.fromAmount && (t.toAmount === undefined || baseAmount <= t.toAmount)
        );
        if (!tier) {
          return null;
        }
        amount = tier.calculationType === 'FIXED' 
          ? tier.value 
          : (baseAmount * tier.value) / 100;
        break;

      default:
        return null;
    }

    // Apply min/max caps
    if (feeRule.minimumFee !== undefined) {
      amount = Math.max(amount, feeRule.minimumFee);
    }
    if (feeRule.maximumFee !== undefined) {
      amount = Math.min(amount, feeRule.maximumFee);
    }

    return {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      currency: policy.currency,
    };
  }
}

// Singleton instance
export const policyService = new PolicyService();
