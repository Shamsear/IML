import psycopg2
import openpyxl
from collections import defaultdict

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# 1. Read Excel DATA sheet
wb = openpyxl.load_workbook(r'D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx', data_only=True, read_only=True)
ws = wb['DATA']

excel_totals = defaultdict(float)
excel_count = 0
for idx, r in enumerate(ws.iter_rows(values_only=True)):
    if idx == 0: continue
    if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
        excel_count += 1
        excel_totals['Purchased'] += float(r[2] or 0)
        excel_totals['Warehouse'] += float(r[3] or 0)
        excel_totals['Issued'] += float(r[4] or 0)
        excel_totals['Used'] += float(r[5] or 0)
        excel_totals['Damage'] += float(r[6] or 0)
        excel_totals['Lost'] += float(r[7] or 0)
        excel_totals['With Client'] += float(r[8] or 0)
        excel_totals['Rebrand'] += float(r[10] or 0)

wb.close()

# 2. Query DB
cur.execute("""
    SELECT t."productId", t."transactionType", t."fromEntityType", t."toEntityType", t.quantity, t.timestamp
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    JOIN "Brand" b ON p."brandId" = b.id
    WHERE b.name ILIKE '%SADIA%';
""")
all_txs = cur.fetchall()

def compute_totals(tx_list):
    by_p = defaultdict(lambda: defaultdict(float))
    for pid, ttype, frm, to, qty, ts in tx_list:
        ttype = (ttype or '').upper()
        frm = (frm or '').upper()
        to = (to or '').upper()
        qty = float(qty or 0)
        
        if ttype in ['PURCHASE', 'RECEIVE', 'REC', 'INITIAL', 'INITIAL_STOCK', 'REBRAND_IN']:
            by_p[pid]['p'] += qty
        elif ttype in ['REBRAND', 'REBRAND_OUT']:
            by_p[pid]['rb'] += qty
        elif ttype == 'USED':
            by_p[pid]['u'] += qty
        elif ttype in ['ISSUE', 'OUT'] and to in ['STORE', None, '']:
            by_p[pid]['i'] += qty
        elif ttype in ['DAMAGE', 'DAM']:
            by_p[pid]['d'] += qty
        elif ttype in ['LOST', 'LST']:
            by_p[pid]['l'] += qty
        elif ttype == 'CLIENT_STOCK' or (ttype in ['ISSUE', 'OUT'] and to in ['CLIENT', 'BRAND']):
            by_p[pid]['c'] += qty
        elif ttype == 'CLIENT_RETURN':
            by_p[pid]['c'] -= qty
        elif ttype in ['RETURN', 'RET'] and to in ['WAREHOUSE', None, '']:
            by_p[pid]['ret'] += qty
            
    tot = defaultdict(float)
    for pid, vals in by_p.items():
        wh = vals['p'] - vals['i'] - vals['u'] - vals['d'] - vals['l'] - vals['rb'] - vals['c'] + vals['ret']
        tot['Purchased'] += vals['p']
        tot['Warehouse'] += wh
        tot['Issued'] += vals['i']
        tot['Used'] += vals['u']
        tot['Damage'] += vals['d']
        tot['Lost'] += vals['l']
        tot['With Client'] += vals['c']
        tot['Rebrand'] += vals['rb']
    return tot

baseline_txs = [t for t in all_txs if str(t[5]) < '2026-10-03 00:00:00']

base = compute_totals(baseline_txs)
live = compute_totals(all_txs)

print(f"Total Products in Excel DATA: {excel_count}")
print("\n" + "="*80)
print(f"{'METRIC':<20} | {'EXCEL SHEET TOTAL':<20} | {'DB BASELINE (EXCL. YESTERDAY)':<30} | {'MATCH STATUS'}")
print("="*80)

for metric in ['Purchased', 'Warehouse', 'Issued', 'Used', 'Damage', 'Lost', 'With Client', 'Rebrand']:
    ex_v = excel_totals[metric]
    db_v = base[metric]
    diff = db_v - ex_v
    status = "EXACT MATCH (100%)" if abs(diff) < 0.001 else f"DIFF: {diff:+,.2f}"
    print(f"{metric:<20} | {ex_v:>18,.2f} | {db_v:>28,.2f} | {status}")

print("="*80)
print("\n=== LIVE SYSTEM TOTALS (INCLUDING YESTERDAY'S 13 LIVE RETURN UNITS) ===")
for metric in ['Purchased', 'Warehouse', 'Issued', 'Used', 'Damage', 'Lost', 'With Client', 'Rebrand']:
    live_v = live[metric]
    print(f"{metric:<20}: {live_v:>15,.2f}")
