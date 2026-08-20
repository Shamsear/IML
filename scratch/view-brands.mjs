import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_4B9AOcYnKbgu@ep-noisy-band-azabf3zx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

async function main() {
  const res = await pool.query('SELECT id, name, "secretKey" FROM "Brand"');
  console.log("Brands:");
  res.rows.forEach(b => {
    console.log(`ID: ${b.id}, Name: ${b.name}`);
    console.log(`SecretKey: ${b.secretKey}`);
    console.log("---");
  });
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
