/**
 * Crew Finance Portal - Google Apps Script
 * Billable Events detection and idempotency
 */

/**
 * Generate idempotency key
 * Format: CLIENTCODE-CONTROLNUMBER-TRIGGERDATE-FEETYPE
 */
function generateIdempotencyKey(clientCode, controlNumber, triggerDate, feeType) {
  if (!clientCode || !controlNumber || !triggerDate || !feeType) {
    throw new Error('Missing required fields for idempotency key');
  }
  
  // Normalize date to YYYY-MM-DD
  const dateStr = typeof triggerDate === 'object' 
    ? Utilities.formatDate(triggerDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : triggerDate.toString().substring(0, 10);
  
  return [
    clientCode.toUpperCase().replace(/\s+/g, '-'),
    controlNumber.toString().toUpperCase(),
    dateStr,
    feeType.toUpperCase()
  ].join('-');
}

/**
 * Check if idempotency key already exists
 */
function checkIdempotencyKeyExists(key) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sh = ss.getSheetByName('Billable_Events');
  
  if (!sh || sh.getLastRow() <= 1) return false;
  
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const keyCol = headers.indexOf('Idempotency Key');
  
  if (keyCol === -1) return false;
  
  return data.some(row => row[keyCol] === key);
}

/**
 * Get client code from QBO customer name
 */
function getClientCode(customerName) {
  return CLIENT_CODES[customerName] || customerName.toUpperCase().replace(/\s+/g, '-').substring(0, 10);
}

/**
 * Generate billable events from Smartsheet data
 */
function generateBillableEvents() {
  const ui = SpreadsheetApp.getUi();
  
  // Ensure billable events sheet exists
  const sh = getOrCreateSheet_('Billable_Events');
  const headers = [
    'Idempotency Key',
    'Status',
    'Client Code',
    'Control Number',
    'PIN',
    'First Name',
    'Last Name',
    'Company',
    'Trigger Date',
    'Fee Type',
    'Currency',
    'Amount',
    'Source Sheet',
    'Created At',
    'Updated At',
    'Notes'
  ];
  
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  
  ui.alert(
    'Billable Events',
    'Billable event generation requires Smartsheet API integration.\n\n' +
    'The sheet structure has been created. Events will be populated when Smartsheet sync is configured.',
    ui.ButtonSet.OK
  );
  
  Logger.log('Billable events sheet ready');
}

/**
 * Approve a billable event for invoicing
 */
function approveBillableEvent(rowIndex) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sh = ss.getSheetByName('Billable_Events');
  
  if (!sh) {
    throw new Error('Billable_Events sheet not found');
  }
  
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('Status') + 1;
  const updatedCol = headers.indexOf('Updated At') + 1;
  
  if (statusCol === 0) {
    throw new Error('Status column not found');
  }
  
  const currentStatus = sh.getRange(rowIndex, statusCol).getValue();
  
  if (currentStatus !== 'PENDING') {
    throw new Error('Can only approve PENDING events. Current status: ' + currentStatus);
  }
  
  sh.getRange(rowIndex, statusCol).setValue('APPROVED');
  if (updatedCol > 0) {
    sh.getRange(rowIndex, updatedCol).setValue(new Date());
  }
  
  Logger.log('Event approved at row ' + rowIndex);
  return true;
}

/**
 * Put a billable event on hold
 */
function holdBillableEvent(rowIndex, reason) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sh = ss.getSheetByName('Billable_Events');
  
  if (!sh) {
    throw new Error('Billable_Events sheet not found');
  }
  
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('Status') + 1;
  const notesCol = headers.indexOf('Notes') + 1;
  const updatedCol = headers.indexOf('Updated At') + 1;
  
  sh.getRange(rowIndex, statusCol).setValue('HOLD');
  if (notesCol > 0 && reason) {
    const existingNotes = sh.getRange(rowIndex, notesCol).getValue();
    sh.getRange(rowIndex, notesCol).setValue(
      (existingNotes ? existingNotes + '\n' : '') + 
      '[HOLD ' + new Date().toISOString() + '] ' + reason
    );
  }
  if (updatedCol > 0) {
    sh.getRange(rowIndex, updatedCol).setValue(new Date());
  }
  
  Logger.log('Event on hold at row ' + rowIndex + ': ' + reason);
  return true;
}
