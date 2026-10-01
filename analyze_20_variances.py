import sys
import psycopg2
import openpyxl
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

wb_path = r"D:\movie\SADIA - INVENTORY FORMAT 1 og (3).xlsx"
db_url = "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

wb = openpyxl.load_workbook(wb_path, read_only=True, data_only=True)
data_sh = wb['DATA']

# Read DATA sheet for all 117 products
data_sheet_data = {}
for idx, r in enumerate(data_sh.iter_rows(values_only=True)):
    if idx == 0:
        continue
    if r[0] and str(r[0]).strip() and not str(r[0]).strip().upper().startswith('TOTAL'):
        name = str(r[0]).strip()
        def pnum(v):
            try: return float(v) if v is not None and v != '' else 0.0
            except: return 0.0
        data_sheet_data[name] = {
            'purchased': pnum(r[2]),
            'avail': pnum(r[3]),
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

# Query DB transactions grouped by product and type
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute('''
    SELECT 
        p.id,
        p."itemCode",
        p.name,
        p.category,
        COALESCE(SUM(CASE WHEN t."transactionType" IN ('RECEIVE', 'INITIAL') THEN t.quantity ELSE 0 END), 0) as pur,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'ISSUE' THEN t.quantity ELSE 0 END), 0) as iss,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'USED' THEN t.quantity ELSE 0 END), 0) as usd,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'CLIENT_STOCK' THEN t.quantity ELSE 0 END), 0) as clt,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'DAMAGE' THEN t.quantity ELSE 0 END), 0) as dmg,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'LOST' THEN t.quantity ELSE 0 END), 0) as lst,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'REBRAND' THEN t.quantity ELSE 0 END), 0) as reb,
        COALESCE(SUM(CASE WHEN t."transactionType" = 'RETURN' THEN t.quantity ELSE 0 END), 0) as ret
    FROM "Product" p
    LEFT JOIN "InventoryTransaction" t ON p.id = t."productId"
    GROUP BY p.id, p."itemCode", p.name, p.category
    ORDER BY p.id ASC;
''')
db_rows = cur.fetchall()
conn.close()

variances = []
for r in db_rows:
    p_id, sku, name, cat, pur, iss, usd, clt, dmg, lst, reb, ret = r
    wh_stock = pur - (iss + usd + clt + dmg + lst + reb) + ret
    ex = data_sheet_data.get(name, {})
    ex_avail = ex.get('avail', 0.0)
    diff = wh_stock - ex_avail
    if abs(diff) > 0.001:
        variances.append({
            'sku': sku,
            'name': name,
            'cat': cat,
            'db_wh': wh_stock,
            'ex_avail': ex_avail,
            'diff': diff,
            'db_breakdown': {'pur': pur, 'iss': iss, 'usd': usd, 'clt': clt, 'dmg': dmg, 'lst': lst, 'reb': reb, 'ret': ret},
            'ex_breakdown': ex
        })

print(f"Total Variances Found: {len(variances)}\n")

for idx, v in enumerate(variances, 1):
    print(f"================================================================================")
    print(f"{idx}. [{v['sku']}] {v['name']} (Category: {v['cat']})")
    print(f"   DB Calculated Stock: {v['db_wh']:.1f} | Excel DATA Sheet Avail: {v['ex_avail']:.1f} | Diff: {v['diff']:+.1f}")
    print(f"   -----------------------------------------------------------------------------")
    db_b = v['db_breakdown']
    ex_b = v['ex_breakdown']
    print(f"   Metric         | DB Transacted Sum | Excel DATA Sheet | Variance Cause")
    print(f"   -----------------------------------------------------------------------------")
    for m, m_label in [('purchased', 'Purchased/In'), ('issued', 'Issued'), ('used', 'Used'), 
                       ('with_client', 'With Client'), ('damage', 'Damage'), ('lost', 'Lost'), 
                       ('rebrand', 'Rebrand')]:
        db_v = db_b['pur'] if m == 'purchased' else (db_b['iss'] if m == 'issued' else (db_b['usd'] if m == 'used' else (db_b['clt'] if m == 'with_client' else (db_b['dmg'] if m == 'damage' else (db_b['lst'] if m == 'lost' else db_b['reb'])))))
        ex_v = ex_b.get(m, 0.0)
        d = db_v - ex_v
        d_str = f"{d:+.1f}" if abs(d) > 0.001 else "   0.0"
        print(f"   {m_label:<14s} | {db_v:17.1f} | {ex_v:16.1f} | Diff: {d_str}")
    if ex_b.get('discard', 0.0) > 0:
        print(f"   Discard/Distr  | {'N/A (No Sheet)':<17s} | {ex_b.get('discard', 0.0):16.1f} | Manual column in DATA")
    print()
