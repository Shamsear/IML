'use client';

import { useState, useMemo } from 'react';

/**
 * Universal Hook for table column sorting.
 *
 * @param {Array} items - Array of objects to sort
 * @param {string} [initialField=''] - Initial sort field
 * @param {'asc' | 'desc'} [initialDirection='asc'] - Initial sort direction
 * @param {Object} [customGetters={}] - Custom field value extractors: { [field]: (item) => value }
 */
export function useTableSort(items = [], initialField = '', initialDirection = 'asc', customGetters = {}) {
  const [sortField, setSortField] = useState(initialField);
  const [sortDirection, setSortDirection] = useState(initialDirection);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortField || !items.length) return items;

    return [...items].sort((a, b) => {
      let valA, valB;

      if (customGetters[sortField]) {
        valA = customGetters[sortField](a);
        valB = customGetters[sortField](b);
      } else if (sortField.includes('.')) {
        valA = sortField.split('.').reduce((acc, part) => acc?.[part], a);
        valB = sortField.split('.').reduce((acc, part) => acc?.[part], b);
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDirection === 'asc' ? 1 : -1;
      if (valB == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      // Check if values can be parsed as dates
      const isDateA = valA instanceof Date || (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA));
      const isDateB = valB instanceof Date || (typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB));
      if (isDateA && isDateB) {
        const timeA = new Date(valA).getTime();
        const timeB = new Date(valB).getTime();
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      return sortDirection === 'asc' ? strA.localeCompare(strB, undefined, { numeric: true }) : strB.localeCompare(strA, undefined, { numeric: true });
    });
  }, [items, sortField, sortDirection, customGetters]);

  return {
    sortedItems,
    sortField,
    sortDirection,
    handleSort,
    setSortField,
    setSortDirection,
  };
}
