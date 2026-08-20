/**
 * Transaction Helper Functions
 * Provides utility functions for transaction-related operations
 */

/**
 * Get the proper note name based on transaction type
 * @param {string} transactionType - The transaction type (RECEIVE, RETURN, ISSUE, etc.)
 * @param {string} deliveryNote - The delivery note code (optional, for determining type from code)
 * @returns {string} - The proper note name (e.g., "Receive Note", "Return Note")
 */
export function getTransactionNoteName(transactionType, deliveryNote = null) {
  // If deliveryNote is provided, try to determine type from code prefix
  if (deliveryNote && typeof deliveryNote === 'string') {
    const prefix = deliveryNote.split('-')[0]?.toUpperCase();
    
    const prefixMap = {
      'REC': 'Receive Note',
      'RTN': 'Return Note',
      'DN': 'Delivery Note',
      'LOS': 'Loss Note',
      'DAM': 'Damage Note',
      'ISU': 'Issue Note',
      'USE': 'Usage Note',
      'UNI': 'Uniform Note',
      'ADJ': 'Adjustment Note',
      'TRN': 'Transfer Note',
      'INB': 'Inbound Note',
      'QTN': 'Quarantine Note',
      'REL': 'Release Note',
    };
    
    if (prefixMap[prefix]) {
      return prefixMap[prefix];
    }
  }

  // Fallback to transaction type
  const typeMap = {
    'RECEIVE': 'Receive Note',
    'RETURN': 'Return Note',
    'ISSUE': 'Delivery Note',
    'LOST': 'Loss Note',
    'DAMAGE': 'Damage Note',
    'USED': 'Usage Note',
    'UNIFORM': 'Uniform Note',
    'ADJUSTMENT': 'Adjustment Note',
    'TRANSFER': 'Transfer Note',
    'INBOUND': 'Inbound Note',
    'QUARANTINE': 'Quarantine Note',
    'RELEASE': 'Release Note',
  };

  return typeMap[transactionType?.toUpperCase()] || 'Transaction Note';
}

/**
 * Get the short note name (for buttons/labels)
 * @param {string} transactionType - The transaction type
 * @param {string} deliveryNote - The delivery note code (optional)
 * @returns {string} - Short note name (e.g., "Receive", "Return")
 */
export function getTransactionNoteShortName(transactionType, deliveryNote = null) {
  return getTransactionNoteName(transactionType, deliveryNote).replace(' Note', '');
}

/**
 * Get the transaction type code from transaction type
 * @param {string} transactionType - The transaction type (RECEIVE, RETURN, etc.)
 * @returns {string} - The 3-letter type code (REC, RTN, DEL, etc.)
 */
export function getTransactionTypeCode(transactionType) {
  const codeMap = {
    'RECEIVE': 'REC',
    'RETURN': 'RTN',
    'ISSUE': 'DN',
    'LOST': 'LOS',
    'DAMAGE': 'DAM',
    'USED': 'USE',
    'UNIFORM': 'UNI',
    'ADJUSTMENT': 'ADJ',
    'TRANSFER': 'TRN',
    'INBOUND': 'INB',
    'QUARANTINE': 'QTN',
    'RELEASE': 'REL',
  };

  return codeMap[transactionType?.toUpperCase()] || 'TXN';
}

/**
 * Get transaction type from code prefix
 * @param {string} deliveryNote - The delivery note code
 * @returns {string} - The transaction type
 */
export function getTransactionTypeFromCode(deliveryNote) {
  if (!deliveryNote || typeof deliveryNote !== 'string') {
    return 'UNKNOWN';
  }

  const prefix = deliveryNote.split('-')[0]?.toUpperCase();
  
  const prefixToTypeMap = {
    'REC': 'RECEIVE',
    'RTN': 'RETURN',
    'DN': 'ISSUE',
    'LOS': 'LOST',
    'DAM': 'DAMAGE',
    'ISU': 'ISSUE',
    'USE': 'USED',
    'UNI': 'UNIFORM',
    'ADJ': 'ADJUSTMENT',
    'TRN': 'TRANSFER',
    'INB': 'INBOUND',
    'QTN': 'QUARANTINE',
    'REL': 'RELEASE',
  };

  return prefixToTypeMap[prefix] || 'UNKNOWN';
}

/**
 * Parse transaction code components
 * @param {string} deliveryNote - The delivery note code
 * @returns {object} - Parsed components { type, brand, date, sequence }
 */
export function parseTransactionCode(deliveryNote) {
  if (!deliveryNote || typeof deliveryNote !== 'string') {
    return null;
  }

  const parts = deliveryNote.split('-');
  
  if (parts.length !== 4) {
    return null; // Old format or invalid
  }

  const [type, brand, dateStr, sequence] = parts;

  // Parse date from DDMMYY format
  let date = null;
  if (dateStr && dateStr.length === 6) {
    const day = parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10) - 1; // JS months are 0-indexed
    const year = 2000 + parseInt(dateStr.substring(4, 6), 10);
    date = new Date(year, month, day);
  }

  return {
    type,
    brand,
    date,
    sequence: parseInt(sequence, 10),
    isNewFormat: true
  };
}

/**
 * Format transaction code for display with icon
 * @param {string} deliveryNote - The delivery note code
 * @returns {string} - Formatted display text
 */
export function formatTransactionCodeDisplay(deliveryNote) {
  if (!deliveryNote) return 'N/A';

  const parsed = parseTransactionCode(deliveryNote);
  
  if (!parsed) {
    return deliveryNote; // Return as-is for old format
  }

  const typeEmojis = {
    'REC': '📥',
    'RTN': '↩️',
    'DN': '📤',
    'LOS': '❌',
    'DAM': '🔨',
    'ISU': '📋',
    'USE': '✓',
    'UNI': '👕',
    'ADJ': '⚙️',
    'TRN': '🔄',
    'INB': '⬇️',
    'QTN': '🔒',
    'REL': '🔓',
  };

  const emoji = typeEmojis[parsed.type] || '📄';
  
  return `${emoji} ${deliveryNote}`;
}

/**
 * Get color class for transaction type
 * @param {string} transactionType - The transaction type or code
 * @returns {string} - Tailwind color class
 */
export function getTransactionTypeColor(transactionType) {
  const type = transactionType?.toUpperCase();
  
  const colorMap = {
    // Types
    'RECEIVE': 'text-green-600',
    'RETURN': 'text-yellow-600',
    'ISSUE': 'text-blue-600',
    'LOST': 'text-red-600',
    'DAMAGE': 'text-orange-600',
    
    // Codes
    'REC': 'text-green-600',
    'RTN': 'text-yellow-600',
    'DN': 'text-blue-600',
    'LOS': 'text-red-600',
    'DAM': 'text-orange-600',
    'ISU': 'text-purple-600',
    'USE': 'text-gray-600',
    'UNI': 'text-indigo-600',
  };

  return colorMap[type] || 'text-gray-600';
}
