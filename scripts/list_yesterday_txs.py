import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT 
        t.id, 
        t."deliveryNote", 
        t."transactionType", 
        t.quantity, 
        t."fromEntityType", 
        t."toEntityType", 
        t.timestamp,
        p."itemCode",
        p.name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t.timestamp >= '2026-10-03 00:00:00'
    ORDER BY t.timestamp DESC;
""")
recent_txs = cur.fetchall()
print(f"Total transactions done yesterday / recently (>= 2026-10-03): {len(recent_txs)}")
for tx in recent_txs:
    print(f"  {tx[0]} | DN: {tx[1]} | Type: {tx[2]:<8} | Qty: {tx[3]:4.1f} | From: {tx[4]} -> To: {tx[5]} | Date: {tx[6]} | Item: [{tx[7]}] {tx[8]}")

conn.close()
