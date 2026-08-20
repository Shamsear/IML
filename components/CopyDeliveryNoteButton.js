'use client';

import { useState } from 'react';
import { CopyPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CopyDeliveryNoteButton({ type, noteType = 'Delivery' }) {
  const router = useRouter();

  const handleCopy = () => {
    const dn = window.prompt(`Enter the ${noteType} Note number you want to copy:`);
    if (dn) {
      router.push(`/dashboard/${type}/new?copyDn=${dn}`);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-primary font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all duration-200"
    >
      <CopyPlus size={16} />
      <span className="hidden sm:inline">Copy by {noteType} Note</span>
    </button>
  );
}