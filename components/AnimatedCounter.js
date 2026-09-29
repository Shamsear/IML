'use client';

import { useState, useEffect } from 'react';
import NumberFlow from '@number-flow/react';

export default function AnimatedCounter({ value, className = '', format }) {
  const rawNum = typeof value === 'number' ? value : parseFloat(value) || 0;
  // Clean floating point artifacts (e.g. 0.00000001 or .875)
  const target = Number.isInteger(rawNum) ? rawNum : Math.round((rawNum + Number.EPSILON) * 100) / 100;
  const [displayValue, setDisplayValue] = useState(target);

  useEffect(() => {
    setDisplayValue(target);
  }, [target]);

  const defaultFormat = format || {
    maximumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger'
  };

  return (
    <span className={`tabular-nums font-mono inline-block ${className}`}>
      <NumberFlow
        value={displayValue}
        format={defaultFormat}
        animated={true}
        willChange={true}
        transformTiming={{
          duration: 700,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        spinTiming={{
          duration: 700,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
    </span>
  );
}
