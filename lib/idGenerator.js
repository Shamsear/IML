import { prisma } from './prisma';

export async function generateId(modelName, prefix, padding = 3) {
  const lastRecord = await prisma[modelName].findFirst({
    where: {
      id: {
        startsWith: prefix
      }
    },
    orderBy: {
      id: 'desc'
    },
    select: {
      id: true
    }
  });

  let nextNum = 1;
  if (lastRecord) {
    const parts = lastRecord.id.split('-');
    const numPart = parts[parts.length - 1];
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const padded = String(nextNum).padStart(padding, '0');
  return `${prefix}-${padded}`;
}
