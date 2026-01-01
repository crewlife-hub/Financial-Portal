/**
 * Crew Finance Portal - Google Apps Script
 * Audit logging functions
 */

/**
 * Log an audit event
 */
function logAuditEvent(eventType, details) {
  const sh = getOrCreateSheet_('Audit_Log');
  
  // Ensure headers
  const headers = [
    'Timestamp',
    'Event Type',
    'Actor',
    'Client',
    'PIN',
    'Control Number',
    'Action',
    'Details',
    'Source'
  ];
  
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  
  // Get current user
  const actor = Session.getActiveUser().getEmail() || 'system';
  
  // Build row
  const row = [
    new Date(),
    eventType,
    actor,
    details.client || '',
    details.pin || '',
    details.controlNumber || '',
    details.action || '',
    JSON.stringify(details),
    details.source || 'apps-script'
  ];
  
  sh.appendRow(row);
  Logger.log('Audit: ' + eventType + ' - ' + details.action);
}

/**
 * Log sync event
 */
function logSyncEvent(syncType, recordCount, status) {
  logAuditEvent('SYNC', {
    action: syncType + ' sync ' + status,
    recordCount: recordCount,
    status: status,
    source: 'apps-script'
  });
}

/**
 * Log billable event status change
 */
function logBillableEventChange(idempotencyKey, oldStatus, newStatus, reason) {
  logAuditEvent('BILLABLE_EVENT_CHANGE', {
    action: 'Status changed: ' + oldStatus + ' → ' + newStatus,
    idempotencyKey: idempotencyKey,
    oldStatus: oldStatus,
    newStatus: newStatus,
    reason: reason,
    source: 'apps-script'
  });
}

/**
 * Log invoice creation
 */
function logInvoiceCreated(invoiceId, clientCode, amount, currency) {
  logAuditEvent('INVOICE_CREATED', {
    action: 'Invoice created: ' + invoiceId,
    client: clientCode,
    invoiceId: invoiceId,
    amount: amount,
    currency: currency,
    source: 'apps-script'
  });
}

/**
 * Log payment received
 */
function logPaymentReceived(paymentId, invoiceId, amount, currency) {
  logAuditEvent('PAYMENT_RECEIVED', {
    action: 'Payment received: ' + paymentId,
    paymentId: paymentId,
    invoiceId: invoiceId,
    amount: amount,
    currency: currency,
    source: 'apps-script'
  });
}
