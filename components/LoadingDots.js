'use client';

/**
 * Reusable loading spinner with optional title and description.
 * Replaces the duplicated inline loading spinners across 50+ loading.js files.
 *
 * @param {Object} props
 * @param {string} [props.title] - Loading message headline
 * @param {string} [props.description] - Supporting text below the spinner
 * @param {string} [props.color] - Tailwind color class (default: "bg-primary")
 * @param {string} [props.className] - Extra wrapper classes
 */
export default function LoadingDots({
  title,
  description,
  color = 'bg-primary',
  className = '',
}) {
  return (
    <div className={`w-full min-h-[40vh] flex items-center justify-center p-6 ${className}`}>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_infinite]`} />
          <span className={`w-2 h-2 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_0.2s_infinite]`} />
          <span className={`w-2 h-2 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_0.4s_infinite]`} />
        </div>
        {(title || description) && (
          <div className="flex flex-col gap-1">
            {title && (
              <h3 className="font-display font-bold text-sm text-text-primary tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-text-secondary">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
