import psycopg2
import openpyxl
from collections import defaultdict

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

wb = openpyxl.load_workbook(r'D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx', data_only=True, read_only=True)
ws = wb['DATA']

excel_items = {}
for idx, r in enumerate(ws.iter_rows(values_only=True)):
    if idx == 0: continue
    if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
        name = str(r[0]).strip()
        excel_items[name] = {
            'name': name,
            'cat': str(r[1]).strip() if r[1] else '',
            'p': float(r[2] or 0),
            'w': float(r[3] or 0),
            'i': float(r[4] or 0),
            'u': float(r[5] or 0),
            'd': float(r[6] or 0),
            'l': float(r[7] or 0),
            'c': float(r[8] or 0),
            'rb': float(r[10] or 0)
        }

wb.close()

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT p.id, p."itemCode", p.name, p.category, b.name
    FROM "Product" p
    JOIN "Brand" b ON p."brandId" = b.id
    WHERE b.name ILIKE '%SADIA%';
""")
db_prods = cur.fetchall()

cur.execute("""
    SELECT t."productId", t."transactionType", t."fromEntityType", t."toEntityType", t."returnStatus", t.quantity, t.timestamp
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    JOIN "Brand" b ON p."brandId" = b.id
    WHERE b.name ILIKE '%SADIA%';
""")
all_txs = cur.fetchall()

print(f"Excel Products in DATA: {len(excel_items)}")
print(f"DB Sadia Products: {len(db_prods)}")
print(f"DB Sadia Transactions: {len(all_txs)}")

# Let's sum Excel
sum_excel = defaultdict(float)
for it in excel_items.values():
    for k in ['p', 'w', 'i', 'u', 'd', 'l', 'c', 'rb']:
        sum_excel[k] += it[k]

print("\n--- EXCEL SUMS ---")
print(f"Purchased: {sum_excel['p']}")
print(f"Warehouse: {sum_excel['w']}")
print(f"Issued: {sum_excel['i']}")
print(f"Used: {sum_excel['u']}")
print(f"Damage: {sum_excel['d']}")
print(f"Lost: {sum_excel['l']}")
print(f"With Client: {sum_excel['c']}")
print(f"Rebrand: {sum_excel['rb']}")

# Now let's calculate DB sums
# Group DB txs by product
prod_txs = defaultdict(list)
for r in all_txs:
    pid, ttype, frm, to, rstatus, qty, ts = r
    prod_txs[pid].append({
        'type': (ttype or '').upper(),
        'from': (frm or '').upper(),
        'to': (to or '').upper(),
        'status': rstatus,
        'qty': float(qty or 0),
        'ts': ts
    })

# Map DB products to excel products
db_name_map = {p[2].strip().lower(): p for p in db_prods}

db_totals = defaultdict(float)
matched = 0
unmatched = []

for ex_name, ex_data in excel_items.items():
    key = ex_name.lower()
    p_info = db_name_map.get(key)
    if not p_info:
        # try relaxed matching
        for dbk, dbv in db_name_map.items():
            if dbk.replace(' ', '') == key.replace(' ', ''):
                p_info = dbv
                break
    
    if p_info:
        matched += 1
        pid = p_info[0]
        tx_list = prod_txs[pid]
        
        # calculate metrics
        # Note: baseline vs all
        purchased = sum(t['qty'] for t in tx_list if t['type'] in ['PURCHASE', 'RECEIVE', 'REC', 'INITIAL', 'INITIAL_STOCK', 'REBRAND_IN'])
        rebrand = sum(t['qty'] for t in tx_list if t['type'] in ['REBRAND', 'REBRAND_OUT'])
        used = sum(t['qty'] for t in tx_list if t['type'] == 'USED')
        # Issued: outbound to store/other
        issued = sum(t['qty'] for t in tx_list if t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['STORE', None, ''])
        damage = sum(t['qty'] for t in tx_list if t['type'] in ['DAMAGE', 'DAM'])
        lost = sum(t['qty'] for t in tx_list if t['type'] in ['LOST', 'LST'])
        with_client = sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_STOCK' or (t['type'] in ['ISSUE', 'OUT'] and t['to'] in ['CLIENT', 'BRAND'])) - sum(t['qty'] for t in tx_list if t['type'] == 'CLIENT_RETURN')
        returns_to_wh = sum(t['qty'] for t in tx_list if t['type'] in ['RETURN', 'RET'] and t['to'] in ['WAREHOUSE', None, ''])
        
        warehouse = purchased - issued - used - damage - lost - rebrand - with_client + returns_to_wh
        
        db_totals['p'] += purchased
        db_totals['w'] += warehouse
        db_totals['i'] += issued
        db_totals['u'] += used
        db_totals['d'] += damage
        db_totals['l'] += lost
        db_totals['c'] += with_client
        db_totals['rb'] += rebrand
    else:
        unmatched.append(ex_name)

print(f"\nMatched {matched} / {len(excel_items)} products.")
if unmatched:
    print(f"Unmatched products: {unmatched}")

print("\n--- DB TOTALS (for matched products) ---")
print(f"Purchased: {db_totals['p']}")
print(f"Warehouse: {db_totals['w']}")
print(f"Issued: {db_totals['i']}")
print(f"Used: {db_totals['u']}")
print(f"Damage: {db_totals['d']}")
print(f"Lost: {db_totals['l']}")
print(f"With Client: {db_totals['c']}")
print(f"Rebrand: {db_totals['rb']}")
