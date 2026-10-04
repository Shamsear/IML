import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// read .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  });
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalizeDn(oldDn) {
  if (!oldDn) return oldDn;
  let dn = oldDn.trim();

  // Handle comma separated
  if (dn.includes(',')) {
    dn = dn.split(',')[0].trim();
  }

  // Handle IML-[BRAND]-DEL-[DD]-[MM]-[YYYY]-[NUM]
  // e.g. IML-SADIA-DEL-17-09-2026-1540 -> DN-SAD-170926-1540 (or formatted)
  const imlMatch = dn.match(/^IML-([A-Z0-9]+)-DEL-(\d{1,2})-(\d{1,2})-(\d{4})-(\d+)$/i);
  if (imlMatch) {
    const brand = imlMatch[1].toUpperCase().slice(0, 3);
    const day = imlMatch[2].padStart(2, '0');
    const month = imlMatch[3].padStart(2, '0');
    const year = imlMatch[4].slice(-2);
    const num = imlMatch[5];
    return `DN-${brand}-${day}${month}${year}-${num}`;
  }

  // Handle DN-INIT-USD-SAD-2025-304
  const initTypeMatch = dn.match(/^DN-INIT-(USD|ISS|CLT|DAM|LOS|REC)-([A-Z0-9]+)-(\d{4})-(\d+)$/i);
  if (initTypeMatch) {
    const type = initTypeMatch[1].toUpperCase() === 'ISS' ? 'DN' : initTypeMatch[1].toUpperCase();
    const brand = initTypeMatch[2].toUpperCase().slice(0, 3);
    const year = initTypeMatch[3].slice(-2);
    const num = initTypeMatch[4].padStart(3, '0');
    return `${type}-${brand}-0101${year}-${num}`;
  }

  // Handle DN-INIT-SAD-2025-001
  const initMatch = dn.match(/^DN-INIT-([A-Z0-9]+)-(\d{4})-(\d+)$/i);
  if (initMatch) {
    const brand = initMatch[1].toUpperCase().slice(0, 3);
    const year = initMatch[2].slice(-2);
    const num = initMatch[3].padStart(3, '0');
    return `DN-${brand}-0101${year}-${num}`;
  }

  // Handle RTN -> RET
  if (dn.startsWith('RTN-')) {
    return dn.replace(/^RTN-/, 'RET-');
  }

  return dn;
}

async function test() {
  const res = await pool.query(`
    SELECT DISTINCT "deliveryNote"
    FROM "InventoryTransaction"
    WHERE "deliveryNote" IS NOT NULL
  `);

  const oldDns = res.rows.map(r => r.deliveryNote);
  console.log('Total unique DNs in DB:', oldDns.length);

  const mapped = [];
  const unmapped = [];

  oldDns.forEach(dn => {
    const newDn = normalizeDn(dn);
    if (newDn !== dn) {
      mapped.push({ old: dn, new: newDn });
    } else if (!/^[A-Z0-9]{2,4}-[A-Z0-9]{3}-\d{6}-\d{3,4}$/.test(dn)) {
      unmapped.push(dn);
    }
  });

  console.log('Total mapped/updated DNs:', mapped.length);
  console.log('Sample mapped DNs:', mapped.slice(0, 20));
  console.log('Remaining unmapped non-standard DNs:', unmapped);
}

test().catch(console.error).finally(() => pool.end());
