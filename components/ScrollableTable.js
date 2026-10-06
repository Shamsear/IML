'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * ScrollableTable
 * 
 * Enhances wide desktop data tables for mouse users:
 * 1. Automatically detects horizontal overflow (ResizeObserver + MutationObserver).
 * 2. Displays floating Left / Right scroll arrow buttons with single-click and press-and-hold scrolling.
 * 3. Shows subtle edge gradient shadows indicating hidden columns.
 * 4. Applies modern, sleek custom scrollbar styling.
 */
export default function ScrollableTable({
  children,
  className = '',
  containerClassName = '',
  scrollAmount,
}) {
  const scrollRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const overflow = maxScroll > 2;

    setHasOverflow(overflow);
    setCanScrollLeft(overflow && scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener('scroll', checkScroll, { passive: true });

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => checkScroll());
      resizeObserver.observe(el);
    }

    let mutationObserver = null;
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => checkScroll());
      mutationObserver.observe(el, { childList: true, subtree: true });
    }

    const handleWindowResize = () => checkScroll();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [checkScroll]);

  const stepScroll = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = scrollAmount || Math.max(el.clientWidth * 0.5, 260);
    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, [scrollAmount]);

  const stopContinuousScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const startContinuousScroll = useCallback((direction) => {
    stepScroll(direction);

    stopContinuousScroll();

    // After 250ms hold, scroll continuously
    scrollTimeoutRef.current = setTimeout(() => {
      scrollIntervalRef.current = setInterval(() => {
        const el = scrollRef.current;
        if (!el) return;
        const step = direction === 'left' ? -16 : 16;
        el.scrollLeft += step;
      }, 16);
    }, 250);

    const onMouseUp = () => {
      stopContinuousScroll();
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mouseup', onMouseUp, { once: true });
  }, [stepScroll, stopContinuousScroll]);

  return (
    <div className={`relative group/scrollable ${containerClassName}`}>
      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className={`overflow-x-auto table-scrollbar ${className}`}
      >
        {children}
      </div>

      {/* Left Edge Indicator & Scroll Button */}
      {hasOverflow && (
        <>
          <div
            className={`pointer-events-none absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-surface via-surface/60 to-transparent z-20 transition-opacity duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-30 transition-all duration-200 has-tooltip ${
              canScrollLeft
                ? 'opacity-85 group-hover/scrollable:opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-90 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onMouseDown={() => startContinuousScroll('left')}
              onMouseLeave={stopContinuousScroll}
              className="w-8 h-8 rounded-full bg-surface/95 border border-border shadow-md hover:shadow-lg hover:bg-primary hover:text-white hover:border-primary text-text-primary flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Scroll table left"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="tooltip-box">Scroll left (Hold Shift + Wheel)</span>
          </div>
        </>
      )}

      {/* Right Edge Indicator & Scroll Button */}
      {hasOverflow && (
        <>
          <div
            className={`pointer-events-none absolute top-0 bottom-0 right-0 w-14 bg-gradient-to-l from-surface via-surface/60 to-transparent z-20 transition-opacity duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-30 transition-all duration-200 has-tooltip ${
              canScrollRight
                ? 'opacity-85 group-hover/scrollable:opacity-100 scale-100 pointer-events-auto'
                : 'opacity-0 scale-90 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onMouseDown={() => startContinuousScroll('right')}
              onMouseLeave={stopContinuousScroll}
              className="w-8 h-8 rounded-full bg-surface/95 border border-border shadow-md hover:shadow-lg hover:bg-primary hover:text-white hover:border-primary text-text-primary flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-90 focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label="Scroll table right"
            >
              <ChevronRight size={16} />
            </button>
            <span className="tooltip-box">Scroll right (Hold Shift + Wheel)</span>
          </div>
        </>
      )}
    </div>
  );
}
