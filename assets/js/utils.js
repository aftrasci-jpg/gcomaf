// Utility functions for the CRM application

/**
 * Format a number as Franc CFA (XOF) currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted string with FCFA
 */
export function formatCFA(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 FCFA';
  }

  // Use Intl.NumberFormat for proper French formatting
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${formatter.format(amount)} FCFA`;
}

/**
 * Parse a formatted CFA string back to number
 * @param {string} cfaString - The CFA formatted string (e.g., "1 234,56 FCFA")
 * @returns {number} The numeric value
 */
export function parseCFA(cfaString) {
  if (!cfaString || typeof cfaString !== 'string') {
    return 0;
  }

  // Remove 'FCFA' and clean up formatting
  const cleaned = cfaString.replace('FCFA', '').trim();
  // Replace French thousands separator (space) and decimal separator (comma)
  const normalized = cleaned.replace(/\s/g, '').replace(',', '.');

  return parseFloat(normalized) || 0;
}

/**
 * Generate a secure random password
 * @param {number} length - Length of the password (default: 10)
 * @returns {string} Generated password
 */
export function generatePassword(length = 10) {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
