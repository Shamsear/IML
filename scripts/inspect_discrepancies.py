import sys
import psycopg2
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

sample_skus = ['PROD-SAD-096', 'PROD-SAD-099', 'PROD-SAD-097', 'PROD-SAD-101', 'PROD-SAD-111', 'PROD-SAD-113', 'PROD-SAD-107', 'PROD-SAD-104', 'PROD-SAD-098']

print('=== DB TRANSACTIONS FOR SAMPLE ITEMS ===')
for sku in sample_skus:
    cur.execute("""
        SELECT t.id, t."transactionType", t.quantity, t."fromEntityType", t."toEntityType", t.timestamp, t.notes
        FROM "InventoryTransaction" t
        JOIN "Product" p ON t."productId" = p.id
        WHERE p."itemCode" = %s
        ORDER BY t.timestamp;
    """, (sku,))
    txs = cur.fetchall()
    print(f"\n-- SKU: {sku} ({len(txs)} txs) --")
    for tx in txs:
        print(f"   {tx[0]} | Type: {tx[1]:<12} | Qty: {tx[2]:8.1f} | From: {tx[3]} -> To: {tx[4]} | Date: {tx[5]} | Notes: {tx[6]}")

conn.close()

print('\n=== EXCEL OG(3) DATA ROW FOR THESE ITEMS ===')
wb = openpyxl.load_workbook(r"D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx", data_only=True, read_only=True)
sh = wb['DATA']
rows_iter = sh.iter_rows(values_only=True)
header = [cell for cell in next(rows_iter)]
print('Header:', header)
for r in rows_iter:
    name = str(r[0]).strip() if r[0] else ''
    for sku_match in ['Aluminium container', 'Sun Flower Oil', 'Cup cakes', 'Dishwashing Liquid', 'Giveaway Bags', 'Key chain', 'Sadia Trays', 'Superson Cooking']:
        if sku_match.lower() in name.lower():
            print(f"\n-- {name} --")
            for col_name, val in zip(header, r):
                if val is not None and val != 0 and val != '0' and str(val).strip() != '':
                    print(f"   {col_name}: {val}")
wb.close()
