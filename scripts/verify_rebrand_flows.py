import psycopg2
import openpyxl
from collections import defaultdict

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

sadia_path = r"D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx"
wb = openpyxl.load_workbook(sadia_path, data_only=True, read_only=True)
sh = wb['DATA']
excel_data = {}
for idx, r in enumerate(sh.iter_rows(values_only=True)):
    if idx == 0: continue
    if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
        name = str(r[0]).strip()
        excel_data[name] = {
            'purchased': float(r[2] or 0),
            'warehouse': float(r[3] or 0),
            'issued': float(r[4] or 0),
            'used': float(r[5] or 0),
            'damage': float(r[6] or 0),
            'lost': float(r[7] or 0),
            'with_client': float(r[8] or 0),
            'rebrand': float(r[10] or 0),
            'total': float(r[11] or 0)
        }
wb.close()

# Query rebrand flows
cur.execute("""
    SELECT 
        t.id,
        t."deliveryNote",
        t.timestamp,
        p."itemCode" as from_sku,
        p.name as from_name,
        t.quantity,
        t.notes
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" = 'REBRAND'
    ORDER BY t.timestamp, t."deliveryNote";
""")
rebrands = cur.fetchall()

print(f"Total Rebrand Transactions in DB: {len(rebrands)}")

rebrand_flows = []
for r in rebrands:
    tid, dn, ts, from_sku, from_name, qty, notes = r
    # extract target product
    target_name = "Pending / No Target"
    if notes and "Rebrand output ->" in notes:
        target_name = notes.split("Rebrand output ->")[1].split(".")[0].strip()
    elif notes and "rebranded on" in notes:
        target_name = notes.split("rebranded on")[1].split(".")[0].strip()
    
    rebrand_flows.append({
        'tid': tid,
        'dn': dn,
        'date': ts,
        'from_sku': from_sku,
        'from_name': from_name,
        'qty': qty,
        'target_name': target_name
    })

# Group by Target Product to show how much rebrand was added to target's purchase
added_to_target = defaultdict(float)
for f in rebrand_flows:
    if f['target_name'] != "Pending / No Target":
        added_to_target[f['target_name']] += f['qty']

print("\n=== REBRAND SUMMARY BY DESTINATION PRODUCT (ADDED TO TARGET PURCHASES) ===")
for target_name, total_added in sorted(added_to_target.items()):
    ex = excel_data.get(target_name, {})
    ex_pur = ex.get('purchased', 0.0)
    print(f"Target: {target_name}")
    print(f"  Total Rebranded In: {total_added:4.0f} pcs | Target Excel Total Purchased: {ex_pur:4.0f} pcs")

conn.close()
