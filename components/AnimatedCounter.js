'use client';

import NumberFlow from '@number-flow/react';

export default function AnimatedCounter({ value, className = '', format }) {
  return (
    <span className={`tabular-nums font-mono ${className}`}>
      <NumberFlow
        value={Number(value) || 0}
        format={format}
        animated={true}
      />
    </span>
  );
}
