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
# 1. READ EXCEL SHEETS
# -------------------------------------------------------------------
sadia_path = r"D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx"
sopexa_path = r"D:\inventory\documents\Sopexa inventory - Master - 26-01-2026.xlsx"
virgin_path = r"D:\inventory\documents\VIRGIN STOCK INVENTORY-2026.xlsx"

# 1.1 SADIA DATA SHEET (og (3))
sadia_excel = {}
try:
    wb = openpyxl.load_workbook(sadia_path, data_only=True, read_only=True)
    sh = wb['DATA']
    for idx, r in enumerate(sh.iter_rows(values_only=True)):
        if idx == 0: continue
        if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
            name = str(r[0]).strip()
            cat = str(r[1]).strip() if r[1] else ''
            sadia_excel[name] = {
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
except Exception as e:
    print(f"Error reading Sadia Excel: {e}")

# 1.2 SOPEXA DATA SHEET
sopexa_excel = {}
try:
    wb = openpyxl.load_workbook(sopexa_path, data_only=True, read_only=True)
    sh = wb['INVENTORY']
    for idx, r in enumerate(sh.iter_rows(values_only=True)):
        if idx < 4: continue
        if r[1] and str(r[1]).strip() and not str(r[1]).strip().upper().startswith('TOTAL'):
            name = str(r[1]).strip()
            sopexa_excel[name] = {
                'purchased': pnum(r[2]),
                'with_client': pnum(r[3]),
                'warehouse': pnum(r[4]),
                'rebrand': pnum(r[6]),
                'lost': pnum(r[7]),
                'used': pnum(r[8]),
                'damage': pnum(r[9]),
                'total': pnum(r[4])
            }
    wb.close()
except Exception as e:
    print(f"Error reading Sopexa Excel: {e}")

# 1.3 VIRGIN DATA SHEET
virgin_excel = {}
try:
    wb = openpyxl.load_workbook(virgin_path, data_only=True, read_only=True)
    sh = wb['INVENTORY']
    for idx, r in enumerate(sh.iter_rows(values_only=True)):
        if idx < 4: continue
        if r[1] and str(r[1]).strip() and not str(r[1]).strip().upper().startswith('TOTAL'):
            name = str(r[1]).strip()
            code = str(r[0]).strip() if r[0] else ''
            virgin_excel[name] = {
                'code': code,
                'purchased': pnum(r[2]),
                'issued': pnum(r[3]),
                'warehouse': pnum(r[4]),
                'damage': pnum(r[5]),
                'total': pnum(r[4])
            }
            if code:
                virgin_excel[code] = virgin_excel[name]
    wb.close()
except Exception as e:
    print(f"Error reading Virgin Excel: {e}")

# -------------------------------------------------------------------
# 2. QUERY DATABASE
# -------------------------------------------------------------------
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT 
        p.id, 
        p."itemCode", 
        p.name, 
        p.category, 
        p."brandId",
        b.name as brand_name
    FROM "Product" p
    JOIN "Brand" b ON p."brandId" = b.id
    ORDER BY b.name, p.name;
""")
all_products = cur.fetchall()

cur.execute("""
    SELECT 
        "productId",
        "transactionType",
        "fromEntityType",
        "toEntityType",
        "returnStatus",
        quantity,
        timestamp
    FROM "InventoryTransaction"
    WHERE timestamp < '2026-10-03 00:00:00';
""")
raw_txs = cur.fetchall()

prod_txs = defaultdict(list)
for r in raw_txs:
    prod_txs[r[0]].append({
        'type': r[1],
        'from': r[2],
        'to': r[3],
        'returnStatus': r[4],
        'qty': float(r[5]),
        'ts': r[6]
    })

def calculate_db_totals(tx_list):
    purchased = sum(t['qty'] for t in tx_list if t['type'] in ['RECEIVE', 'REC', 'INITIAL', 'INITIAL_STOCK', 'REBRAND_IN'])
    rebrand = sum(t['qty'] for t in tx_list if t['type'] in ['REBRAND', 'REBRAND_OUT'])
    used = sum(t['qty'] for t in tx_list if t['type'] == 'USED')
    issued = sum(t['qty'] for t in tx_list if t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['STORE', None, ''])
    damage = sum(t['qty'] for t in tx_list if t['type'] in ['DAMAGE', 'DAM'])
    lost = sum(t['qty'] for t in tx_list if t['type'] in ['LOST', 'LST'])
    with_client = sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_STOCK' or (t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['CLIENT', 'BRAND'])) - sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_RETURN')
    
    warehouse = max(0.0, purchased - issued - used - damage - lost - rebrand - with_client)

    return {
        'purchased': purchased,
        'warehouse': warehouse,
        'issued': issued,
        'used': used,
        'damage': damage,
        'lost': lost,
        'with_client': with_client,
        'rebrand': rebrand,
        'total': warehouse
    }

print("================================================================================")
print("PREVIEW CHECK: EXCEL vs DATABASE TRANSACTION BREAKDOWN (BASELINE < OCT 3, 2026)")
print("================================================================================")

brand_stats = defaultdict(lambda: {'checked': 0, 'matches': 0, 'discrepancies': []})

for p in all_products:
    p_id, sku, name, cat, brand_id, b_name = p
    ex_dict = {}
    if 'SADIA' in b_name.upper():
        clean_name = name
        if clean_name.lower().startswith('sadia - '):
            clean_name = clean_name[8:].strip()
        ex_dict = sadia_excel.get(name) or sadia_excel.get(clean_name) or {}
    elif 'SOPEXA' in b_name.upper():
        clean_name = name
        if clean_name.lower().startswith('sopexa - '):
            clean_name = clean_name[9:].strip()
        ex_dict = sopexa_excel.get(name) or sopexa_excel.get(clean_name) or {}
    elif 'VIRGIN' in b_name.upper():
        clean_name = name
        if clean_name.lower().startswith('virgin - '):
            clean_name = clean_name[9:].strip()
        ex_dict = virgin_excel.get(name) or virgin_excel.get(clean_name) or virgin_excel.get(sku) or {}

    if not ex_dict:
        continue

    brand_stats[b_name]['checked'] += 1
    db_stock = calculate_db_totals(prod_txs[p_id])

    diffs = {}
    for m in ['purchased', 'warehouse', 'issued', 'used', 'damage', 'lost', 'with_client', 'rebrand']:
        if m in ex_dict:
            db_v = db_stock.get(m, 0.0)
            ex_v = ex_dict.get(m, 0.0)
            diff = db_v - ex_v
            if abs(diff) > 0.001:
                diffs[m] = (db_v, ex_v, diff)

    if diffs:
        brand_stats[b_name]['discrepancies'].append({
            'sku': sku,
            'name': name,
            'cat': cat,
            'db': db_stock,
            'ex': ex_dict,
            'diffs': diffs
        })
    else:
        brand_stats[b_name]['matches'] += 1

for b_name, stats in brand_stats.items():
    print(f"\nBrand: {b_name}")
    print(f"  Total Checked Against Excel: {stats['checked']}")
    print(f"  Exact Matches (100%):        {stats['matches']}")
    print(f"  Discrepancies:               {len(stats['discrepancies'])}")
    if stats['discrepancies']:
        for idx, item in enumerate(stats['discrepancies'], 1):
            print(f"    {idx}. [{item['sku']}] {item['name']} (Category: {item['cat']})")
            for m, (dv, ev, df) in item['diffs'].items():
                print(f"         {m:<14}: DB={dv:10.1f} | Excel={ev:10.1f} | Diff={df:+10.1f}")

# -------------------------------------------------------------------
# 3. REBRAND AUDIT & REMEDIATION PLAN
# -------------------------------------------------------------------
print("\n================================================================================")
print("REBRAND AUDIT: STATUS & TO-ENTITY PROPOSED CORRECTIONS")
print("================================================================================")

cur.execute("""
    SELECT 
        t.id,
        t."deliveryNote",
        t."transactionType",
        t."deliveryStatus",
        t."returnStatus",
        t."fromEntityType",
        t."fromEntityId",
        t."toEntityType",
        t."toEntityId",
        t.quantity,
        t.timestamp,
        t.notes,
        p.id as prod_id,
        p.name as prod_name,
        p."itemCode"
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."transactionType" IN ('REBRAND', 'REBRAND_OUT', 'REBRAND_IN')
    ORDER BY t."deliveryNote", t."transactionType" DESC;
""")
rebrands = cur.fetchall()

rebrand_map = defaultdict(list)
for r in rebrands:
    rebrand_map[r[1] or 'NO_DN'].append(r)

print(f"Total Rebrand Delivery Notes / Gate Passes: {len(rebrand_map)}")
for dn, items in sorted(rebrand_map.items()):
    print(f"\nGate Pass: {dn} ({len(items)} items)")
    for tx in items:
        tid, dn_val, ttype, dstatus, rstatus, ftype, fid, ttype_ent, tid_ent, qty, ts, notes, pid, pname, sku = tx
        status_disp = rstatus or "PENDING (null)"
        print(f"  ID: {tid} | Type: {ttype:<11} | Qty: {qty:4.0f} | From: {ftype}:{fid} -> To: {ttype_ent}:{tid_ent} | ReturnStatus: {status_disp} | Item: [{sku}] {pname}")
        if notes:
            print(f"      Notes: {notes}")

conn.close()
