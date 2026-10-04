import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = env.match(/DATABASE_URL="([^"]+)"/);
const pool = new pg.Pool({ connectionString: dbUrlMatch[1] });

const HISTORICAL_REBRAND_TARGETS = {
  'RBD-SAD-210824-001': 'Sadia Promotional Stand (1*1) "Back to School" English',
  'RBD-SAD-250924-001': 'Sadia Promotional Stand (1*1)  Carrefour',
  'RBD-SAD-291024-001': 'Sadia Promotional Stand (1*1) - For Union Coop',
  'RBD-SAD-051124-001': 'Sadia Promotional Stand (1*1) - Generic',
  'RBD-SAD-061124-001': 'Sadia Promotional Stand (1*1) - For LULU New Dec 2024',
  'RBD-SAD-061124-002': 'Sadia Promotional Stand (1*1) - For Union Coop',
  'RBD-SAD-291124-001': 'Sadia Promotional Stand (1*1) - Mortadella',
  'RBD-SAD-291124-002': 'Sadia Promotional Stand (1*1) - Mortadella',
  'RBD-SAD-050225-001': 'Sadia Promotional Stand (1*1) - Generic',
  'RBD-SAD-100225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
  'RBD-SAD-120225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
  'RBD-SAD-130225-001': 'Sadia Promotional Stand (1*1) - Ramadan Like a pro',
  'RBD-SAD-130525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
  'RBD-SAD-200525-001': 'Sadia Promotional Stand (1*1) - Generic New 2025 (Buy Scan & Win)',
  'RBD-SAD-140825-001': 'Sadia Promotional Stand (1*1) "Back to School" English 2025',
  'RBD-SAD-240925-001': 'Sadia Promotional Stand (1*1) "1000 Carrefour Voucher" 2025',
  'RBD-SAD-250925-001': 'Sadia Wooden Chef Stand',
  'RBD-SAD-211025-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
  'RBD-SAD-101125-001': 'Sadia Promotional Stand (1*1) "Win Big With Sadia" 2025',
  'RBD-SAD-091225-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
  'RBD-SAD-260126-001': 'Sadia Promotional Stand (1*1) - Ramadan 2026',
  'RBD-SAD-200426-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
  'RBD-SAD-180526-001': 'Sadia Promotional Stand (1*1) - New Look April 2026',
  'RBD-SAD-170826-001': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
  'RBD-SAD-250826-001': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
  'RBD-SAD-250826-002': 'Sadia Promotional Stand (1*1) - Back To School "AED 40 2026"',
};

async function run() {
  console.log('Starting DB update of historical rebrand transaction notes...');
  
  let updatedCount = 0;
  for (const [dn, targetName] of Object.entries(HISTORICAL_REBRAND_TARGETS)) {
    const noteText = `Rebrand output -> ${targetName}.`;
    
    // Find transactions with this deliveryNote and update their notes if not already updated
    const res = await pool.query(`
      UPDATE "InventoryTransaction"
      SET "notes" = CASE 
        WHEN "notes" IS NULL OR "notes" = '' THEN $1
        WHEN "notes" NOT ILIKE '%Rebrand output ->%' THEN $1 || ' ' || "notes"
        ELSE "notes"
      END
      WHERE "deliveryNote" = $2 AND "transactionType" = 'REBRAND'
      RETURNING id, "deliveryNote", notes
    `, [noteText, dn]);

    console.log(`Updated ${res.rowCount} transactions for Delivery Note: ${dn} -> "${targetName}"`);
    updatedCount += res.rowCount;
  }

  console.log(`\nSuccessfully updated a total of ${updatedCount} rebrand transactions in the database.`);
  await pool.end();
}

run().catch(console.error);
