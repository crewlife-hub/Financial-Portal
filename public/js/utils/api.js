/**
 * API Client for Crew Finance Portal
 */
const API = {
  baseUrl: '/api',

  /**
   * Make an API request
   */
  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Add user context headers (in production, use proper auth)
        'X-User-Id': 'admin',
        'X-User-Name': 'Admin User',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  },

  // GET request
  get(endpoint) {
    return this.request('GET', endpoint);
  },

  // POST request
  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },

  // PUT request
  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },

  // DELETE request
  delete(endpoint) {
    return this.request('DELETE', endpoint);
  },

  // =========================================================================
  // Policies
  // =========================================================================
  policies: {
    getAll() {
      return API.get('/policies');
    },
    getMatrix() {
      return API.get('/policies/matrix');
    },
    getById(id) {
      return API.get(`/policies/${id}`);
    },
    create(data) {
      return API.post('/policies', data);
    },
    update(id, data) {
      return API.put(`/policies/${id}`, data);
    },
    delete(id) {
      return API.delete(`/policies/${id}`);
    },
  },

  // =========================================================================
  // Billable Events
  // =========================================================================
  events: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.get(`/billable-events${query ? '?' + query : ''}`);
    },
    getReadyToInvoice() {
      return API.get('/billable-events/ready-to-invoice');
    },
    getApproved() {
      return API.get('/billable-events/approved');
    },
    getById(id) {
      return API.get(`/billable-events/${id}`);
    },
    create(data) {
      return API.post('/billable-events', data);
    },
    generate(data) {
      return API.post('/billable-events/generate', data);
    },
    approve(id, notes) {
      return API.post(`/billable-events/${id}/approve`, { notes });
    },
    hold(id, reason) {
      return API.post(`/billable-events/${id}/hold`, { reason });
    },
    checkKey(data) {
      return API.post('/billable-events/check-key', data);
    },
  },

  // =========================================================================
  // Invoices
  // =========================================================================
  invoices: {
    getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.get(`/invoices${query ? '?' + query : ''}`);
    },
    getOverdue() {
      return API.get('/invoices/overdue');
    },
    getById(id) {
      return API.get(`/invoices/${id}`);
    },
    create(billableEventId) {
      return API.post('/invoices/create', { billableEventId });
    },
    createBatch(billableEventIds) {
      return API.post('/invoices/create-batch', { billableEventIds });
    },
  },

  // =========================================================================
  // Reconciliation
  // =========================================================================
  reconciliation: {
    getSummary() {
      return API.get('/reconciliation/summary');
    },
    getDashboard() {
      return API.get('/reconciliation/dashboard');
    },
    getOverdue() {
      return API.get('/reconciliation/overdue');
    },
    syncInvoices() {
      return API.post('/reconciliation/sync-invoices');
    },
    syncPayments() {
      return API.post('/reconciliation/sync-payments');
    },
  },

  // =========================================================================
  // Auth
  // =========================================================================
  auth: {
    getStatus() {
      return API.get('/auth/status');
    },
  },

  // =========================================================================
  // Audit
  // =========================================================================
  audit: {
    getAll(limit = 100) {
      return API.get(`/audit?limit=${limit}`);
    },
    getByEntity(entityType, entityId) {
      const path = entityId 
        ? `/audit/entity/${entityType}/${entityId}`
        : `/audit/entity/${entityType}`;
      return API.get(path);
    },
  },

  // =========================================================================
  // Health
  // =========================================================================
  health() {
    return API.get('/health');
  },
};
