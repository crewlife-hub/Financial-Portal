import fs from 'fs/promises';
import path from 'path';
import { StorageInterface } from './StorageInterface';
import { ClientPolicy } from '../models/ClientPolicy';
import { BillableEvent } from '../models/BillableEvent';
import { InvoiceLink, isOverdue } from '../models/InvoiceLink';
import { AuditLog } from '../models/AuditLog';
import { createLogger } from '../utils/Logger';
import { config } from '../config';

const logger = createLogger('JsonFileStorage');

interface StorageData {
  clientPolicies: ClientPolicy[];
  billableEvents: BillableEvent[];
  invoiceLinks: InvoiceLink[];
  auditLogs: AuditLog[];
}

/**
 * JSON File Storage Implementation
 * Suitable for Phase 1 development and small-scale deployments
 */
export class JsonFileStorage implements StorageInterface {
  private dataDir: string;
  private data: StorageData;
  private initialized: boolean = false;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.storage.dataDir;
    this.data = {
      clientPolicies: [],
      billableEvents: [],
      invoiceLinks: [],
      auditLogs: [],
    };
  }

  private getFilePath(fileName: string): string {
    return path.join(this.dataDir, fileName);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing JSON file storage', { dataDir: this.dataDir });

    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });

    // Load existing data files
    await this.loadAllData();
    this.initialized = true;

    logger.info('JSON file storage initialized', {
      policies: this.data.clientPolicies.length,
      events: this.data.billableEvents.length,
      invoices: this.data.invoiceLinks.length,
      auditLogs: this.data.auditLogs.length,
    });
  }

  private async loadAllData(): Promise<void> {
    this.data.clientPolicies = await this.loadFile<ClientPolicy>('clientPolicies.json');
    this.data.billableEvents = await this.loadFile<BillableEvent>('billableEvents.json');
    this.data.invoiceLinks = await this.loadFile<InvoiceLink>('invoiceLinks.json');
    this.data.auditLogs = await this.loadFile<AuditLog>('auditLogs.json');
  }

  private async loadFile<T>(fileName: string): Promise<T[]> {
    const filePath = this.getFilePath(fileName);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info(`Creating new data file: ${fileName}`);
        await this.saveFile(fileName, []);
        return [];
      }
      logger.error(`Error loading ${fileName}`, { error });
      throw error;
    }
  }

  private async saveFile<T>(fileName: string, data: T[]): Promise<void> {
    const filePath = this.getFilePath(fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async persistPolicies(): Promise<void> {
    await this.saveFile('clientPolicies.json', this.data.clientPolicies);
  }

  private async persistEvents(): Promise<void> {
    await this.saveFile('billableEvents.json', this.data.billableEvents);
  }

  private async persistInvoiceLinks(): Promise<void> {
    await this.saveFile('invoiceLinks.json', this.data.invoiceLinks);
  }

  private async persistAuditLogs(): Promise<void> {
    await this.saveFile('auditLogs.json', this.data.auditLogs);
  }

  // =========================================================================
  // Client Policies
  // =========================================================================

  async getAllPolicies(): Promise<ClientPolicy[]> {
    return [...this.data.clientPolicies];
  }

  async getPolicyById(id: string): Promise<ClientPolicy | null> {
    return this.data.clientPolicies.find(p => p.id === id) || null;
  }

  async getPolicyByClientId(clientId: string): Promise<ClientPolicy | null> {
    return this.data.clientPolicies.find(p => p.clientId === clientId && p.isActive) || null;
  }

  async getPolicyByClientCode(clientCode: string): Promise<ClientPolicy | null> {
    return this.data.clientPolicies.find(
      p => p.clientCode.toUpperCase() === clientCode.toUpperCase() && p.isActive
    ) || null;
  }

  async savePolicy(policy: ClientPolicy): Promise<ClientPolicy> {
    this.data.clientPolicies.push(policy);
    await this.persistPolicies();
    logger.info('Policy saved', { policyId: policy.id, clientCode: policy.clientCode });
    return policy;
  }

  async updatePolicy(id: string, updates: Partial<ClientPolicy>): Promise<ClientPolicy> {
    const index = this.data.clientPolicies.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Policy not found: ${id}`);
    }

    const updated = {
      ...this.data.clientPolicies[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.clientPolicies[index] = updated;
    await this.persistPolicies();
    logger.info('Policy updated', { policyId: id });
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const index = this.data.clientPolicies.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.data.clientPolicies.splice(index, 1);
    await this.persistPolicies();
    logger.info('Policy deleted', { policyId: id });
    return true;
  }

  // =========================================================================
  // Billable Events
  // =========================================================================

  async getAllEvents(): Promise<BillableEvent[]> {
    return [...this.data.billableEvents];
  }

  async getEventById(id: string): Promise<BillableEvent | null> {
    return this.data.billableEvents.find(e => e.id === id) || null;
  }

  async getEventByIdempotencyKey(key: string): Promise<BillableEvent | null> {
    return this.data.billableEvents.find(e => e.idempotencyKey === key) || null;
  }

  async getEventsByClientId(clientId: string): Promise<BillableEvent[]> {
    return this.data.billableEvents.filter(e => e.clientId === clientId);
  }

  async getEventsByStatus(status: string): Promise<BillableEvent[]> {
    return this.data.billableEvents.filter(e => e.status === status);
  }

  async saveEvent(event: BillableEvent): Promise<BillableEvent> {
    // Critical: Check for duplicate idempotency key
    const existing = await this.getEventByIdempotencyKey(event.idempotencyKey);
    if (existing) {
      logger.warn('Duplicate idempotency key detected', {
        key: event.idempotencyKey,
        existingId: existing.id,
      });
      throw new Error(`Duplicate entry: idempotency key ${event.idempotencyKey} already exists`);
    }

    this.data.billableEvents.push(event);
    await this.persistEvents();
    logger.info('Billable event saved', {
      eventId: event.id,
      idempotencyKey: event.idempotencyKey,
    });
    return event;
  }

  async updateEvent(id: string, updates: Partial<BillableEvent>): Promise<BillableEvent> {
    const index = this.data.billableEvents.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Billable event not found: ${id}`);
    }

    const updated = {
      ...this.data.billableEvents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.billableEvents[index] = updated;
    await this.persistEvents();
    logger.info('Billable event updated', { eventId: id });
    return updated;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const index = this.data.billableEvents.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.data.billableEvents.splice(index, 1);
    await this.persistEvents();
    logger.info('Billable event deleted', { eventId: id });
    return true;
  }

  async idempotencyKeyExists(key: string): Promise<boolean> {
    return this.data.billableEvents.some(e => e.idempotencyKey === key);
  }

  // =========================================================================
  // Invoice Links
  // =========================================================================

  async getAllInvoiceLinks(): Promise<InvoiceLink[]> {
    return [...this.data.invoiceLinks];
  }

  async getInvoiceLinkById(id: string): Promise<InvoiceLink | null> {
    return this.data.invoiceLinks.find(l => l.id === id) || null;
  }

  async getInvoiceLinkByEventId(billableEventId: string): Promise<InvoiceLink | null> {
    return this.data.invoiceLinks.find(l => l.billableEventId === billableEventId) || null;
  }

  async getInvoiceLinkByQbInvoiceId(qbInvoiceId: string): Promise<InvoiceLink | null> {
    return this.data.invoiceLinks.find(l => l.qbInvoiceId === qbInvoiceId) || null;
  }

  async getInvoiceLinksByStatus(status: string): Promise<InvoiceLink[]> {
    return this.data.invoiceLinks.filter(l => l.qbStatus === status);
  }

  async getOverdueInvoiceLinks(): Promise<InvoiceLink[]> {
    return this.data.invoiceLinks.filter(l => isOverdue(l));
  }

  async saveInvoiceLink(link: InvoiceLink): Promise<InvoiceLink> {
    this.data.invoiceLinks.push(link);
    await this.persistInvoiceLinks();
    logger.info('Invoice link saved', {
      linkId: link.id,
      qbInvoiceId: link.qbInvoiceId,
    });
    return link;
  }

  async updateInvoiceLink(id: string, updates: Partial<InvoiceLink>): Promise<InvoiceLink> {
    const index = this.data.invoiceLinks.findIndex(l => l.id === id);
    if (index === -1) {
      throw new Error(`Invoice link not found: ${id}`);
    }

    const updated = {
      ...this.data.invoiceLinks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.invoiceLinks[index] = updated;
    await this.persistInvoiceLinks();
    logger.info('Invoice link updated', { linkId: id });
    return updated;
  }

  // =========================================================================
  // Audit Logs
  // =========================================================================

  async getAllAuditLogs(): Promise<AuditLog[]> {
    return [...this.data.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getAuditLogsByEntity(entityType: string, entityId?: string): Promise<AuditLog[]> {
    return this.data.auditLogs
      .filter(log => {
        if (log.entityType !== entityType) return false;
        if (entityId && log.entityId !== entityId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return this.data.auditLogs
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return this.data.auditLogs
      .filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= startDate && logDate <= endDate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async saveAuditLog(log: AuditLog): Promise<AuditLog> {
    this.data.auditLogs.push(log);
    await this.persistAuditLogs();
    return log;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  async backup(): Promise<string> {
    const backupId = `backup_${Date.now()}`;
    const backupDir = path.join(this.dataDir, 'backups', backupId);
    await fs.mkdir(backupDir, { recursive: true });

    await Promise.all([
      fs.copyFile(
        this.getFilePath('clientPolicies.json'),
        path.join(backupDir, 'clientPolicies.json')
      ),
      fs.copyFile(
        this.getFilePath('billableEvents.json'),
        path.join(backupDir, 'billableEvents.json')
      ),
      fs.copyFile(
        this.getFilePath('invoiceLinks.json'),
        path.join(backupDir, 'invoiceLinks.json')
      ),
      fs.copyFile(
        this.getFilePath('auditLogs.json'),
        path.join(backupDir, 'auditLogs.json')
      ),
    ]);

    logger.info('Backup created', { backupId });
    return backupId;
  }

  async restore(backupId: string): Promise<void> {
    const backupDir = path.join(this.dataDir, 'backups', backupId);

    await Promise.all([
      fs.copyFile(
        path.join(backupDir, 'clientPolicies.json'),
        this.getFilePath('clientPolicies.json')
      ),
      fs.copyFile(
        path.join(backupDir, 'billableEvents.json'),
        this.getFilePath('billableEvents.json')
      ),
      fs.copyFile(
        path.join(backupDir, 'invoiceLinks.json'),
        this.getFilePath('invoiceLinks.json')
      ),
      fs.copyFile(
        path.join(backupDir, 'auditLogs.json'),
        this.getFilePath('auditLogs.json')
      ),
    ]);

    await this.loadAllData();
    logger.info('Backup restored', { backupId });
  }
}
