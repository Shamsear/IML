import sys
import psycopg2
import openpyxl
from collections import defaultdict
import datetime

sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# ---------------------------------------------------------
# 1. READ EXCEL SHEETS
# ---------------------------------------------------------
sadia_path = r"D:\inventory\documents\SADIA - INVENTORY FORMAT 1 og.xlsx"
sopexa_path = r"D:\inventory\documents\Sopexa inventory - Master - 26-01-2026.xlsx"
virgin_path = r"D:\inventory\documents\VIRGIN STOCK INVENTORY-2026.xlsx"

def pnum(v):
    try:
        if v is None or v == '': return 0.0
        return float(str(v).replace(',', '').strip())
    except:
        return 0.0

# 1.1 SADIA DATA SHEET
sadia_excel = {}
try:
    wb = openpyxl.load_workbook(sadia_path, data_only=True, read_only=True)
    sh = wb['DATA']
    for idx, r in enumerate(sh.iter_rows(values_only=True)):
        if idx == 0: continue
        if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
            name = str(r[0]).strip()
            # Canonical key
            sadia_excel[name] = {
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
    # Scan rows
    for idx, r in enumerate(sh.iter_rows(values_only=True)):
        if idx < 2: continue
        if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
            name = str(r[0]).strip()
            # Col 0: Item, Col 1: Item Code, Col 2: Received/Purchased, Col 3: Available, Col 4: With Client, Col 5: Used, Col 6: Damage, Col 7: Lost, Col 8: Rebrand, Col 9: Total
            sopexa_excel[name] = {
                'purchased': pnum(r[2]),
                'warehouse': pnum(r[3]),
                'with_client': pnum(r[4]),
                'used': pnum(r[5]),
                'damage': pnum(r[6]),
                'lost': pnum(r[7]),
                'rebrand': pnum(r[8]),
                'total': pnum(r[9]) if len(r) > 9 else pnum(r[3])
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
        if idx < 2: continue
        if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
            name = str(r[0]).strip()
            virgin_excel[name] = {
                'purchased': pnum(r[2]),
                'warehouse': pnum(r[3]),
                'issued': pnum(r[4]) if len(r) > 4 else 0.0,
                'used': pnum(r[5]) if len(r) > 5 else 0.0,
                'damage': pnum(r[6]) if len(r) > 6 else 0.0,
                'lost': pnum(r[7]) if len(r) > 7 else 0.0,
            }
    wb.close()
except Exception as e:
    print(f"Error reading Virgin Excel: {e}")

# ---------------------------------------------------------
# 2. QUERY DATABASE (EXCLUDING YESTERDAY/RECENT ENTRIES: Oct 3, 2026 ONWARD)
# ---------------------------------------------------------
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get products and brand
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

# Query transactions excluding Oct 3, 2026 onward
cur.execute("""
    SELECT 
        "productId",
        "transactionType",
        "fromEntityType",
        "toEntityType",
        "returnStatus",
        SUM(quantity) as total_qty
    FROM "InventoryTransaction"
    WHERE timestamp < '2026-10-03 00:00:00'
    GROUP BY "productId", "transactionType", "fromEntityType", "toEntityType", "returnStatus";
""")
tx_aggs = cur.fetchall()

# Also query including all transactions to show impact of yesterday's transactions
cur.execute("""
    SELECT 
        "productId",
        "transactionType",
        "fromEntityType",
        "toEntityType",
        "returnStatus",
        SUM(quantity) as total_qty
    FROM "InventoryTransaction"
    GROUP BY "productId", "transactionType", "fromEntityType", "toEntityType", "returnStatus";
""")
all_tx_aggs = cur.fetchall()

# Build transaction map per product
prod_txs_baseline = defaultdict(list)
for r in tx_aggs:
    prod_txs_baseline[r[0]].append({
        'type': r[1],
        'from': r[2],
        'to': r[3],
        'returnStatus': r[4],
        'qty': float(r[5])
    })

prod_txs_all = defaultdict(list)
for r in all_tx_aggs:
    prod_txs_all[r[0]].append({
        'type': r[1],
        'from': r[2],
        'to': r[3],
        'returnStatus': r[4],
        'qty': float(r[5])
    })

# Compute stock breakdown using our canonical logic
def compute_stock_breakdown(tx_list):
    purchased = 0.0
    warehouse = 0.0
    issued = 0.0
    used = 0.0
    with_client = 0.0
    damage = 0.0
    lost = 0.0
    rebrand = 0.0

    for t in tx_list:
        qty = t['qty']
        type = (t['type'] or '').upper()
        frm = (t['from'] or '').upper()
        to = (t['to'] or '').upper()

        if type in ['RECEIVE', 'REC', 'INITIAL', 'INITIAL_STOCK']:
            purchased += qty
            warehouse += qty
        elif type in ['REBRAND_IN', 'REB_IN']:
            purchased += qty
            warehouse += qty
        elif type in ['REBRAND_OUT', 'REB_OUT', 'REBRAND']:
            warehouse -= qty
            rebrand += qty
        elif type == 'CLIENT_STOCK':
            if frm == 'WAREHOUSE' or not frm:
                warehouse -= qty
            elif frm == 'STORE':
                issued = max(0.0, issued - qty)
            with_client += qty
        elif type == 'CLIENT_RETURN':
            if to == 'WAREHOUSE' or not to:
                warehouse += qty
                with_client = max(0.0, with_client - qty)
            else:
                with_client += qty
                warehouse -= qty
        elif type in ['ISSUE', 'OUT']:
            if frm == 'WAREHOUSE' or not frm:
                warehouse -= qty
                if to == 'STORE':
                    issued += qty
                elif to == 'STAFF':
                    used += qty
                elif to in ['CLIENT', 'BRAND']:
                    with_client += qty
                else:
                    issued += qty
            elif frm == 'STORE':
                issued = max(0.0, issued - qty)
                if to == 'STAFF':
                    used += qty
                elif to in ['CLIENT', 'BRAND']:
                    with_client += qty
                else:
                    used += qty
            elif frm == 'STAFF':
                used = max(0.0, used - qty)
                issued += qty
            else:
                warehouse -= qty
                issued += qty
        elif type == 'USED':
            if frm == 'STORE':
                issued = max(0.0, issued - qty)
            else:
                warehouse -= qty
            used += qty
        elif type in ['RETURN', 'RET']:
            if to in ['VENDOR', 'SUPPLIER']:
                warehouse -= qty
                purchased = max(0.0, purchased - qty)
            elif to == 'WAREHOUSE' or not to:
                warehouse += qty
                if frm in ['CLIENT', 'BRAND']:
                    with_client = max(0.0, with_client - qty)
                elif frm == 'STAFF':
                    used = max(0.0, used - qty)
                elif frm == 'STORE':
                    issued = max(0.0, issued - qty)
                else:
                    if issued >= qty: issued -= qty
                    elif with_client >= qty: with_client -= qty
                    elif used >= qty: used -= qty
            elif to == 'STORE':
                issued += qty
                if frm == 'STAFF':
                    used = max(0.0, used - qty)
        elif type in ['DAMAGE', 'DAM']:
            if frm == 'STORE':
                issued = max(0.0, issued - qty)
            elif frm == 'STAFF':
                used = max(0.0, used - qty)
            elif frm in ['CLIENT', 'BRAND']:
                with_client = max(0.0, with_client - qty)
            else:
                warehouse -= qty
            damage += qty
        elif type in ['LOST', 'LST']:
            if frm == 'STORE':
                issued = max(0.0, issued - qty)
            elif frm == 'STAFF':
                used = max(0.0, used - qty)
            elif frm in ['CLIENT', 'BRAND']:
                with_client = max(0.0, with_client - qty)
            else:
                warehouse -= qty
            lost += qty

    return {
        'purchased': max(0.0, purchased),
        'warehouse': max(0.0, warehouse),
        'issued': max(0.0, issued),
        'used': max(0.0, used),
        'with_client': max(0.0, with_client),
        'damage': max(0.0, damage),
        'lost': max(0.0, lost),
        'rebrand': max(0.0, rebrand),
        'total': max(0.0, warehouse)
    }

print("================================================================================")
print("3. EXCEL VS DATABASE CROSS-CHECK (BASELINE - EXCLUDING YESTERDAY'S TRANSACTIONS)")
print("================================================================================")

variances = []
matched_count = 0
total_checked = 0

for p in all_products:
    p_id, sku, name, cat, brand_id, b_name = p
    
    # Choose matching Excel source
    ex_dict = {}
    if 'SADIA' in b_name.upper():
        # Match by name or stripped prefix
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
        ex_dict = virgin_excel.get(name) or virgin_excel.get(clean_name) or {}

    if not ex_dict:
        continue

    total_checked += 1
    db_stock = compute_stock_breakdown(prod_txs_baseline[p_id])
    
    # Compare each metric
    diffs = {}
    for m in ['purchased', 'warehouse', 'issued', 'used', 'damage', 'lost', 'with_client', 'rebrand']:
        db_val = db_stock.get(m, 0.0)
        ex_val = ex_dict.get(m, 0.0)
        diff = db_val - ex_val
        if abs(diff) > 0.001:
            diffs[m] = (db_val, ex_val, diff)

    if diffs:
        variances.append({
            'product_id': p_id,
            'sku': sku,
            'name': name,
            'brand': b_name,
            'category': cat,
            'db_stock': db_stock,
            'ex_stock': ex_dict,
            'diffs': diffs
        })
    else:
        matched_count += 1

print(f"Total Products Checked Against Excel: {total_checked}")
print(f"Perfect Matches (0 discrepancy): {matched_count}")
print(f"Products with Discrepancies: {len(variances)}\n")

for idx, v in enumerate(variances, 1):
    print(f"--------------------------------------------------------------------------------")
    print(f"{idx}. [{v['brand']}] [{v['sku']}] {v['name']} (Cat: {v['category']})")
    print(f"   Metric           | DB Value (Baseline) | Excel Value | Difference")
    print(f"   -----------------------------------------------------------------")
    for m, (db_v, ex_v, diff) in v['diffs'].items():
        print(f"   {m:<16} | {db_v:19.1f} | {ex_v:11.1f} | {diff:+10.1f}")

# ---------------------------------------------------------
# 4. REBRAND AUDIT: PENDING VS COMPLETED & TARGET ENTITIES
# ---------------------------------------------------------
print("\n================================================================================")
print("4. REBRAND AUDIT (PENDING vs COMPLETED & TO ENTITY DETAILS)")
print("================================================================================")

cur.execute("""
    SELECT 
        t.id,
        t."deliveryNote",
        t."transactionType",
        t."deliveryStatus",
        t."returnStatus",
        t."returnedQty",
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
    ORDER BY t."deliveryNote", t."transactionType" DESC, t.timestamp DESC;
""")
rebrand_txs = cur.fetchall()

rebrand_by_dn = defaultdict(list)
for tx in rebrand_txs:
    dn = tx[1] or 'NO_DN'
    rebrand_by_dn[dn].append(tx)

print(f"Total Distinct Rebrand Gate Passes/Delivery Notes: {len(rebrand_by_dn)}")

for dn, tx_list in sorted(rebrand_by_dn.items()):
    print(f"\n--- Delivery Note: {dn} ({len(tx_list)} records) ---")
    for tx in tx_list:
        tid, dn_val, ttype, dstatus, rstatus, rqty, from_type, from_id, to_type, to_id, qty, ts, notes, pid, pname, sku = tx
        print(f"  TxID: {tid} | Type: {ttype:<11} | Qty: {qty:4.0f} | From: {from_type}:{from_id} -> To: {to_type}:{to_id} | DelivStatus: {dstatus} | RetStatus: {rstatus} | RetQty: {rqty} | Prod: [{sku}] {pname}")
        if notes:
            print(f"      Notes: {notes}")

conn.close()
