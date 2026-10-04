import sys
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Check all REBRAND, REBRAND_OUT, REBRAND_IN transactions
cur.execute("""
    SELECT "transactionType", COUNT(*), SUM(quantity)
    FROM "InventoryTransaction"
    GROUP BY "transactionType";
""")
print("=== TRANSACTION TYPE COUNTS ===")
for r in cur.fetchall():
    print(f"  {r[0]:<15}: Count = {r[1]:<5} | Sum Qty = {r[2]}")

cur.execute("""
    SELECT DISTINCT "toEntityType", "toEntityId"
    FROM "InventoryTransaction"
    WHERE "transactionType" LIKE 'REBRAND%';
""")
print("\n=== REBRAND TO ENTITIES ===")
for r in cur.fetchall():
    print(f"  toEntityType: {r[0]}, toEntityId: {r[1]}")

conn.close()
