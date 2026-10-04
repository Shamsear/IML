import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT 
        t."deliveryNote",
        t.timestamp,
        t."returnStatus",
        COUNT(*) as items_count,
        SUM(t.quantity) as total_qty,
        SUM(COALESCE(t."returnedQty", 0)) as returned_qty,
        STRING_AGG(p.name || ' (' || COALESCE(t."returnStatus", 'PENDING') || ')', ', ') as items
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" = 'REBRAND'
    GROUP BY t."deliveryNote", t.timestamp, t."returnStatus"
    ORDER BY t.timestamp DESC;
""")
print("=== REBRAND GATE PASSES BY STATUS ===")
for r in cur.fetchall():
    dn, ts, status, cnt, qty, ret_qty, items = r
    print(f"DN: {dn} | Date: {ts} | Status: {status} | Qty: {qty} | Ret: {ret_qty} | Items: {items}")

conn.close()
