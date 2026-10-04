const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../generated/prisma/client'));
const prisma = new PrismaClient();

async function run() {
  const brand = await prisma.brand.findFirst({
    where: { name: { contains: 'Sadia', mode: 'insensitive' } },
    include: { products: true }
  });

  if (!brand) {
    console.log('Sadia brand not found');
    return;
  }

  console.log('Found brand:', brand.name, 'with', brand.products.length, 'products');

  const workbook = xlsx.readFile('D:\\movie\\SADIA - INVENTORY FORMAT 1 og (3).xlsx');
  const sheetName = workbook.SheetNames.find(s => s.trim().toUpperCase() === 'SUMMARY');
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const headings = [];
  let currentHeading = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const col0 = String(row[0] || '').trim();
    const col4 = String(row[4] || '').trim(); // remarks

    if (!col0) continue;

    // Check if this is a heading row
    const isHeading = col0 === col0.toUpperCase() && (
      col0.includes('STAND') || col0.includes('OTHERS') || col0.includes('UNIFORM') || 
      col0.includes('APPLIANCES') || col0.includes('UTENSILS') || col0.includes('EXTRAS')
    );

    if (isHeading) {
      currentHeading = {
        id: 'heading-' + (headings.length + 1) + '-' + Math.random().toString(36).substr(2, 5),
        title: col0,
        productIds: [],
        remarks: {}
      };
      headings.push(currentHeading);
      continue;
    }

    if (!currentHeading) {
      currentHeading = {
        id: 'heading-1-' + Math.random().toString(36).substr(2, 5),
        title: 'PROMOTIONAL STAND',
        productIds: [],
        remarks: {}
      };
      headings.push(currentHeading);
    }

    // Match product in brand.products by name
    const prodName = col0.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedProd = brand.products.find(p => {
      const dbName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return dbName === prodName || dbName.includes(prodName) || prodName.includes(dbName);
    });

    if (matchedProd) {
      if (!currentHeading.productIds.includes(matchedProd.id)) {
        currentHeading.productIds.push(matchedProd.id);
        if (col4) {
          currentHeading.remarks[matchedProd.id] = col4;
        }
      }
    }
  }

  // Also make sure any brand products that were not matched get added to OTHERS
  const assignedIds = new Set(headings.flatMap(h => h.productIds));
  const unassigned = brand.products.filter(p => !assignedIds.has(p.id));
  if (unassigned.length > 0) {
    let othersHeading = headings.find(h => h.title.includes('OTHERS') || h.title.includes('EXTRAS'));
    if (!othersHeading) {
      othersHeading = {
        id: 'heading-others-' + Math.random().toString(36).substr(2, 5),
        title: 'OTHERS',
        productIds: [],
        remarks: {}
      };
      headings.push(othersHeading);
    }
    unassigned.forEach(p => {
      othersHeading.productIds.push(p.id);
    });
  }

  console.log('Built', headings.length, 'headings:');
  headings.forEach(h => {
    console.log(' - ' + h.title + ' (' + h.productIds.length + ' products)');
  });

  const configJson = JSON.stringify({ headings });
  await prisma.brand.update({
    where: { id: brand.id },
    data: { portalConfig: configJson }
  });

  console.log('Successfully updated Sadia portalConfig in database!');
}

run().then(() => {
  prisma.$disconnect();
  process.exit(0);
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
