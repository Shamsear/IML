'use client';

/**
 * Standardized page header with title, description, optional icon watermark, and action buttons.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Lucide icon component for the watermark
 * @param {string} props.title - Page title
 * @param {string} props.description - Subtitle / description text
 * @param {React.ReactNode} props.actions - Action buttons (right side)
 * @param {string} [props.className] - Extra classes on the outer wrapper
 */
export default function PageHeader({ icon: Icon, title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-col gap-6 relative ${className}`}>
      {Icon && (
        <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden print:hidden">
          <Icon size={250} />
        </div>
      )}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border print:border-b-2 print:border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight print:text-xl print:font-black">
            {title}
          </h1>
          {description && (
            <p className="text-text-secondary text-sm mt-1 print:text-xs">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 print:hidden">
            {actions}
          </div>
        )}
      </header>
    </div>
  );
}
