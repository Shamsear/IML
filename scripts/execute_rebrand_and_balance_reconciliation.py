import sys
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=================================================================")
print("EXECUTING DATABASE RECONCILIATION & REBRAND COMPLETION UPDATES")
print("=================================================================")

# ----------------------------------------------------------------------
# 1. REBRAND COMPLETION FIX
# ----------------------------------------------------------------------
print("\n1. Updating 56 Rebrand Transactions to COMPLETED...")
cur.execute("""
    UPDATE "InventoryTransaction"
    SET 
        "returnStatus" = 'COMPLETED',
        "deliveryStatus" = 'DELIVERED',
        "returnedQty" = quantity
    WHERE "transactionType" = 'REBRAND'
      AND ("returnStatus" IS NULL OR "returnStatus" = 'PENDING');
""")
rebrands_updated = cur.rowcount
print(f"   Successfully marked {rebrands_updated} Rebrand transactions as COMPLETED.")

# ----------------------------------------------------------------------
# 2. RECONCILE GEEPAS DEEP FRYER (PROD-SAD-072)
# ----------------------------------------------------------------------
print("\n2. Reconciling Geepas Deep Fryer (PROD-SAD-072)...")
cur.execute("""
    DELETE FROM "InventoryTransaction"
    WHERE id = 'TXN-SAD-011298';
""")
fryer_deleted = cur.rowcount
print(f"   Removed artificial +6 purchase adjustment TXN-SAD-011298: {fryer_deleted} record(s) deleted.")

# ----------------------------------------------------------------------
# 3. RECONCILE NAPKIN HOLDER (PROD-SAD-114)
# ----------------------------------------------------------------------
print("\n3. Reconciling Napkin Holder (PROD-SAD-114)...")
# Delete artificial return entry TXN-SAD-011309 and remove client_stock entries for napkin holder
# (TXN-SAD-010953, TXN-SAD-010982, TXN-SAD-010993) so With Client is 0 and Warehouse matches Excel 67
cur.execute("""
    DELETE FROM "InventoryTransaction"
    WHERE id IN ('TXN-SAD-011309', 'TXN-SAD-010953', 'TXN-SAD-010982', 'TXN-SAD-010993');
""")
napkin_deleted = cur.rowcount
print(f"   Reconciled Napkin Holder client transactions: {napkin_deleted} record(s) cleaned up.")

# Commit changes
conn.commit()
print("\nAll database updates successfully committed!")

# ----------------------------------------------------------------------
# 4. VERIFICATION OF FINAL REBRAND STATUSES & PRODUCT BALANCES
# ----------------------------------------------------------------------
print("\n=================================================================")
print("4. VERIFICATION AFTER UPDATES")
print("=================================================================")

cur.execute("""
    SELECT "returnStatus", COUNT(*), SUM(quantity)
    FROM "InventoryTransaction"
    WHERE "transactionType" = 'REBRAND'
    GROUP BY "returnStatus";
""")
print("\nRebrand Status Summary:")
for r in cur.fetchall():
    print(f"  Status: {r[0]:<12} | Count: {r[1]:<4} | Total Qty: {r[2]}")

cur.execute("""
    SELECT 
        p."itemCode",
        p.name,
        SUM(CASE WHEN t."transactionType" IN ('RECEIVE', 'INITIAL', 'INITIAL_STOCK', 'REBRAND_IN') THEN t.quantity ELSE 0 END) as purchased,
        SUM(CASE WHEN t."transactionType" IN ('ISSUE', 'OUT') AND t."toEntityType" IN ('STORE', NULL, '') THEN t.quantity ELSE 0 END) as issued,
        SUM(CASE WHEN t."transactionType" = 'USED' THEN t.quantity ELSE 0 END) as used,
        SUM(CASE WHEN t."transactionType" IN ('DAMAGE', 'DAM') THEN t.quantity ELSE 0 END) as damage,
        SUM(CASE WHEN t."transactionType" IN ('LOST', 'LST') THEN t.quantity ELSE 0 END) as lost,
        SUM(CASE WHEN t."transactionType" = 'CLIENT_STOCK' THEN t.quantity ELSE 0 END) - 
        SUM(CASE WHEN t."transactionType" = 'CLIENT_RETURN' THEN t.quantity ELSE 0 END) as with_client,
        SUM(CASE WHEN t."transactionType" IN ('REBRAND', 'REBRAND_OUT') THEN t.quantity ELSE 0 END) as rebrand
    FROM "Product" p
    JOIN "Brand" b ON p."brandId" = b.id
    LEFT JOIN "InventoryTransaction" t ON p.id = t."productId" AND t.timestamp < '2026-10-03 00:00:00'
    WHERE p."itemCode" IN ('PROD-SAD-072', 'PROD-SAD-114')
    GROUP BY p.id, p."itemCode", p.name;
""")

print("\nReconciled Products Baseline Balances (Excl Yesterday):")
for r in cur.fetchall():
    sku, name, pur, iss, usd, dam, lst, cli, reb = r
    pur = float(pur or 0)
    iss = float(iss or 0)
    usd = float(usd or 0)
    dam = float(dam or 0)
    lst = float(lst or 0)
    cli = float(cli or 0)
    reb = float(reb or 0)
    wh = pur - iss - usd - dam - lst - cli - reb
    print(f"\n  [{sku}] {name}")
    print(f"    Purchased: {pur:6.1f} | Warehouse: {wh:6.1f} | Issued: {iss:6.1f} | Used: {usd:6.1f} | Damage: {dam:6.1f} | Lost: {lst:6.1f} | Client: {cli:6.1f} | Rebrand: {reb:6.1f}")

conn.close()
