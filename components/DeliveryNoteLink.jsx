'use client';

import React from 'react';
import { FileText } from 'lucide-react';

export function getDeliveryNotePdfUrl(tx) {
  if (!tx || (!tx.deliveryNote && typeof tx !== 'string')) return null;
  const dn = typeof tx === 'string' ? tx : tx.deliveryNote;
  if (!dn || dn === 'UNASSIGNED' || dn === '—') return null;

  const dateStr = (typeof tx === 'object' && tx?.timestamp)
    ? new Date(tx.timestamp).toISOString().split('T')[0]
    : '';

  const brandId = typeof tx === 'object'
    ? (tx.product?.brandId || tx.product?.brand?.id || '')
    : '';

  const txType = typeof tx === 'object' ? tx.transactionType : '';

  const queryParams = new URLSearchParams();
  queryParams.set('dn', dn);
  if (brandId) queryParams.set('brandId', brandId);
  if (dateStr) queryParams.set('date', dateStr);

  const qs = queryParams.toString();

  if (txType === 'DAMAGE' || dn.startsWith('DAM-') || dn.startsWith('DMG-')) {
    return `/api/dashboard/damage/delivery-note?${qs}`;
  }
  if (txType === 'LOST' || dn.startsWith('LOS-') || dn.startsWith('LSS-')) {
    return `/api/dashboard/loss/delivery-note?${qs}`;
  }
  if (
    (typeof tx === 'object' && tx.fromEntityType === 'BRAND' && tx.toEntityType === 'WAREHOUSE') ||
    dn.startsWith('CRR-')
  ) {
    return `/api/dashboard/client-returns/return-gate-pass?${qs}`;
  }
  if (
    (typeof tx === 'object' && (tx.toEntityType === 'BRAND' || tx.fromEntityType === 'BRAND')) ||
    dn.startsWith('CGP-') || dn.startsWith('CRN-') || dn.startsWith('CRP-') || dn.startsWith('CLT-') || dn.startsWith('GP-') ||
    txType === 'CLIENT_STOCK' || txType === 'CLIENT_RETURN'
  ) {
    return `/api/dashboard/client-returns/gate-pass?${qs}`;
  }
  if (txType === 'RECEIVE' || dn.startsWith('REC-') || dn.startsWith('IN-')) {
    return `/api/dashboard/inbound/delivery-note?${qs}`;
  }
  if (txType === 'ISSUE' && typeof tx === 'object' && tx.toEntityType === 'STORE' && tx.toEntityId) {
    return `/api/dashboard/stores/${tx.toEntityId}/delivery-note?${qs}`;
  }

  // Default fallback for dispatches, returns, rebrands, used, etc.
  return `/api/dashboard/returns/delivery-note?${qs}`;
}

export function getDeliveryNotePreviewUrl(tx, fallbackTitle = 'Delivery Note') {
  const rawUrl = getDeliveryNotePdfUrl(tx);
  if (!rawUrl) return null;
  const title = (typeof tx === 'object' ? tx?.deliveryNote : tx) || fallbackTitle;
  return `/pdf-preview?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(title)}`;
}

export default function DeliveryNoteLink({
  tx,
  deliveryNote,
  className = '',
  showIcon = true,
  variant = 'default',
}) {
  const dnText = deliveryNote || (typeof tx === 'object' ? tx?.deliveryNote : tx);
  if (!dnText || dnText === 'UNASSIGNED' || dnText === '—') {
    return <span className="text-text-muted font-mono text-xs">—</span>;
  }

  const pdfUrl = getDeliveryNotePdfUrl(typeof tx === 'object' ? tx : { deliveryNote: dnText });

  if (!pdfUrl) {
    return <span className="font-mono text-xs text-text-secondary">{dnText}</span>;
  }

  const previewUrl = `/pdf-preview?url=${encodeURIComponent(pdfUrl)}&title=${encodeURIComponent(dnText)}`;

  let badgeStyle = 'text-primary hover:text-primary-hover hover:underline transition-colors font-mono font-bold text-xs inline-flex items-center gap-1.5 has-tooltip';
  if (variant === 'badge') {
    badgeStyle = 'inline-flex items-center gap-1 font-mono text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded transition-all has-tooltip';
  } else if (variant === 'success') {
    badgeStyle = 'inline-flex items-center gap-1 font-mono text-xs font-bold text-success hover:text-success/80 hover:underline transition-all has-tooltip';
  }

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${badgeStyle} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && <FileText size={13} className="shrink-0 text-primary" />}
      <span>{dnText}</span>
      <span className="tooltip-box">View / Download PDF ({dnText})</span>
    </a>
  );
}
