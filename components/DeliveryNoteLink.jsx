'use client';

import React from 'react';
import { FileText } from 'lucide-react';

export function getDeliveryNotePdfUrl(tx) {
  if (!tx || (!tx.deliveryNote && typeof tx !== 'string')) return null;
  const dn = typeof tx === 'string' ? tx : tx.deliveryNote;
  if (!dn || dn === 'UNASSIGNED') return null;

  const dateStr = (typeof tx === 'object' && tx?.timestamp)
    ? new Date(tx.timestamp).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const brandId = typeof tx === 'object'
    ? (tx.product?.brandId || tx.product?.brand?.id || '')
    : '';

  const txType = typeof tx === 'object' ? tx.transactionType : '';

  if (txType === 'DAMAGE' || dn.startsWith('DAM-') || dn.startsWith('IML-DAM-')) {
    return `/api/dashboard/damage/delivery-note?date=${dateStr}&brandId=${brandId}&dn=${encodeURIComponent(dn)}`;
  }
  if (txType === 'LOST' || dn.startsWith('LOS-') || dn.startsWith('IML-LOS-')) {
    return `/api/dashboard/loss/delivery-note?date=${dateStr}&brandId=${brandId}&dn=${encodeURIComponent(dn)}`;
  }
  if (dn.startsWith('CGP-') || dn.startsWith('GP-') || txType === 'CLIENT_STOCK') {
    return `/api/dashboard/client-returns/gate-pass?dn=${encodeURIComponent(dn)}&brandId=${brandId}&date=${dateStr}`;
  }
  if (dn.startsWith('CRP-') || dn.startsWith('CRN-') || dn.startsWith('CRR-') || txType === 'CLIENT_RETURN') {
    return `/api/dashboard/client-returns/return-gate-pass?dn=${encodeURIComponent(dn)}&brandId=${brandId}&date=${dateStr}`;
  }
  if (txType === 'RECEIVE' || dn.startsWith('REC-') || dn.startsWith('IN-')) {
    return `/api/dashboard/inbound/delivery-note?date=${dateStr}&brandId=${brandId}&dn=${encodeURIComponent(dn)}`;
  }
  if (txType === 'ISSUE' && typeof tx === 'object' && tx.toEntityType === 'STORE' && tx.toEntityId) {
    return `/api/dashboard/stores/${tx.toEntityId}/delivery-note?date=${dateStr}&brandId=${brandId}&dn=${encodeURIComponent(dn)}`;
  }

  // Default fallback for dispatches, returns, rebrands, used, etc.
  return `/api/dashboard/returns/delivery-note?date=${dateStr}&brandId=${brandId}&dn=${encodeURIComponent(dn)}`;
}

export default function DeliveryNoteLink({
  tx,
  deliveryNote,
  className = '',
  showIcon = true,
  variant = 'default',
}) {
  const dnText = deliveryNote || (typeof tx === 'object' ? tx?.deliveryNote : tx);
  if (!dnText || dnText === 'UNASSIGNED') {
    return <span className="text-text-muted">---</span>;
  }

  const pdfUrl = getDeliveryNotePdfUrl(typeof tx === 'object' ? tx : { deliveryNote: dnText });

  if (!pdfUrl) {
    return <span className="font-mono text-xs text-text-secondary">{dnText}</span>;
  }

  let badgeStyle = 'text-primary hover:text-primary-hover hover:underline transition-colors font-mono font-semibold text-xs inline-flex items-center gap-1.5 has-tooltip';
  if (variant === 'badge') {
    badgeStyle = 'inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2 py-0.5 rounded transition-all has-tooltip';
  } else if (variant === 'success') {
    badgeStyle = 'inline-flex items-center gap-1 font-mono text-xs font-semibold text-success hover:text-success/80 hover:underline transition-all has-tooltip';
  }

  return (
    <a
      href={pdfUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${badgeStyle} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && <FileText size={13} className="shrink-0" />}
      <span>{dnText}</span>
      <span className="tooltip-box">View / Download Note PDF ({dnText})</span>
    </a>
  );
}
