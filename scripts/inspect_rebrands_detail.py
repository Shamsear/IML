import sys
import psycopg2
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute('SELECT id, name FROM "Store"')
stores = {s[0]: s[1] for s in cur.fetchall()}

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
    ORDER BY t.timestamp ASC, t."deliveryNote";
""")
rebrands = cur.fetchall()

print(f"=== TOTAL REBRAND TRANSACTIONS: {len(rebrands)} ===")

rebrand_by_dn = defaultdict(list)
for r in rebrands:
    dn = r[1] or 'NO_DN'
    rebrand_by_dn[dn].append(r)

for dn, items in sorted(rebrand_by_dn.items()):
    print(f"\n=======================================================")
    print(f"Gate Pass / Delivery Note: {dn} ({len(items)} records)")
    print(f"=======================================================")
    for tx in items:
        tid, dn_val, ttype, dstatus, rstatus, rqty, ftype, fid, ttype_ent, tid_ent, qty, ts, notes, pid, pname, sku = tx
        to_name = stores.get(tid_ent) or tid_ent
        from_name = stores.get(fid) or fid
        print(f"TxID: {tid}")
        print(f"  Type: {ttype:<11} | Qty: {qty:4.0f} | Date: {ts}")
        print(f"  From: {ftype} ({from_name}) -> To: {ttype_ent} ({to_name}) [ID: {tid_ent}]")
        print(f"  Return Status: {rstatus} | Returned Qty: {rqty}")
        print(f"  Product: [{sku}] {pname}")
        print(f"  Notes: {notes}")

conn.close()
