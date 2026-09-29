'use client';

/**
 * Standardized loading state with smooth pulse physics and consistent branding.
 *
 * @param {Object} props
 * @param {string} [props.title] - Optional loading message headline
 * @param {string} [props.description] - Optional supporting text below the spinner
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
    <div className={`w-full min-h-[55vh] flex items-center justify-center p-6 ${className}`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_infinite]`} />
          <span className={`w-2.5 h-2.5 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_0.2s_infinite]`} />
          <span className={`w-2.5 h-2.5 rounded-full ${color} animate-[pulse_1.4s_ease-in-out_0.4s_infinite]`} />
        </div>
        {(title || description) && (
          <div className="flex flex-col gap-1 max-w-sm">
            {title && (
              <h3 className="font-display font-bold text-sm text-text-primary tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-text-secondary leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
