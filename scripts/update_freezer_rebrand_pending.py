import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("Updating RBD-SAD-250826-001 to 25 Aug 2026, 08:00 AM with no To Product...")

cur.execute("""
    UPDATE "InventoryTransaction"
    SET 
        timestamp = '2026-08-25 08:00:00',
        "returnStatus" = 'PENDING',
        "returnedQty" = 0.0,
        "deliveryStatus" = 'DELIVERED',
        notes = NULL
    WHERE "deliveryNote" = 'RBD-SAD-250826-001'
      AND "productId" = (SELECT id FROM "Product" WHERE "itemCode" = 'PROD-SAD-042');
""")
print(f"  Sadia Branded Freezer updated: {cur.rowcount} row(s)")

cur.execute("""
    UPDATE "InventoryTransaction"
    SET timestamp = '2026-08-25 08:00:00'
    WHERE "deliveryNote" = 'RBD-SAD-250826-001';
""")
print(f"  Updated timestamp on RBD-SAD-250826-001: {cur.rowcount} row(s)")

conn.commit()

# Verify
cur.execute("""
    SELECT 
        t.id,
        t."deliveryNote",
        t."transactionType",
        t."deliveryStatus",
        t."returnStatus",
        t."returnedQty",
        t.quantity,
        t.timestamp,
        t.notes,
        p."itemCode",
        p.name
    FROM "InventoryTransaction" t
    JOIN "Product" p ON t."productId" = p.id
    WHERE t."deliveryNote" = 'RBD-SAD-250826-001';
""")
print("\nVerification for RBD-SAD-250826-001:")
for r in cur.fetchall():
    print(f"  {r[0]} | DN: {r[1]} | Status: {r[4]} | RetQty: {r[5]} | Date: {r[7]} | Notes: {r[8]} | Prod: [{r[9]}] {r[10]}")

conn.close()
