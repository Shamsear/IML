'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Copy-to-clipboard button with visual feedback.
 * Replaces the duplicated navigator.clipboard + copied state pattern.
 *
 * @param {Object} props
 * @param {string} props.text - Text to copy
 * @param {string} [props.label] - Button label (default: "Copy")
 * @param {string} [props.copiedLabel] - Label after copy (default: "Copied!")
 * @param {number} [props.resetDelay] - ms before resetting to default label (default: 2000)
 * @param {string} [props.className] - Extra classes
 */
export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  resetDelay = 2000,
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelay);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 transition-colors ${className}`}
    >
      {copied ? (
        <>
          <Check size={12} className="text-success" />
          <span className="text-success text-xs font-semibold">{copiedLabel}</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span className="text-xs font-semibold">{label}</span>
        </>
      )}
    </button>
  );
}
