import { prisma } from './prisma';

export async function generateId(modelName, prefix, padding = 3) {
  const records = await prisma[modelName].findMany({
    where: {
      id: {
        startsWith: prefix
      }
    },
    select: {
      id: true
    }
  });

  let maxNum = 0;
  for (const r of records) {
    const parts = r.id.split('-');
    const numPart = parts[parts.length - 1];
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }

  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(padding, '0');
  return `${prefix}-${padded}`;
}
