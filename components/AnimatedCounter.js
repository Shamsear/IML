'use client';

import { useState, useEffect } from 'react';
import NumberFlow from '@number-flow/react';

export default function AnimatedCounter({ value, className = '', format }) {
  const target = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Start smooth roll-up from 0 on initial page load / mount
    const timer = setTimeout(() => {
      setDisplayValue(target);
    }, 50);
    return () => clearTimeout(timer);
  }, [target]);

  return (
    <span className={`tabular-nums font-mono inline-block ${className}`}>
      <NumberFlow
        value={displayValue}
        format={format}
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
