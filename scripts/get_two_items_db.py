import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

for name in ['Geepas Deep Fryer', 'Napkin Holder']:
    print(f"\n=== DB TRANSACTIONS: {name} ===")
    cur.execute("""
        SELECT t.id, t."transactionType", t.quantity, t."fromEntityType", t."fromEntityId", t."toEntityType", t."toEntityId", t.timestamp, t.notes
        FROM "InventoryTransaction" t
        JOIN "Product" p ON t."productId" = p.id
        WHERE p.name = %s AND t.timestamp < '2026-10-03 00:00:00'
        ORDER BY t.timestamp;
    """, (name,))
    for r in cur.fetchall():
        print(f"  {r[0]} | Type: {r[1]:<12} | Qty: {r[2]:5.1f} | From: {r[3]}:{r[4]} -> To: {r[5]}:{r[6]} | Date: {r[7]} | Notes: {r[8]}")

conn.close()
