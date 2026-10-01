'use client';

/**
 * Tab navigation bar with URL sync.
 * Both variants are horizontally scrollable on small screens.
 *
 * @param {Object} props
 * @param {string} props.activeTab - Currently active tab key
 * @param {Function} props.onTabChange - Called with new tab key
 * @param {Array<{ key: string, label: string, icon?: React.ReactNode }>} props.tabs - Tab definitions
 * @param {string} [props.variant] - 'underline' (default) or 'pill'
 * @param {string} [props.className] - Extra classes on the outer scroll wrapper
 */
export default function TabNav({
  activeTab,
  onTabChange,
  tabs,
  variant = 'underline',
  className = '',
}) {
  if (variant === 'pill') {
    return (
      <div className={`w-full overflow-x-auto ${className}`}>
        <div className="flex gap-1 bg-surface-elevated/30 border border-border rounded-xl p-1 w-max min-w-full sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default: underline variant
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <div className="flex items-center gap-0 border-b border-border w-max min-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            }`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
