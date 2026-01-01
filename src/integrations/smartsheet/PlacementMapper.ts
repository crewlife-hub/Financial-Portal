import { smartsheetClient, SmartsheetRow, SmartsheetColumn } from './SmartsheetClient';
import { SourceData } from '../../models/BillableEvent';
import { createLogger } from '../../utils/Logger';
import { FeeType, CurrencyCode } from '../../utils/validators';
import { z } from 'zod';

const logger = createLogger('PlacementMapper');

/**
 * Placement data extracted from Smartsheet
 */
export interface PlacementData {
  smartsheetRowId: string;
  controlNumber: string;
  clientId: string;
  candidateName: string;
  candidateEmail: string;
  vesselName: string;
  positionTitle: string;
  startDate: string;
  salary: number;
  currency: z.infer<typeof CurrencyCode>;
  status: string;
  rawData: Record<string, unknown>;
}

/**
 * Billable trigger extracted from placement
 */
export interface BillableTrigger {
  clientId: string;
  controlNumber: string;
  candidateEmail: string;
  candidateName: string;
  triggerDate: string;
  triggerType: string;
  feeType: z.infer<typeof FeeType>;
  sourceData: SourceData;
}

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  controlNumber: string;
  clientId: string;
  candidateName: string;
  candidateEmail: string;
  vesselName: string;
  positionTitle: string;
  startDate: string;
  salary: string;
  currency: string;
  status: string;
}

/**
 * Default column mapping
 */
const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  controlNumber: 'Control Number',
  clientId: 'Client ID',
  candidateName: 'Candidate Name',
  candidateEmail: 'Candidate Email',
  vesselName: 'Vessel',
  positionTitle: 'Position',
  startDate: 'Start Date',
  salary: 'Salary',
  currency: 'Currency',
  status: 'Status',
};

/**
 * Placement Mapper - Maps Smartsheet data to portal data structures
 */
export class PlacementMapper {
  private columnMapping: ColumnMapping;

  constructor(columnMapping?: Partial<ColumnMapping>) {
    this.columnMapping = { ...DEFAULT_COLUMN_MAPPING, ...columnMapping };
  }

  /**
   * Map a Smartsheet row to PlacementData
   */
  mapRowToPlacement(row: SmartsheetRow, columns: SmartsheetColumn[]): PlacementData | null {
    try {
      const getValue = (columnTitle: string): unknown => {
        return smartsheetClient.getCellValue(row, columns, columnTitle);
      };

      const controlNumber = getValue(this.columnMapping.controlNumber);
      const clientId = getValue(this.columnMapping.clientId);

      if (!controlNumber || !clientId) {
        logger.debug('Skipping row - missing required fields', {
          rowId: row.id,
          hasControlNumber: Boolean(controlNumber),
          hasClientId: Boolean(clientId),
        });
        return null;
      }

      // Build raw data object
      const rawData: Record<string, unknown> = {};
      for (const cell of row.cells) {
        const column = columns.find(c => c.id === cell.columnId);
        if (column) {
          rawData[column.title] = cell.value;
        }
      }

      return {
        smartsheetRowId: String(row.id),
        controlNumber: String(controlNumber),
        clientId: String(clientId),
        candidateName: String(getValue(this.columnMapping.candidateName) || ''),
        candidateEmail: String(getValue(this.columnMapping.candidateEmail) || ''),
        vesselName: String(getValue(this.columnMapping.vesselName) || ''),
        positionTitle: String(getValue(this.columnMapping.positionTitle) || ''),
        startDate: this.parseDate(getValue(this.columnMapping.startDate)),
        salary: this.parseNumber(getValue(this.columnMapping.salary)),
        currency: this.parseCurrency(getValue(this.columnMapping.currency)),
        status: String(getValue(this.columnMapping.status) || ''),
        rawData,
      };
    } catch (error) {
      logger.error('Error mapping row to placement', {
        rowId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Map placement to billable trigger
   */
  mapPlacementToTrigger(
    placement: PlacementData,
    triggerType: 'PLACEMENT' | 'ONBOARD' = 'PLACEMENT'
  ): BillableTrigger {
    const feeType: z.infer<typeof FeeType> = triggerType === 'PLACEMENT' 
      ? 'PLACEMENT_FEE' 
      : 'ONBOARD_FEE';

    return {
      clientId: placement.clientId,
      controlNumber: placement.controlNumber,
      candidateEmail: placement.candidateEmail,
      candidateName: placement.candidateName,
      triggerDate: placement.startDate || new Date().toISOString().split('T')[0],
      triggerType: `ON_${triggerType}`,
      feeType,
      sourceData: {
        smartsheetRowId: placement.smartsheetRowId,
        controlNumber: placement.controlNumber,
        candidateEmail: placement.candidateEmail || undefined,
        candidateName: placement.candidateName || undefined,
        vesselName: placement.vesselName || undefined,
        positionTitle: placement.positionTitle || undefined,
        contractStartDate: placement.startDate || undefined,
        salary: placement.salary || undefined,
        currency: placement.currency,
        rawData: placement.rawData,
      },
    };
  }

  /**
   * Fetch and map placements from Smartsheet
   */
  async fetchPlacements(statusFilter?: string): Promise<PlacementData[]> {
    const sheet = await smartsheetClient.getPlacementsSheet();
    const placements: PlacementData[] = [];

    for (const row of sheet.rows) {
      const placement = this.mapRowToPlacement(row, sheet.columns);
      if (!placement) continue;

      // Apply status filter if provided
      if (statusFilter && placement.status !== statusFilter) {
        continue;
      }

      placements.push(placement);
    }

    logger.info('Fetched placements from Smartsheet', {
      total: sheet.rows.length,
      mapped: placements.length,
      statusFilter,
    });

    return placements;
  }

  /**
   * Fetch placements and convert to billable triggers
   */
  async fetchBillableTriggers(
    statusFilter?: string,
    triggerType: 'PLACEMENT' | 'ONBOARD' = 'PLACEMENT'
  ): Promise<BillableTrigger[]> {
    const placements = await this.fetchPlacements(statusFilter);
    return placements.map(p => this.mapPlacementToTrigger(p, triggerType));
  }

  /**
   * Parse date from various formats
   */
  private parseDate(value: unknown): string {
    if (!value) return '';

    if (typeof value === 'string') {
      // Try to parse and format as ISO date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    return '';
  }

  /**
   * Parse number from various formats
   */
  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Parse currency code
   */
  private parseCurrency(value: unknown): z.infer<typeof CurrencyCode> {
    if (!value) return 'USD';

    const code = String(value).toUpperCase().trim();
    const validCodes: z.infer<typeof CurrencyCode>[] = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK'
    ];

    if (validCodes.includes(code as any)) {
      return code as z.infer<typeof CurrencyCode>;
    }

    logger.warn('Unknown currency code, defaulting to USD', { code });
    return 'USD';
  }
}

// Singleton instance with default mapping
export const placementMapper = new PlacementMapper();
