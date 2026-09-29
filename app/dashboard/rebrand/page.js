import { prisma } from '@/lib/prisma';
import RebrandLedgerClient from './RebrandLedgerClient';

export const metadata = {
  title: 'Stock Rebranding Ledger - Inventory System',
  description: 'Log and review stock rebranding campaigns',
};

export default async function RebrandPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const pageSize = 25;

  const [transactions, totalCount] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where: {
        transactionType: { in: ['REBRAND_OUT', 'REBRAND_IN'] },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            brand: { select: { name: true } }
          }
        },
        serialNumbers: {
          select: {
            serialNumber: { select: { barcode: true } }
          }
        }
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({
      where: {
        transactionType: { in: ['REBRAND_OUT', 'REBRAND_IN'] },
      }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formattedTransactions = transactions.map(tx => ({
    ...tx,
    timestamp: tx.timestamp.toISOString(),
  }));

  return (
    <RebrandLedgerClient
      transactions={formattedTransactions}
      totalCount={totalCount}
      totalPages={totalPages}
      page={page}
      pageSize={pageSize}
    />
  );
}
