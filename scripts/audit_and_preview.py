import psycopg2
import openpyxl
import os
from datetime import datetime, timezone
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("================================================================================")
print("1. DATABASE TRANSACTION TYPES & DELIVERY STATUSES SUMMARY")
print("================================================================================")
cur.execute("""
    SELECT "transactionType", "deliveryStatus", "toEntityType", "fromEntityType", COUNT(*), SUM(quantity) 
    FROM "InventoryTransaction" 
    GROUP BY "transactionType", "deliveryStatus", "toEntityType", "fromEntityType"
    ORDER BY "transactionType", "deliveryStatus";
""")
for r in cur.fetchall():
    print(f"Type: {r[0]:<15} | Status: {str(r[1]):<12} | To: {str(r[2]):<12} | From: {str(r[3]):<12} | Count: {r[4]:<5} | Qty: {r[5]}")

print("\n================================================================================")
print("2. ALL REBRAND TRANSACTIONS IN DATABASE")
print("================================================================================")
cur.execute("""
    SELECT 
        t.id, 
        t."productId", 
        p.name as prod_name,
        p."itemCode",
        t."transactionType", 
        t."deliveryNote", 
        t."deliveryStatus", 
        t."fromEntityType",
        t."fromEntityId",
        t."toEntityType", 
        t."toEntityId",
        t.quantity, 
        t.timestamp, 
        t.notes
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" LIKE 'REBRAND%' OR t."transactionType" = 'REBRAND'
    ORDER BY t.timestamp DESC, t."deliveryNote";
""")
rebrand_rows = cur.fetchall()
print(f"Total Rebrand Transactions Found: {len(rebrand_rows)}")
for r in rebrand_rows:
    print(f"ID: {r[0]} | DN: {r[5]} | Type: {r[4]} | Status: {r[6]} | From: {r[7]} ({r[8]}) -> To: {r[9]} ({r[10]}) | Qty: {r[11]} | Prod: [{r[3]}] {r[2]} | Date: {r[12]} | Notes: {r[13]}")

print("\n================================================================================")
print("3. TRANSACTIONS PERFORMED YESTERDAY (OR RECENTLY - OCT 3 ONWARD)")
print("================================================================================")
cur.execute("""
    SELECT 
        t.id, 
        t."transactionType", 
        p.name, 
        t.quantity, 
        t."deliveryNote", 
        t."deliveryStatus", 
        t.timestamp,
        t."fromEntityType",
        t."toEntityType"
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t.timestamp >= '2026-10-03 00:00:00'
    ORDER BY t.timestamp DESC;
""")
yesterday_txs = cur.fetchall()
print(f"Transactions done recently (Oct 3 onward): {len(yesterday_txs)}")
for r in yesterday_txs:
    print(f"ID: {r[0]} | Type: {r[1]:<12} | DN: {str(r[4]):<25} | Qty: {r[3]} | Status: {r[5]} | Prod: {r[2]} | Date: {r[6]}")

conn.close()
