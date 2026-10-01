import xlsx from 'xlsx';

const wb = xlsx.readFile('D:/movie/SADIA - INVENTORY FORMAT 1 og (3).xlsx');

const dataSheet = wb.Sheets['DATA'];
const dataRows = xlsx.utils.sheet_to_json(dataSheet);

console.log(`Total rows in DATA sheet: ${dataRows.length}\n`);

const negativeOrDiscrepancies = [];

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

  // Check if warehouse is negative or if sum of parts doesn't match purchased
  const sumOutbounds = (typeof warehouse === 'number' ? warehouse : 0) + 
                       (typeof issued === 'number' ? issued : 0) + 
                       (typeof used === 'number' ? used : 0) + 
                       (typeof damage === 'number' ? damage : 0) + 
                       (typeof lost === 'number' ? lost : 0) + 
                       (typeof withClient === 'number' ? withClient : 0) + 
                       (typeof rebrand === 'number' ? rebrand : 0);

  const hasNegative = [purchased, warehouse, issued, used, damage, lost, withClient, rebrand, total].some(
    v => typeof v === 'number' && v < 0
  );

  const diff = typeof purchased === 'number' ? sumOutbounds - purchased : null;

  if (hasNegative || purchased === 0 || (diff !== null && Math.abs(diff) > 0.01)) {
    negativeOrDiscrepancies.push({
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
      sumOutbounds,
      diff,
      hasNegative,
      remarks
    });
  }
}

console.log(`=== FOUND ${negativeOrDiscrepancies.length} PRODUCTS WITH DISCREPANCIES / NEGATIVE / ZERO PURCHASE IN EXCEL DATA SHEET ===\n`);

for (const item of negativeOrDiscrepancies) {
  console.log(`Product: "${item.name}" [${item.category}]`);
  console.log(`  Purchased: ${item.purchased} | Warehouse: ${item.warehouse} | Issued: ${item.issued} | Used: ${item.used} | Damage: ${item.damage} | Lost: ${item.lost} | With Client: ${item.withClient} | Rebrand: ${item.rebrand} | Total: ${item.total}`);
  console.log(`  Sum of categories: ${item.sumOutbounds} (Diff from Purchased: ${item.diff})`);
  if (item.remarks) console.log(`  Remarks: ${item.remarks}`);
  console.log('---');
}
