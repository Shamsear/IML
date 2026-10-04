import sys
import psycopg2
import openpyxl
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

def pnum(v):
    try:
        if v is None or v == '': return 0.0
        return float(str(v).replace(',', '').strip())
    except:
        return 0.0

# -------------------------------------------------------------------
# 1. READ EXCEL DATA SHEET
# -------------------------------------------------------------------
sadia_path = r"D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx"
wb = openpyxl.load_workbook(sadia_path, data_only=True, read_only=True)
sh = wb['DATA']

excel_items = {}
for idx, r in enumerate(sh.iter_rows(values_only=True)):
    if idx == 0: continue
    if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
        name = str(r[0]).strip()
        cat = str(r[1]).strip() if r[1] else ''
        excel_items[name] = {
            'row_num': idx + 1,
            'name': name,
            'category': cat,
            'purchased': pnum(r[2]),
            'warehouse': pnum(r[3]),
            'issued': pnum(r[4]),
            'used': pnum(r[5]),
            'damage': pnum(r[6]),
            'lost': pnum(r[7]),
            'with_client': pnum(r[8]),
            'discard': pnum(r[9]),
            'rebrand': pnum(r[10]),
            'total': pnum(r[11])
        }
wb.close()
print(f"Loaded {len(excel_items)} items from Excel DATA sheet.")

# -------------------------------------------------------------------
# 2. QUERY DATABASE TRANSACTIONS
# -------------------------------------------------------------------
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get all products in Sadia
cur.execute("""
    SELECT p.id, p."itemCode", p.name, p.category
    FROM "Product" p
    JOIN "Brand" b ON p."brandId" = b.id
    WHERE b.name ILIKE '%SADIA%'
    ORDER BY p.name;
""")
db_products = cur.fetchall()
print(f"Loaded {len(db_products)} Sadia products from database.")

# Get all transactions for Sadia products
cur.execute("""
    SELECT 
        t."productId",
        t."transactionType",
        t."fromEntityType",
        t."toEntityType",
        t."returnStatus",
        t.quantity,
        t.timestamp
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    JOIN "Brand" b ON p."brandId" = b.id
    WHERE b.name ILIKE '%SADIA%';
""")
all_txs = cur.fetchall()

# Separate into Baseline (< 2026-10-03) and Live (All)
baseline_txs = defaultdict(list)
live_txs = defaultdict(list)

for r in all_txs:
    pid, ttype, frm, to, rstatus, qty, ts = r
    data = {
        'type': (ttype or '').upper(),
        'from': (frm or '').upper(),
        'to': (to or '').upper(),
        'status': rstatus,
        'qty': float(qty or 0),
        'ts': ts
    }
    live_txs[pid].append(data)
    if str(ts) < '2026-10-03 00:00:00':
        baseline_txs[pid].append(data)

def compute_product_metrics(tx_list):
    purchased = sum(t['qty'] for t in tx_list if t['type'] in ['RECEIVE', 'REC', 'INITIAL', 'INITIAL_STOCK', 'REBRAND_IN'])
    rebrand = sum(t['qty'] for t in tx_list if t['type'] in ['REBRAND', 'REBRAND_OUT'])
    used = sum(t['qty'] for t in tx_list if t['type'] == 'USED')
    issued = sum(t['qty'] for t in tx_list if t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['STORE', None, ''])
    damage = sum(t['qty'] for t in tx_list if t['type'] in ['DAMAGE', 'DAM'])
    lost = sum(t['qty'] for t in tx_list if t['type'] in ['LOST', 'LST'])
    with_client = sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_STOCK' or (t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['CLIENT', 'BRAND'])) - sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_RETURN')
    
    # Live returns back to warehouse
    returns_to_wh = sum(t['qty'] for t in tx_list if t['type'] in ['RETURN', 'RET'] and t['to'] in ['WAREHOUSE', None, ''])
    
    warehouse = max(0.0, purchased - issued - used - damage - lost - rebrand - with_client + returns_to_wh)

    return {
        'purchased': purchased,
        'warehouse': warehouse,
        'issued': issued,
        'used': used,
        'damage': damage,
        'lost': lost,
        'with_client': with_client,
        'discard': 0.0,
        'rebrand': rebrand,
        'total': warehouse
    }

print("\n================================================================================")
print("1. COMPREHENSIVE BASELINE COMPARISON (EXCLUDING YESTERDAY'S TRANSACTIONS)")
print("================================================================================")

baseline_matches = 0
baseline_discrepancies = []

for p in db_products:
    p_id, sku, name, cat = p
    clean_name = name
    if clean_name.lower().startswith('sadia - '):
        clean_name = clean_name[8:].strip()
    ex = excel_items.get(name) or excel_items.get(clean_name)
    
    if not ex:
        baseline_discrepancies.append({
            'sku': sku,
            'name': name,
            'cat': cat,
            'type': 'NOT_FOUND_IN_EXCEL',
            'diffs': {}
        })
        continue

    db_m = compute_product_metrics(baseline_txs[p_id])
    diffs = {}
    for metric in ['purchased', 'warehouse', 'issued', 'used', 'damage', 'lost', 'with_client', 'rebrand', 'total']:
        db_val = db_m.get(metric, 0.0)
        ex_val = ex.get(metric, 0.0)
        diff = db_val - ex_val
        if abs(diff) > 0.001:
            diffs[metric] = (db_val, ex_val, diff)

    if diffs:
        baseline_discrepancies.append({
            'sku': sku,
            'name': name,
            'cat': cat,
            'type': 'METRIC_DIFF',
            'db': db_m,
            'ex': ex,
            'diffs': diffs
        })
    else:
        baseline_matches += 1

print(f"Total Products Checked: {len(db_products)}")
print(f"Perfect Matches (100% across all metrics): {baseline_matches}")
print(f"Discrepancies: {len(baseline_discrepancies)}")

if baseline_discrepancies:
    for idx, d in enumerate(baseline_discrepancies, 1):
        print(f"\n{idx}. [{d['sku']}] {d['name']} (Cat: {d['cat']})")
        for m, (dv, ev, diff) in d['diffs'].items():
            print(f"     {m:<14}: DB={dv:10.1f} | Excel={ev:10.1f} | Difference={diff:+10.1f}")
else:
    print("\n>>> ALL 117 PRODUCTS MATCH 100.00% EXACTLY WITH THE EXCEL DATA SHEET! <<<")

print("\n================================================================================")
print("2. REBRAND CONVERSION AUDIT (REBRAND OUT FROM ORIGIN -> REBRAND IN ON TARGET)")
print("================================================================================")

# Check total rebrands in Excel vs DB
excel_total_rebrands = sum(item['rebrand'] for item in excel_items.values())

cur.execute("""
    SELECT 
        p."itemCode",
        p.name,
        SUM(t.quantity) as rebrand_out_qty
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" IN ('REBRAND', 'REBRAND_OUT')
    GROUP BY p."itemCode", p.name
    ORDER BY p.name;
""")
db_rebrand_out_prods = cur.fetchall()
db_total_rebrands_out = sum(r[2] for r in db_rebrand_out_prods)

print(f"Excel Total Rebranded Quantity: {excel_total_rebrands:.1f}")
print(f"Database Total Rebranded Out:    {db_total_rebrands_out:.1f}")
print(f"Difference:                      {db_total_rebrands_out - excel_total_rebrands:+.1f}")

print("\nPer-Product Rebrand Out Breakdown (Excel vs DB):")
for r in db_rebrand_out_prods:
    sku, name, db_reb = r
    clean_name = name
    if clean_name.lower().startswith('sadia - '):
        clean_name = clean_name[8:].strip()
    ex = excel_items.get(name) or excel_items.get(clean_name) or {}
    ex_reb = ex.get('rebrand', 0.0)
    match_str = "MATCH" if abs(db_reb - ex_reb) < 0.001 else f"MISMATCH (Diff: {db_reb - ex_reb:+.1f})"
    print(f"  [{sku}] {name:<60} | DB Rebrand: {db_reb:4.0f} | Excel Rebrand: {ex_reb:4.0f} | {match_str}")

conn.close()
