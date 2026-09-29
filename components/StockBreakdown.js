'use client';

/**
 * Standardized stock breakdown display — shows warehouse, issued, used,
 * damage, lost, and client stock in a compact grid.
 *
 * @param {Object} props
 * @param {Object} props.stock - Stock object { warehouse, issued, used, damage, lost, withClient, reBrand, total }
 * @param {boolean} [props.compact] - Show in compact mode (fewer details)
 * @param {string} [props.className] - Extra classes
 */
export default function StockBreakdown({ stock, compact = false, className = '' }) {
  if (!stock) return null;

  if (compact) {
    return (
      <div className={`grid grid-cols-3 gap-2 text-center text-[10px] pt-2.5 border-t border-border/60 ${className}`}>
        <div className="bg-surface-elevated/40 rounded-lg py-1 px-1.5 border border-border/40">
          <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Warehouse</span>
          <span className="font-mono font-bold text-xs text-text-primary tabular-nums">{stock.warehouse}</span>
        </div>
        <div className="bg-surface-elevated/40 rounded-lg py-1 px-1.5 border border-border/40">
          <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Issued</span>
          <span className="font-mono font-bold text-xs text-text-primary tabular-nums">{stock.issued}</span>
        </div>
        <div className="bg-surface-elevated/40 rounded-lg py-1 px-1.5 border border-border/40">
          <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Used</span>
          <span className="font-mono font-bold text-xs text-text-primary tabular-nums">{stock.used}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 text-center text-[10px] ${className}`}>
      <div className="bg-surface-elevated/40 rounded-lg py-1.5 px-2 border border-border/40">
        <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Warehouse</span>
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">{stock.warehouse}</span>
      </div>
      <div className="bg-surface-elevated/40 rounded-lg py-1.5 px-2 border border-border/40">
        <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Issued</span>
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">{stock.issued}</span>
      </div>
      <div className="bg-surface-elevated/40 rounded-lg py-1.5 px-2 border border-border/40">
        <span className="text-text-muted text-[9px] uppercase font-bold tracking-wider block">Used</span>
        <span className="font-mono font-bold text-sm text-text-primary tabular-nums">{stock.used}</span>
      </div>
      {(stock.damage > 0 || stock.lost > 0 || stock.withClient > 0) && (
        <>
          {stock.damage > 0 && (
            <div className="bg-danger/10 rounded-lg py-1.5 px-2 border border-danger/20">
              <span className="text-danger/80 text-[9px] uppercase font-bold tracking-wider block">Damage</span>
              <span className="font-mono font-bold text-sm text-danger tabular-nums">{stock.damage}</span>
            </div>
          )}
          {stock.lost > 0 && (
            <div className="bg-danger/10 rounded-lg py-1.5 px-2 border border-danger/20">
              <span className="text-danger/80 text-[9px] uppercase font-bold tracking-wider block">Lost</span>
              <span className="font-mono font-bold text-sm text-danger tabular-nums">{stock.lost}</span>
            </div>
          )}
          {stock.withClient > 0 && (
            <div className="bg-primary/10 rounded-lg py-1.5 px-2 border border-primary/20">
              <span className="text-primary/80 text-[9px] uppercase font-bold tracking-wider block">Client</span>
              <span className="font-mono font-bold text-sm text-primary tabular-nums">{stock.withClient}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
