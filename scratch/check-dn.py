import psycopg2
from dotenv import dotenv_values

env = dotenv_values('.env')
db_url = env.get('DATABASE_URL')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT id, "transactionType", "fromEntityType", "fromEntityId", "toEntityType", "toEntityId", quantity, "deliveryNote", timestamp 
    FROM "InventoryTransaction" 
    WHERE "deliveryNote" ILIKE '%RET-SAD-061026-024%'
""")
rows = cur.fetchall()
print("Found rows count:", len(rows))
for r in rows:
    print(r)

if not rows:
    cur.execute("""
        SELECT "deliveryNote", count(*) 
        FROM "InventoryTransaction" 
        WHERE "deliveryNote" ILIKE '%061026%' OR "deliveryNote" ILIKE '%RET%' 
        GROUP BY "deliveryNote" 
        ORDER BY count(*) DESC 
        LIMIT 20
    """)
    print("\nSimilar delivery notes:")
    for r in cur.fetchall():
        print(r)

conn.close()
