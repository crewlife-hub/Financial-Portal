/**
 * Crew Finance Portal - Google Apps Script
 * Configuration and constants
 */

const CFG = {
  // Google Sheets for QBO reconciliation
  SPREADSHEET_ID: '1ZbWxjkemOxOHNN1r3SzauZXE75oxqTHLG0tPoyDC9V0',
  LEDGER_TAB: 'Data',
  
  // QBO API settings
  QBO_DAYS_BACK: 365,
  PAGE_SIZE: 100,
  PAGE_DELAY_MS: 200,
  
  // Smartsheet sheet IDs
  SMARTSHEET: {
    SEABOUND_MASTER: '6474854984273796',
    COSTA_DAILY_RATE: '2691619355578244',
    SEACHEFS_RIVER: '1711381033209732'
  }
};

// QBO Customer name mapping
const QBO_CUSTOMERS = {
  'rcg': 'Royal Caribbean Group',
  'qrc': 'Quality River Catering',
  'costa': 'Costa Cruises',
  'seachefsOcean': 'Seachefs Cruises LTD',
  'seachefsRiver': 'Sea Chefs River Cruises Ltd',
  'cscs': 'Cruise Ships Catering and Services International N.V.',
  'crystal': 'Crystal Cruises LTD'
};

// Client codes for idempotency keys
const CLIENT_CODES = {
  'Royal Caribbean Group': 'RCG',
  'Quality River Catering': 'QRC',
  'Costa Cruises': 'COSTA',
  'Seachefs Cruises LTD': 'SEACHEFS-OCEAN',
  'Sea Chefs River Cruises Ltd': 'SEACHEFS-RIVER',
  'Cruise Ships Catering and Services International N.V.': 'CSCS',
  'Crystal Cruises LTD': 'CRYSTAL'
};

// Smartsheet column IDs - Seabound Master
const SS_SEABOUND_COLS = {
  invoiceNumber: '8970750355263364',
  financeStatus: '69104216788868',
  thirtyDayMark: '4467150727892868',
  pin: '2921892361752452',
  pinKey: '5598709438697348',
  controlNumber: '1023980673388420',
  email: '6511789236506500',
  company: '7988313093525380',
  signOnDate: '6926186656255876',
  allSignOnDates: '5173692175437700',
  departureDate: '8943051180035972'
};

// Smartsheet column IDs - Costa Daily Rate
const SS_COSTA_COLS = {
  invoiceNumber: '5494596410494852',
  invoiceNumberAlt: '4203398878154628',
  otfStatus: '6247030216937348',
  statusPayment: '3242796596809604',
  paymentDate: '709521806413700',
  dailyRate: '6057546363916164',
  daysOnboard: '8309346177601412',
  totalForMonth: '7746396224180100',
  fromDate: '3805746550230916',
  toDate: '990996783124356',
  pin: '6339021340626820',
  controlNumber: '8719155179769732',
  email: '5213121433784196',
  projectedDate: '4931646457073540',
  signOffDate: '1553946736545668'
};

// Smartsheet column IDs - Seachefs River
const SS_RIVER_COLS = {
  invoiceNumber: '2583191501885316',
  statusPayment: '1490114162937732',
  paymentDate: '3632166959009668',
  dailyRate: '2506267052167044',
  daysOnboard: '1380367145324420',
  totalForMonth: '8986264466050948',
  fromDate: '1433758420651908',
  toDate: '5937358048022404',
  pin: '1013454934331268',
  email: '6080004515123076'
};
