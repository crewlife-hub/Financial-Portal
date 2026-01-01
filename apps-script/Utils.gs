/**
 * Crew Finance Portal - Google Apps Script
 * Utility functions
 */

/**
 * Format currency amount
 */
function formatCurrency(amount, currency) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'ZAR': 'R'
  };
  
  const symbol = symbols[currency] || currency + ' ';
  return symbol + Number(amount).toFixed(2);
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  // Try ISO format first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  
  return null;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  
  if (!d1 || !d2) return null;
  
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is within deadline
 */
function isWithinDeadline(triggerDate, deadlineDays) {
  const trigger = parseDate(triggerDate);
  if (!trigger) return false;
  
  const deadline = new Date(trigger);
  deadline.setDate(deadline.getDate() + deadlineDays);
  
  return new Date() <= deadline;
}

/**
 * Check 30-day eligibility (for RCG/QRC)
 */
function check30DayEligibility(embarkDate) {
  const embark = parseDate(embarkDate);
  if (!embark) return { eligible: false, daysCompleted: 0 };
  
  const today = new Date();
  const days = daysBetween(embark, today);
  
  return {
    eligible: days >= 30,
    daysCompleted: days,
    thirtyDayMark: new Date(embark.getTime() + (30 * 24 * 60 * 60 * 1000))
  };
}

/**
 * Extract PIN from text (memo, description, etc.)
 */
function extractPinFromText(text) {
  if (!text) return null;
  
  // Look for PIN patterns: PIN:123456, PIN-123456, PIN 123456
  const patterns = [
    /PIN[:\s-]*(\d{5,8})/i,
    /\b(\d{6,8})\b/  // Fallback: any 6-8 digit number
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Clean and normalize control number
 */
function normalizeControlNumber(cn) {
  if (!cn) return null;
  return cn.toString().trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Get current fiscal month boundaries
 */
function getCurrentFiscalMonth() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  return {
    start: firstDay,
    end: lastDay,
    month: today.getMonth() + 1,
    year: today.getFullYear()
  };
}

/**
 * Toast notification helper
 */
function showToast(message, title, duration) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    message,
    title || 'Crew Finance',
    duration || 5
  );
}
