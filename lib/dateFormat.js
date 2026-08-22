/**
 * Date Formatting Utilities — UAE timezone (Asia/Dubai, UTC+4).
 *
 * Shared across all pages that display dates to avoid duplicating
 * the toLocaleDateString configuration.
 */

const UAE_TIMEZONE = 'Asia/Dubai';
const UAE_LOCALE = 'en-AE';

/**
 * Format a date for display (short format).
 * e.g. "23 Aug 2026"
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '---';
  return new Date(date).toLocaleDateString(UAE_LOCALE, {
    timeZone: UAE_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date with time for display.
 * e.g. "23 Aug 2026, 02:30 PM"
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '---';
  return new Date(date).toLocaleDateString(UAE_LOCALE, {
    timeZone: UAE_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date for input fields (YYYY-MM-DDTHH:mm).
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatInputDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format a date for file names (YYYY-MM-DD).
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatFileDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  return new Date(date).toISOString().split('T')[0];
}
