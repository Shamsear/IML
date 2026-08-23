'use client';

import { Package } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';

/**
 * Standardized product/brand image with fallback to placeholder icon.
 * Replaces the duplicated <img> + onError + getOptimizedImageUrl pattern.
 *
 * @param {Object} props
 * @param {string|null} props.src - Image URL (from ImageKit or direct)
 * @param {string} props.alt - Alt text
 * @param {string} [props.size] - Preset: 'xs' (32px), 'sm' (40px), 'md' (48px), 'lg' (64px)
 * @param {string} [props.className] - Extra classes
 * @param {Function} [props.onClick] - Click handler (e.g. for lightbox)
 * @param {boolean} [props.showPlaceholder] - Show placeholder icon when no src (default: true)
 */
export default function ProductImage({
  src,
  alt = '',
  size = 'sm',
  className = '',
  onClick,
  showPlaceholder = true,
}) {
  const sizes = {
    xs: 'w-8 h-8',
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = { xs: 13, sm: 15, md: 18, lg: 24 };

  if (!src && showPlaceholder) {
    return (
      <div className={`${sizes[size]} rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}>
        <Package size={iconSizes[size]} />
      </div>
    );
  }

  if (!src) return null;

  return (
    <img
      src={getOptimizedImageUrl(src, 80, 80)}
      alt={alt}
      className={`${sizes[size]} rounded-2xl object-cover border border-border flex-shrink-0 ${onClick ? 'cursor-zoom-in hover:brightness-95' : ''} transition-all duration-200 ${className}`}
      onClick={onClick}
      onError={(e) => {
        if (e.target.src !== src) {
          e.target.src = src;
        }
      }}
    />
  );
}
