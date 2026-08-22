'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

/**
 * Expandable delivery note group — shows a header row with DN info,
 * an expand/collapse toggle, and renders children when expanded.
 *
 * @param {Object} props
 * @param {string} props.deliveryNote - The delivery note code
 * @param {string} props.entityName - Source/destination name (store, supplier, etc.)
 * @param {string} props.timestamp - Timestamp string or Date
 * @param {number} props.itemCount - Number of items in the group
 * @param {boolean} props.isExpanded - Whether the group is expanded
 * @param {Function} props.onToggle - Called when expand/collapse is clicked
 * @param {React.ReactNode} props.children - Expanded content (table rows, etc.)
 * @param {React.ReactNode} [props.actions] - Action buttons in the header (e.g., PDF, edit)
 * @param {string} [props.entityLabel] - Label for the entity (e.g., "Source", "Store")
 */
export default function DeliveryNoteGroup({
  deliveryNote,
  entityName,
  timestamp,
  itemCount,
  isExpanded,
  onToggle,
  children,
  actions,
  entityLabel = 'Source',
}) {
  const dateStr = timestamp
    ? new Date(timestamp).toLocaleDateString('en-AE', {
        timeZone: 'Asia/Dubai',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '---';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Group header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated/30 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
        )}
        <FileText size={14} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono font-bold text-xs text-primary">{deliveryNote}</span>
          <span className="text-[11px] text-text-secondary">{entityLabel}: {entityName}</span>
          <span className="text-[10px] text-text-muted">{dateStr}</span>
          <span className="text-[10px] font-semibold text-text-muted bg-surface-elevated px-1.5 py-0.5 rounded">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
