import psycopg2

db_url = 'postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute('SELECT id, name FROM "Brand"')
brands = cur.fetchall()
print('Brands in DB:', brands)
for bid, bname in brands:
    cur.execute('SELECT COUNT(*) FROM "Product" WHERE "brandId" = %s', (bid,))
    print(f'  Brand {bname} ({bid}): {cur.fetchone()[0]} products')
conn.close()
