/**
 * Crew Finance Portal - Main Application
 */
const App = {
  currentPage: 'dashboard',
  selectedEvents: new Set(),

  /**
   * Initialize the application
   */
  async init() {
    // Setup navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;
        this.navigateTo(page);
      });
    });

    // Check auth status
    await this.checkAuthStatus();

    // Load initial data
    await this.loadDashboard();
  },

  /**
   * Navigate to a page
   */
  navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    this.currentPage = page;

    // Load page data
    switch (page) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'policies':
        this.loadPolicies();
        break;
      case 'ready-to-invoice':
        this.loadReadyToInvoice();
        break;
      case 'invoices':
        this.loadInvoices();
        break;
      case 'reconciliation':
        this.loadReconciliation();
        break;
    }
  },

  /**
   * Check authentication status
   */
  async checkAuthStatus() {
    try {
      const result = await API.auth.getStatus();
      const data = result.data;

      // Update phase badge
      document.getElementById('phase-badge').textContent = `Phase ${data.phase}`;

      // Update QB status
      const qbStatus = document.getElementById('qb-status');
      if (data.quickbooks.authenticated) {
        qbStatus.textContent = 'QB: Connected';
        qbStatus.classList.remove('badge-warning');
        qbStatus.classList.add('badge-success');
      } else if (data.quickbooks.configured) {
        qbStatus.textContent = 'QB: Not Connected';
        qbStatus.classList.add('badge-warning');
      } else {
        qbStatus.textContent = 'QB: Not Configured';
        qbStatus.classList.add('badge-secondary');
      }
    } catch (error) {
      this.showToast('Failed to check auth status', 'error');
    }
  },

  /**
   * Load dashboard data
   */
  async loadDashboard() {
    try {
      // Load stats
      const [eventsResult, reconcResult, auditResult] = await Promise.all([
        API.events.getAll(),
        API.reconciliation.getSummary(),
        API.audit.getAll(10),
      ]);

      // Count events by status
      const events = eventsResult.data || [];
      const pending = events.filter(e => e.status === 'PENDING').length;
      const approved = events.filter(e => e.status === 'APPROVED').length;

      document.getElementById('stat-pending').textContent = pending;
      document.getElementById('stat-approved').textContent = approved;

      // Reconciliation stats
      const recon = reconcResult.data || {};
      document.getElementById('stat-outstanding').textContent = 
        this.formatCurrency(recon.totalOutstanding || 0);
      document.getElementById('stat-overdue').textContent = 
        this.formatCurrency(recon.totalOverdue || 0);

      // Recent activity
      const activityContainer = document.getElementById('recent-activity');
      const logs = auditResult.data || [];

      if (logs.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted">No recent activity</p>';
      } else {
        activityContainer.innerHTML = logs.map(log => `
          <div class="activity-item">
            <div>
              <div class="activity-action">${log.action}: ${log.description}</div>
              <div class="activity-time">${log.userName || log.userId}</div>
            </div>
            <div class="activity-time">${this.formatDate(log.timestamp)}</div>
          </div>
        `).join('');
      }
    } catch (error) {
      this.showToast('Failed to load dashboard', 'error');
    }
  },

  /**
   * Load policies
   */
  async loadPolicies() {
    const tbody = document.querySelector('#policies-table tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';

    try {
      const result = await API.policies.getMatrix();
      const policies = result.data || [];

      if (policies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted">No policies found</td></tr>';
        return;
      }

      tbody.innerHTML = policies.map(policy => `
        <tr>
          <td class="font-mono">${policy.clientCode}</td>
          <td>${policy.clientName}</td>
          <td>${policy.triggerRule}</td>
          <td>${policy.currency}</td>
          <td>${policy.paymentTerms}</td>
          <td>${policy.feeStructure}</td>
          <td>
            <span class="badge ${policy.isActive ? 'badge-success' : 'badge-secondary'}">
              ${policy.isActive ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="App.viewPolicy('${policy.clientCode}')">
              View
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-danger">Failed to load policies</td></tr>';
    }
  },

  /**
   * Load ready to invoice events
   */
  async loadReadyToInvoice() {
    const tbody = document.querySelector('#ready-to-invoice-table tbody');
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading...</td></tr>';
    this.selectedEvents.clear();

    try {
      const result = await API.events.getReadyToInvoice();
      const events = result.data || [];

      if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-muted">No pending events</td></tr>';
        return;
      }

      tbody.innerHTML = events.map(event => `
        <tr>
          <td>
            <input type="checkbox" 
                   data-event-id="${event.id}" 
                   onchange="App.toggleEventSelection('${event.id}', this.checked)"
                   ${event.canApprove ? '' : 'disabled'}>
          </td>
          <td class="font-mono" style="font-size: 0.75rem;">${event.idempotencyKey}</td>
          <td>${event.clientCode}</td>
          <td>${event.controlNumber}</td>
          <td>${event.candidateName}</td>
          <td>${this.formatDate(event.triggerDate)}</td>
          <td>${event.feeType}</td>
          <td class="text-right">${event.currency} ${event.amount.toFixed(2)}</td>
          <td>
            <span class="badge badge-warning">${event.status}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-success" onclick="App.approveEvent('${event.id}')"
                    ${event.canApprove ? '' : 'disabled'}>
              Approve
            </button>
            <button class="btn btn-sm btn-secondary" onclick="App.holdEvent('${event.id}')">
              Hold
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-danger">Failed to load events</td></tr>';
    }
  },

  /**
   * Refresh ready to invoice list
   */
  refreshReadyToInvoice() {
    this.loadReadyToInvoice();
  },

  /**
   * Load invoices
   */
  async loadInvoices(status = '') {
    const tbody = document.querySelector('#invoices-table tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';

    try {
      const params = status ? { status } : {};
      const result = await API.invoices.getAll(params);
      const invoices = result.data || [];

      if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-muted">No invoices found</td></tr>';
        return;
      }

      tbody.innerHTML = invoices.map(inv => `
        <tr>
          <td class="font-mono">${inv.qbDocNumber}</td>
          <td>${inv.qbCustomerName}</td>
          <td>${this.formatDate(inv.invoiceDate)}</td>
          <td>${this.formatDate(inv.dueDate)}</td>
          <td class="text-right">${inv.currency} ${inv.amount.toFixed(2)}</td>
          <td class="text-right">${inv.currency} ${inv.balance.toFixed(2)}</td>
          <td>
            <span class="badge ${this.getStatusBadgeClass(inv.qbStatus)}">${inv.qbStatus}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="App.viewInvoice('${inv.id}')">
              View
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-danger">Failed to load invoices</td></tr>';
    }
  },

  /**
   * Filter invoices by status
   */
  filterInvoices() {
    const status = document.getElementById('invoice-status-filter').value;
    this.loadInvoices(status);
  },

  /**
   * Load reconciliation data
   */
  async loadReconciliation() {
    try {
      const result = await API.reconciliation.getDashboard();
      const data = result.data || {};

      // Update stats
      document.getElementById('recon-outstanding').textContent = 
        this.formatCurrency(data.invoiceSummary?.totalOutstanding || 0);
      document.getElementById('recon-overdue').textContent = 
        this.formatCurrency(data.invoiceSummary?.totalOverdue || 0);

      // Update overdue table
      const tbody = document.querySelector('#overdue-table tbody');
      const overdueInvoices = data.overdueReport?.invoices || [];

      if (overdueInvoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted">No overdue invoices</td></tr>';
      } else {
        tbody.innerHTML = overdueInvoices.map(inv => `
          <tr>
            <td class="font-mono">${inv.qbDocNumber}</td>
            <td>${inv.clientName}</td>
            <td class="text-right">${inv.currency} ${inv.amount.toFixed(2)}</td>
            <td class="text-right text-danger">${inv.currency} ${inv.balance.toFixed(2)}</td>
            <td class="text-danger">${inv.daysOverdue} days</td>
            <td>
              <span class="badge ${this.getAgingBadgeClass(inv.agingBucket)}">${inv.agingBucket}</span>
            </td>
          </tr>
        `).join('');
      }
    } catch (error) {
      this.showToast('Failed to load reconciliation data', 'error');
    }
  },

  /**
   * Toggle event selection
   */
  toggleEventSelection(eventId, checked) {
    if (checked) {
      this.selectedEvents.add(eventId);
    } else {
      this.selectedEvents.delete(eventId);
    }
  },

  /**
   * Toggle select all
   */
  toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('#ready-to-invoice-table tbody input[type="checkbox"]:not(:disabled)');
    checkboxes.forEach(cb => {
      cb.checked = checkbox.checked;
      this.toggleEventSelection(cb.dataset.eventId, checkbox.checked);
    });
  },

  /**
   * Approve selected events
   */
  async approveSelected() {
    if (this.selectedEvents.size === 0) {
      this.showToast('No events selected', 'warning');
      return;
    }

    if (!confirm(`Approve ${this.selectedEvents.size} event(s) for invoicing?`)) {
      return;
    }

    let approved = 0;
    let failed = 0;

    for (const eventId of this.selectedEvents) {
      try {
        await API.events.approve(eventId);
        approved++;
      } catch (error) {
        failed++;
      }
    }

    this.showToast(`Approved: ${approved}, Failed: ${failed}`, approved > 0 ? 'success' : 'error');
    this.loadReadyToInvoice();
  },

  /**
   * Approve a single event
   */
  async approveEvent(eventId) {
    try {
      await API.events.approve(eventId);
      this.showToast('Event approved', 'success');
      this.loadReadyToInvoice();
    } catch (error) {
      this.showToast(`Failed to approve: ${error.message}`, 'error');
    }
  },

  /**
   * Put event on hold
   */
  async holdEvent(eventId) {
    const reason = prompt('Enter hold reason:');
    if (!reason) return;

    try {
      await API.events.hold(eventId, reason);
      this.showToast('Event put on hold', 'success');
      this.loadReadyToInvoice();
    } catch (error) {
      this.showToast(`Failed to hold: ${error.message}`, 'error');
    }
  },

  /**
   * Generate events from Smartsheet
   */
  async generateEvents() {
    if (!confirm('Generate billable events from Smartsheet placements?')) {
      return;
    }

    try {
      const result = await API.events.generate({});
      const summary = result.summary || {};
      
      this.showToast(
        `Generated: ${summary.created}, Duplicates: ${summary.duplicates}, Errors: ${summary.errors}`,
        summary.created > 0 ? 'success' : 'warning'
      );
      
      if (this.currentPage === 'ready-to-invoice') {
        this.loadReadyToInvoice();
      }
    } catch (error) {
      this.showToast(`Failed to generate events: ${error.message}`, 'error');
    }
  },

  /**
   * Sync invoices from QuickBooks
   */
  async syncInvoices() {
    try {
      const result = await API.reconciliation.syncInvoices();
      this.showToast(result.message || 'Sync completed', 'success');
      this.loadReconciliation();
    } catch (error) {
      this.showToast(`Sync failed: ${error.message}`, 'error');
    }
  },

  /**
   * View invoice detail
   */
  async viewInvoice(invoiceId) {
    try {
      const result = await API.invoices.getById(invoiceId);
      const detail = result.data;

      this.showModal('Invoice Details', `
        <div class="form-group">
          <label class="form-label">Invoice Number</label>
          <div class="font-mono">${detail.invoice.qbDocNumber}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Idempotency Key</label>
          <div class="font-mono" style="font-size: 0.75rem;">${detail.invoice.idempotencyKey}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Customer</label>
          <div>${detail.invoice.qbCustomerName}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <div>${detail.invoice.currency} ${detail.invoice.amount.toFixed(2)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Balance</label>
          <div>${detail.invoice.currency} ${detail.invoice.balance.toFixed(2)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <div><span class="badge ${this.getStatusBadgeClass(detail.invoice.qbStatus)}">${detail.invoice.qbStatus}</span></div>
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date</label>
          <div>${this.formatDate(detail.invoice.invoiceDate)}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <div>${this.formatDate(detail.invoice.dueDate)}</div>
        </div>
      `);
    } catch (error) {
      this.showToast(`Failed to load invoice: ${error.message}`, 'error');
    }
  },

  /**
   * Show add policy modal
   */
  showAddPolicyModal() {
    this.showModal('Add Client Policy', `
      <form id="add-policy-form" onsubmit="App.submitPolicy(event)">
        <div class="form-group">
          <label class="form-label">Client ID*</label>
          <input type="text" class="form-input" name="clientId" required>
        </div>
        <div class="form-group">
          <label class="form-label">Client Code*</label>
          <input type="text" class="form-input" name="clientCode" required 
                 pattern="[A-Za-z0-9]{2,20}" title="2-20 alphanumeric characters">
        </div>
        <div class="form-group">
          <label class="form-label">Client Name*</label>
          <input type="text" class="form-input" name="clientName" required>
        </div>
        <div class="form-group">
          <label class="form-label">Trigger Rule*</label>
          <select class="form-select" name="triggerRule" required>
            <option value="ON_PLACEMENT">On Placement</option>
            <option value="ON_ONBOARD">On Onboard</option>
            <option value="ON_CONTRACT_START">On Contract Start</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Currency*</label>
          <select class="form-select" name="currency" required>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Placement Fee (Fixed Amount)*</label>
          <input type="number" class="form-input" name="placementFee" required min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Terms (Days)</label>
          <input type="number" class="form-input" name="paymentTermsDays" value="30" min="1">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Policy</button>
        </div>
      </form>
    `);
  },

  /**
   * Submit policy form
   */
  async submitPolicy(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const data = {
      clientId: formData.get('clientId'),
      clientCode: formData.get('clientCode'),
      clientName: formData.get('clientName'),
      triggerRule: formData.get('triggerRule'),
      currency: formData.get('currency'),
      paymentTermsDays: parseInt(formData.get('paymentTermsDays') || '30'),
      feeRules: [{
        feeType: 'PLACEMENT_FEE',
        calculationType: 'FIXED',
        value: parseFloat(formData.get('placementFee')),
      }],
    };

    try {
      await API.policies.create(data);
      this.showToast('Policy created successfully', 'success');
      this.closeModal();
      this.loadPolicies();
    } catch (error) {
      this.showToast(`Failed to create policy: ${error.message}`, 'error');
    }
  },

  /**
   * Show modal
   */
  showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-container').classList.remove('hidden');
  },

  /**
   * Close modal
   */
  closeModal() {
    document.getElementById('modal-container').classList.add('hidden');
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  },

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  },

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    return `${currency} ${amount.toFixed(2)}`;
  },

  /**
   * Get badge class for status
   */
  getStatusBadgeClass(status) {
    const classes = {
      'PENDING': 'badge-warning',
      'APPROVED': 'badge-primary',
      'SENT': 'badge-primary',
      'VIEWED': 'badge-primary',
      'PARTIAL': 'badge-warning',
      'PAID': 'badge-success',
      'OVERDUE': 'badge-danger',
      'HOLD': 'badge-danger',
      'CANCELLED': 'badge-secondary',
    };
    return classes[status] || 'badge-secondary';
  },

  /**
   * Get badge class for aging bucket
   */
  getAgingBadgeClass(bucket) {
    const classes = {
      '1-30': 'badge-warning',
      '31-60': 'badge-warning',
      '61-90': 'badge-danger',
      '90+': 'badge-danger',
    };
    return classes[bucket] || 'badge-secondary';
  },
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
