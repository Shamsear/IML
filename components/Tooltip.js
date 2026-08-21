'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export default function Tooltip({ children, content, side = 'top', className = '' }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    
    if (!tooltipEl) return;
    const tipRect = tooltipEl.getBoundingClientRect();
    
    let x, y;
    
    if (side === 'top') {
      x = rect.left + rect.width / 2 - tipRect.width / 2;
      y = rect.top - tipRect.height - 6;
    } else if (side === 'bottom') {
      x = rect.left + rect.width / 2 - tipRect.width / 2;
      y = rect.bottom + 6;
    } else if (side === 'left') {
      x = rect.left - tipRect.width - 6;
      y = rect.top + rect.height / 2 - tipRect.height / 2;
    } else if (side === 'right') {
      x = rect.right + 6;
      y = rect.top + rect.height / 2 - tipRect.height / 2;
    }

    // Keep within viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tipRect.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tipRect.height - 8));

    setPos({ x, y });
  }, [side]);

  useEffect(() => {
    if (visible) {
      // Small delay to let tooltip render and measure
      requestAnimationFrame(updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [visible, updatePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`has-tooltip ${className}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible && (
        <span
          ref={tooltipRef}
          className="tooltip-box tooltip-pos"
          role="tooltip"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            animation: 'none',
            opacity: 1,
          }}
        >
          {content}
        </span>
      )}
    </>
  );
}
