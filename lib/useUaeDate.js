'use client';

import { useState } from 'react';

/**
 * Get current date/time in UAE timezone (UTC+4) formatted for <input type="datetime-local">.
 * @returns {string} e.g. "2026-08-23T14:30"
 */
function getUaeNow() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * React hook that initializes a date state to UAE timezone "now".
 * Returns [value, setter] like regular useState.
 *
 * Usage:
 *   const [transactionDate, setTransactionDate] = useUaeDate();
 *   <input type="datetime-local" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
 *
 * @param {string} [initialValue] - Override initial value (default: UAE now)
 * @returns {[string, Function]}
 */
export function useUaeDate(initialValue) {
  const [value, setValue] = useState(() => initialValue ?? getUaeNow());
  return [value, setValue];
}

export { getUaeNow };
