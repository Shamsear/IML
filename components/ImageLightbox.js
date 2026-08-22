'use client';

import { X } from 'lucide-react';

/**
 * Full-screen image lightbox with backdrop blur.
 * Renders nothing when image is null.
 *
 * @param {Object} props
 * @param {{ url: string, name: string }|null} props.image - { url, name } or null to hide
 * @param {Function} props.onClose - Called when user clicks close, backdrop, or presses Escape
 */
export default function ImageLightbox({ image, onClose }) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-pointer select-none print:hidden"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={20} />
      </button>

      {/* Image + caption */}
      <div
        className="relative max-w-4xl max-h-[80vh] flex flex-col items-center gap-4 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.url}
          alt={image.name}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/15 animate-scale-up"
          onError={(e) => {
            if (e.target.src !== image.url) {
              e.target.src = image.url;
            }
          }}
        />
        {image.name && (
          <span className="text-white text-sm font-semibold tracking-wide text-center">
            {image.name}
          </span>
        )}
      </div>
    </div>
  );
}
