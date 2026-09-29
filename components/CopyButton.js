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
import { Morph } from 'cube-motion/react';

export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  resetDelay = 2000,
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e?.stopPropagation();
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
      <Morph
        active={copied}
        off={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary">
            <Copy size={12} className="stroke-[1.75]" />
            <span>{label}</span>
          </span>
        }
        on={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
            <Check size={12} className="stroke-[2.25]" />
            <span>{copiedLabel}</span>
          </span>
        }
      />
    </button>
  );
}
