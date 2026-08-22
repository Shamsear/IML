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
      <div className={`grid grid-cols-3 gap-2 text-center text-[10px] pt-2 border-t border-border/50 ${className}`}>
        <div>
          <span className="text-text-muted block">Warehouse</span>
          <span className="font-mono font-bold text-sm">{stock.warehouse}</span>
        </div>
        <div>
          <span className="text-text-muted block">Issued</span>
          <span className="font-mono font-bold text-sm">{stock.issued}</span>
        </div>
        <div>
          <span className="text-text-muted block">Used</span>
          <span className="font-mono font-bold text-sm">{stock.used}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 text-center text-[10px] ${className}`}>
      <div>
        <span className="text-text-muted block">Warehouse</span>
        <span className="font-mono font-bold text-sm">{stock.warehouse}</span>
      </div>
      <div>
        <span className="text-text-muted block">Issued</span>
        <span className="font-mono font-bold text-sm">{stock.issued}</span>
      </div>
      <div>
        <span className="text-text-muted block">Used</span>
        <span className="font-mono font-bold text-sm">{stock.used}</span>
      </div>
      {(stock.damage > 0 || stock.lost > 0 || stock.withClient > 0) && (
        <>
          {stock.damage > 0 && (
            <div>
              <span className="text-text-muted block">Damage</span>
              <span className="font-mono font-bold text-sm text-danger">{stock.damage}</span>
            </div>
          )}
          {stock.lost > 0 && (
            <div>
              <span className="text-text-muted block">Lost</span>
              <span className="font-mono font-bold text-sm text-danger">{stock.lost}</span>
            </div>
          )}
          {stock.withClient > 0 && (
            <div>
              <span className="text-text-muted block">Client</span>
              <span className="font-mono font-bold text-sm text-primary">{stock.withClient}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
