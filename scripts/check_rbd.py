import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT t.id, t."deliveryNote", t."transactionType", t."fromEntityType", t."fromEntityId", t."toEntityType", t."toEntityId", t."notes", s.name as store_name
    FROM "InventoryTransaction" t
    LEFT JOIN "Store" s ON t."toEntityId" = s.id
    WHERE t."deliveryNote" = 'RBD-SAD-250826-001' OR t.id = 'RBD-SAD-250826-001';
""")
for r in cur.fetchall():
    print(r)
