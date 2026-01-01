/**
 * Crew Finance Portal - Google Apps Script
 * QuickBooks Online integration functions
 */

// Headers for QBO data
const HDR_INVOICES = [
  'InvoiceId', 'CustomerName', 'TxnDate', 'DueDate', 'TotalAmt',
  'Balance', 'CurrencyRef', 'DocNumber', 'PrivateNote', 'CreatedAt'
];

const HDR_PAYMENTS = [
  'PaymentId', 'CustomerName', 'TxnDate', 'TotalAmt', 'UnappliedAmt',
  'CurrencyRef', 'PrivateNote', 'CreatedAt'
];

const HDR_LINES = [
  'InvoiceId', 'LineId', 'Description', 'Amount', 'ItemRef', 'Qty', 'Rate'
];

/**
 * Get or create a sheet by name
 */
function getOrCreateSheet_(sheetName) {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }
  return sh;
}

/**
 * Build header index from sheet
 */
function headerIndexFromSheet_(sheet, headers, createIfMissing) {
  const idx = {};
  
  if (sheet.getLastRow() === 0 && createIfMissing) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  if (sheet.getLastRow() > 0) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    existingHeaders.forEach((h, i) => {
      if (h) idx[h] = i;
    });
  }
  
  // Add missing headers
  headers.forEach((h, i) => {
    if (!(h in idx)) {
      idx[h] = i;
    }
  });
  
  return idx;
}

/**
 * Clear data rows (keep headers)
 */
function clearDataByHeaders_(sheet, headers, idx) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
  }
}

/**
 * Write matrix by headers
 */
function writeMatrixByHeaders_(sheet, headers, rows, idx) {
  if (!rows || rows.length === 0) return;
  
  const matrix = rows.map(row => {
    const arr = new Array(headers.length).fill('');
    headers.forEach((h, i) => {
      if (row[h] !== undefined) {
        arr[i] = row[h];
      }
    });
    return arr;
  });
  
  sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
  Logger.log('Wrote ' + matrix.length + ' rows');
}

/**
 * Generate ISO date string for days ago
 */
function daysAgoISO_Z(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * QBO API fetch wrapper (placeholder - needs OAuth setup)
 */
function qboFetch_(query) {
  // TODO: Implement OAuth2 flow and actual API call
  // For now, return empty response
  Logger.log('QBO Query: ' + query);
  return { QueryResponse: { Invoice: [], Payment: [] } };
}

/**
 * Sync QBO Invoices
 */
function syncQBOInvoices() {
  const sh = getOrCreateSheet_('QBO_Invoices');
  const idx = headerIndexFromSheet_(sh, HDR_INVOICES, true);
  clearDataByHeaders_(sh, HDR_INVOICES, idx);
  
  const since = daysAgoISO_Z(CFG.QBO_DAYS_BACK);
  let start = 1, total = 0, all = [];
  
  while (true) {
    const q = `select * from Invoice where MetaData.CreateTime >= '${since}' order by MetaData.CreateTime desc startposition ${start} maxresults ${CFG.PAGE_SIZE}`;
    const js = qboFetch_(q);
    const invs = (js.QueryResponse && js.QueryResponse.Invoice) || [];
    
    if (!invs.length) break;
    
    const rows = invs.map(inv => ({
      'InvoiceId': inv.Id,
      'CustomerName': inv.CustomerRef ? inv.CustomerRef.name : '',
      'TxnDate': inv.TxnDate,
      'DueDate': inv.DueDate,
      'TotalAmt': inv.TotalAmt,
      'Balance': inv.Balance,
      'CurrencyRef': inv.CurrencyRef ? inv.CurrencyRef.value : '',
      'DocNumber': inv.DocNumber,
      'PrivateNote': inv.PrivateNote || '',
      'CreatedAt': inv.MetaData ? inv.MetaData.CreateTime : ''
    }));
    
    total += rows.length;
    all = all.concat(rows);
    
    if (invs.length < CFG.PAGE_SIZE) break;
    start += CFG.PAGE_SIZE;
    Utilities.sleep(CFG.PAGE_DELAY_MS);
  }
  
  Logger.log('Invoice sync: ' + total + ' invoices');
  writeMatrixByHeaders_(sh, HDR_INVOICES, all, idx);
}

/**
 * Sync QBO Payments
 */
function syncQBOPayments() {
  const sh = getOrCreateSheet_('QBO_Payments');
  const idx = headerIndexFromSheet_(sh, HDR_PAYMENTS, true);
  clearDataByHeaders_(sh, HDR_PAYMENTS, idx);
  
  const since = daysAgoISO_Z(CFG.QBO_DAYS_BACK);
  let start = 1, total = 0, all = [];
  
  while (true) {
    const q = `select * from Payment where MetaData.CreateTime >= '${since}' order by MetaData.CreateTime desc startposition ${start} maxresults ${CFG.PAGE_SIZE}`;
    const js = qboFetch_(q);
    const pmts = (js.QueryResponse && js.QueryResponse.Payment) || [];
    
    if (!pmts.length) break;
    
    const rows = pmts.map(pmt => ({
      'PaymentId': pmt.Id,
      'CustomerName': pmt.CustomerRef ? pmt.CustomerRef.name : '',
      'TxnDate': pmt.TxnDate,
      'TotalAmt': pmt.TotalAmt,
      'UnappliedAmt': pmt.UnappliedAmt,
      'CurrencyRef': pmt.CurrencyRef ? pmt.CurrencyRef.value : '',
      'PrivateNote': pmt.PrivateNote || '',
      'CreatedAt': pmt.MetaData ? pmt.MetaData.CreateTime : ''
    }));
    
    total += rows.length;
    all = all.concat(rows);
    
    if (pmts.length < CFG.PAGE_SIZE) break;
    start += CFG.PAGE_SIZE;
    Utilities.sleep(CFG.PAGE_DELAY_MS);
  }
  
  Logger.log('Payment sync: ' + total + ' payments');
  writeMatrixByHeaders_(sh, HDR_PAYMENTS, all, idx);
}

/**
 * Dump QBO Invoice Lines (STRICT version)
 */
function dumpQBOInvoiceLines_STRICT() {
  const sh = getOrCreateSheet_('QBO_Invoice_Lines');
  const idx = headerIndexFromSheet_(sh, HDR_LINES, sh.getLastRow() === 0);
  clearDataByHeaders_(sh, HDR_LINES, idx);

  const since = daysAgoISO_Z(CFG.QBO_DAYS_BACK);
  let start = 1, total = 0, all = [];
  
  while (true) {
    const q = `select * from Invoice where MetaData.CreateTime >= '${since}' order by MetaData.CreateTime desc startposition ${start} maxresults ${CFG.PAGE_SIZE}`;
    const js = qboFetch_(q);
    const invs = (js.QueryResponse && js.QueryResponse.Invoice) || [];
    
    if (!invs.length) break;

    const rows = rowsFromInvoiceLines_(invs);
    total += rows.length;
    all = all.concat(rows);

    if (invs.length < CFG.PAGE_SIZE) break;
    start += CFG.PAGE_SIZE;
    Utilities.sleep(CFG.PAGE_DELAY_MS);
  }

  Logger.log('Invoice lines staged (STRICT): ' + total);
  writeMatrixByHeaders_(sh, HDR_LINES, all, idx);
}

/**
 * Extract line items from invoices
 */
function rowsFromInvoiceLines_(invoices) {
  const rows = [];
  
  invoices.forEach(inv => {
    if (!inv.Line) return;
    
    inv.Line.forEach(line => {
      if (line.DetailType === 'SalesItemLineDetail') {
        rows.push({
          'InvoiceId': inv.Id,
          'LineId': line.Id,
          'Description': line.Description || '',
          'Amount': line.Amount,
          'ItemRef': line.SalesItemLineDetail && line.SalesItemLineDetail.ItemRef 
            ? line.SalesItemLineDetail.ItemRef.name : '',
          'Qty': line.SalesItemLineDetail ? line.SalesItemLineDetail.Qty : '',
          'Rate': line.SalesItemLineDetail ? line.SalesItemLineDetail.UnitPrice : ''
        });
      }
    });
  });
  
  return rows;
}
