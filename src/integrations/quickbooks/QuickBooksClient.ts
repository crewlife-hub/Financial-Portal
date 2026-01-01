import { config } from '../../config';
import { createLogger } from '../../utils/Logger';
import { QuickBooksError } from '../../utils/errors';

const logger = createLogger('QuickBooksClient');

/**
 * QuickBooks Invoice data structure
 */
export interface QBInvoice {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  DueDate: string;
  TotalAmt: number;
  Balance: number;
  CurrencyRef: { value: string; name?: string };
  CustomerRef: { value: string; name?: string };
  Line: Array<{
    Id?: string;
    Amount: number;
    Description?: string;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: { value: string; name?: string };
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
  PrivateNote?: string;
  CustomerMemo?: { value: string };
  EmailStatus?: string;
  BillEmail?: { Address: string };
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

/**
 * QuickBooks Payment data structure
 */
export interface QBPayment {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  CurrencyRef: { value: string };
  CustomerRef: { value: string; name?: string };
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
  PaymentMethodRef?: { value: string; name?: string };
  PaymentRefNum?: string;
  PrivateNote?: string;
}

/**
 * QuickBooks Customer data structure
 */
export interface QBCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    Country?: string;
    PostalCode?: string;
  };
  CurrencyRef?: { value: string };
  Balance?: number;
}

/**
 * OAuth tokens structure
 */
export interface QBTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * QuickBooks Client - Handles communication with QuickBooks Online API
 */
export class QuickBooksClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private environment: 'sandbox' | 'production';
  private realmId: string;
  private tokens: QBTokens | null = null;

  private get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  constructor() {
    this.clientId = config.quickbooks.clientId;
    this.clientSecret = config.quickbooks.clientSecret;
    this.redirectUri = config.quickbooks.redirectUri;
    this.environment = config.quickbooks.environment;
    this.realmId = config.quickbooks.realmId;

    // Initialize tokens from config if available
    if (config.quickbooks.accessToken) {
      this.tokens = {
        accessToken: config.quickbooks.accessToken,
        refreshToken: config.quickbooks.refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour validity
      };
    }
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.realmId);
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return Boolean(this.tokens?.accessToken);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const baseAuthUrl = 'https://appcenter.intuit.com/connect/oauth2';
    const scope = 'com.intuit.quickbooks.accounting';

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope,
      state,
    });

    return `${baseAuthUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<QBTokens> {
    // TODO: Implement OAuth token exchange
    // const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    // const response = await fetch(tokenUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     grant_type: 'authorization_code',
    //     code,
    //     redirect_uri: this.redirectUri,
    //   }),
    // });

    logger.info('Exchanging OAuth code for tokens (stub)', { codeLength: code.length });

    throw new QuickBooksError('OAuth token exchange not yet implemented');
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<QBTokens> {
    if (!this.tokens?.refreshToken) {
      throw new QuickBooksError('No refresh token available');
    }

    // TODO: Implement token refresh
    // const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    // const response = await fetch(tokenUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     grant_type: 'refresh_token',
    //     refresh_token: this.tokens.refreshToken,
    //   }),
    // });

    logger.info('Refreshing access token (stub)');

    throw new QuickBooksError('Token refresh not yet implemented');
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    if (!this.isAuthenticated()) {
      throw new QuickBooksError('Not authenticated with QuickBooks');
    }

    const url = `${this.baseUrl}/v3/company/${this.realmId}/${endpoint}`;

    // TODO: Implement actual API call
    // const response = await fetch(url, {
    //   method,
    //   headers: {
    //     'Authorization': `Bearer ${this.tokens!.accessToken}`,
    //     'Content-Type': 'application/json',
    //     'Accept': 'application/json',
    //   },
    //   body: body ? JSON.stringify(body) : undefined,
    // });
    //
    // if (!response.ok) {
    //   if (response.status === 401) {
    //     await this.refreshAccessToken();
    //     return this.request(method, endpoint, body);
    //   }
    //   throw new QuickBooksError(`API request failed: ${response.statusText}`);
    // }
    //
    // return response.json();

    logger.debug('QuickBooks API request (stub)', { method, endpoint });
    throw new QuickBooksError('QuickBooks API calls not yet implemented');
  }

  // =========================================================================
  // Invoice Operations
  // =========================================================================

  /**
   * Create invoice in QuickBooks
   */
  async createInvoice(invoiceData: {
    customerId: string;
    lineItems: Array<{
      description: string;
      amount: number;
      itemId?: string;
    }>;
    dueDate?: string;
    currency?: string;
    memo?: string;
    customerMemo?: string;
  }): Promise<QBInvoice> {
    if (!this.isConfigured()) {
      throw new QuickBooksError('QuickBooks client not configured');
    }

    // TODO: Phase 2 - Implement invoice creation
    // const invoice = {
    //   CustomerRef: { value: invoiceData.customerId },
    //   Line: invoiceData.lineItems.map((item, index) => ({
    //     Amount: item.amount,
    //     Description: item.description,
    //     DetailType: 'SalesItemLineDetail',
    //     SalesItemLineDetail: item.itemId ? { ItemRef: { value: item.itemId } } : undefined,
    //   })),
    //   DueDate: invoiceData.dueDate,
    //   CurrencyRef: invoiceData.currency ? { value: invoiceData.currency } : undefined,
    //   PrivateNote: invoiceData.memo,
    //   CustomerMemo: invoiceData.customerMemo ? { value: invoiceData.customerMemo } : undefined,
    // };
    //
    // return this.request<{ Invoice: QBInvoice }>('POST', 'invoice', invoice).then(r => r.Invoice);

    logger.info('Creating invoice in QuickBooks (stub)', {
      customerId: invoiceData.customerId,
      lineCount: invoiceData.lineItems.length,
    });

    throw new QuickBooksError('Invoice creation not yet implemented - Phase 2 feature');
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<QBInvoice> {
    // TODO: Implement
    // return this.request<{ Invoice: QBInvoice }>('GET', `invoice/${invoiceId}`).then(r => r.Invoice);

    logger.debug('Fetching invoice from QuickBooks (stub)', { invoiceId });
    throw new QuickBooksError('Invoice fetch not yet implemented');
  }

  /**
   * Query invoices
   */
  async queryInvoices(query: string): Promise<QBInvoice[]> {
    // TODO: Implement
    // const encoded = encodeURIComponent(query);
    // return this.request<{ QueryResponse: { Invoice: QBInvoice[] } }>('GET', `query?query=${encoded}`)
    //   .then(r => r.QueryResponse.Invoice || []);

    logger.debug('Querying invoices (stub)', { query });
    throw new QuickBooksError('Invoice query not yet implemented');
  }

  /**
   * Get open invoices
   */
  async getOpenInvoices(): Promise<QBInvoice[]> {
    return this.queryInvoices("SELECT * FROM Invoice WHERE Balance > '0'");
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<QBInvoice[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.queryInvoices(`SELECT * FROM Invoice WHERE Balance > '0' AND DueDate < '${today}'`);
  }

  // =========================================================================
  // Payment Operations
  // =========================================================================

  /**
   * Get payments for an invoice
   */
  async getPaymentsForInvoice(invoiceId: string): Promise<QBPayment[]> {
    // TODO: Implement
    // return this.queryPayments(`SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${invoiceId}'`);

    logger.debug('Fetching payments for invoice (stub)', { invoiceId });
    throw new QuickBooksError('Payment query not yet implemented');
  }

  /**
   * Query payments
   */
  async queryPayments(query: string): Promise<QBPayment[]> {
    // TODO: Implement
    logger.debug('Querying payments (stub)', { query });
    throw new QuickBooksError('Payment query not yet implemented');
  }

  // =========================================================================
  // Customer Operations
  // =========================================================================

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<QBCustomer> {
    // TODO: Implement
    // return this.request<{ Customer: QBCustomer }>('GET', `customer/${customerId}`).then(r => r.Customer);

    logger.debug('Fetching customer (stub)', { customerId });
    throw new QuickBooksError('Customer fetch not yet implemented');
  }

  /**
   * Query customers
   */
  async queryCustomers(query: string): Promise<QBCustomer[]> {
    // TODO: Implement
    logger.debug('Querying customers (stub)', { query });
    throw new QuickBooksError('Customer query not yet implemented');
  }

  /**
   * Find customer by display name
   */
  async findCustomerByName(displayName: string): Promise<QBCustomer | null> {
    const customers = await this.queryCustomers(
      `SELECT * FROM Customer WHERE DisplayName = '${displayName}'`
    );
    return customers[0] || null;
  }
}

// Singleton instance
export const quickBooksClient = new QuickBooksClient();
