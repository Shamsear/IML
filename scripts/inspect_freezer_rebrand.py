import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT 
        t.id,
        t."deliveryNote",
        t."transactionType",
        t."deliveryStatus",
        t."returnStatus",
        t."returnedQty",
        t."fromEntityType",
        t."toEntityType",
        t."toEntityId",
        t.quantity,
        t.timestamp,
        t.notes,
        p."itemCode",
        p.name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."deliveryNote" IN ('RBD-SAD-250826-001', 'RBD-SAD-250826-002')
    ORDER BY t."deliveryNote", p.name;
""")
for r in cur.fetchall():
    print(r)

conn.close()
