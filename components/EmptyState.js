import Link from 'next/link';

/**
 * Standardized empty state component.
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Lucide icon component
 * @param {string} props.title - Main headline
 * @param {string} props.description - Supporting text
 * @param {string} [props.actionLabel] - CTA button text
 * @param {string} [props.actionHref] - CTA button link
 * @param {Function} [props.onAction] - CTA button onClick (if no href)
 * @param {string} [props.iconColor] - Tailwind color class for icon (default: text-primary)
 */
export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  actionHref, 
  onAction,
  iconColor = 'text-primary' 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className={`w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center border border-border mb-4 ${iconColor}`}>
        <Icon size={24} />
      </div>
      <h3 className="font-display font-bold text-base text-text-primary mb-1">
        {title}
      </h3>
      <p className="text-sm text-text-secondary max-w-sm leading-relaxed mb-5">
        {description}
      </p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
