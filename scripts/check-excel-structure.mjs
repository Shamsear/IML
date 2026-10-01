import xlsx from 'xlsx';

const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');

const dataSheet = wb.Sheets['DATA'];
const dataRows = xlsx.utils.sheet_to_json(dataSheet);

console.log('=== PRODUCTS IN EXCEL WHERE PURCHASE/RECEIVED IS RECORDED VS REBRAND/DAMAGE/LOST ===');

const analysis = [];

for (const row of dataRows) {
  const name = row['Item Description'];
  const category = row['Item category'];
  const purchased = row['Purchased / Received'] ?? 0;
  const warehouse = row['Available In Warehouse'] ?? 0;
  const issued = row['Issued'] ?? 0;
  const used = row['Used'] ?? 0;
  const damage = row['Damage'] ?? 0;
  const lost = row['Lost / Not Found'] ?? 0;
  const withClient = row['With Client'] ?? 0;
  const rebrand = row['Re Brand'] ?? 0;
  const total = row['Total'] ?? 0;
  const remarks = row['Remarks'] ?? '';

  analysis.push({
    name,
    category,
    purchased,
    warehouse,
    issued,
    used,
    damage,
    lost,
    withClient,
    rebrand,
    total,
    remarks
  });
}

// Let's filter for products that have Rebrand > 0 or Damage > 0 or Lost > 0 where Purchased <= 0 or Purchased < (Rebrand + Damage + Lost)
const notable = analysis.filter(a => (a.rebrand > 0 || a.damage > 0 || a.lost > 0 || a.issued > 0) && (a.purchased === 0 || a.warehouse === 0));

console.table(notable);

console.log('\n=== CHECKING "Sadia logo Broast Headers  - (New 2025)" IN EXCEL ===');
const prod23 = analysis.find(a => a.name.includes('New 2025') && a.name.includes('Broast'));
console.log(prod23);

console.log('\n=== CHECKING "Sadia Wooden Chef Stand" IN EXCEL ===');
const woodenChef = analysis.find(a => a.name.includes('Wooden Chef'));
console.log(woodenChef);

console.log('\n=== CHECKING STANDS REBRANDED IN EXCEL ===');
const rebrandStands = analysis.filter(a => a.rebrand > 0);
console.table(rebrandStands);
