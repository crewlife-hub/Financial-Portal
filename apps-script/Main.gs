/**
 * Crew Finance Portal - Google Apps Script
 * Main entry point and menu functions
 */

/**
 * Runs on spreadsheet open - creates custom menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚢 Crew Finance')
    .addItem('📊 Sync QBO Invoices', 'syncQBOInvoices')
    .addItem('💰 Sync QBO Payments', 'syncQBOPayments')
    .addSeparator()
    .addItem('🔄 Full Reconciliation', 'runFullReconciliation')
    .addItem('📋 Generate Billable Events', 'generateBillableEvents')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Setup')
      .addItem('Ensure Headers', 'ensureLedgerHeaders')
      .addItem('Test Connection', 'testConnection'))
    .addToUi();
}

/**
 * Main function - entry point
 */
function myFunction() {
  Logger.log('Crew Finance Portal - Apps Script initialized');
  Logger.log('Spreadsheet ID: ' + CFG.SPREADSHEET_ID);
  Logger.log('Clients configured: ' + Object.keys(QBO_CUSTOMERS).length);
}

/**
 * Test connection to spreadsheet
 */
function testConnection() {
  try {
    const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const sheetNames = ss.getSheets().map(s => s.getName());
    
    SpreadsheetApp.getUi().alert(
      'Connection Successful ✅',
      'Spreadsheet: ' + ss.getName() + '\n' +
      'Sheets: ' + sheetNames.join(', '),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    Logger.log('Connection test passed');
    return true;
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      'Connection Failed ❌',
      'Error: ' + e.message,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    Logger.log('Connection test failed: ' + e.message);
    return false;
  }
}

/**
 * Ensure ledger headers exist
 */
function ensureLedgerHeaders() {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(CFG.LEDGER_TAB);
  
  if (!sh) {
    sh = ss.insertSheet(CFG.LEDGER_TAB);
  }
  
  if (sh.getLastRow() === 0) {
    const headers = [
      'PIN',
      'Control Number',
      'First Name',
      'Last Name',
      'Company',
      'Vessel',
      'Embarkation Date',
      '30 Day Mark',
      'Billing Mode',
      'Fee Type',
      'Currency',
      'Amount',
      'Idempotency Key',
      'Invoice #',
      'Invoice Date',
      'Due Date',
      'Status',
      'Payment Date',
      'Notes',
      'Last Updated'
    ];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    
    Logger.log('Headers created: ' + headers.length + ' columns');
  }
  
  return sh;
}

/**
 * Run full reconciliation
 */
function runFullReconciliation() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Run Full Reconciliation?',
    'This will sync invoices and payments from QuickBooks.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      ensureLedgerHeaders();
      syncQBOInvoices();
      syncQBOPayments();
      
      ui.alert('Reconciliation Complete ✅', 'Data has been synced.', ui.ButtonSet.OK);
    } catch (e) {
      ui.alert('Reconciliation Failed ❌', 'Error: ' + e.message, ui.ButtonSet.OK);
    }
  }
}
