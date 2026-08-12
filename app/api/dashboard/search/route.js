import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  // 1. Strict Security Check - No session, no data!
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ products: [], stores: [], staff: [], serials: [] });
  }

  const cleanQuery = query.trim();

  try {
    // 2. Perform concurrent searches in PostgreSQL with optimized indexes
    const [products, stores, staff, serials] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery, mode: 'insensitive' } },
            { itemCode: { contains: cleanQuery, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          brand: {
            select: { name: true }
          }
        }
      }),
      prisma.store.findMany({
        where: {
          name: { contains: cleanQuery, mode: 'insensitive' },
        },
        take: 5,
        select: {
          id: true,
          name: true,
          region: true
        }
      }),
      prisma.staff.findMany({
        where: {
          name: { contains: cleanQuery, mode: 'insensitive' },
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true
        }
      }),
      prisma.productSerialNumber.findMany({
        where: {
          OR: [
            { barcode: { contains: cleanQuery, mode: 'insensitive' } },
            { secondaryBarcode: { contains: cleanQuery, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          barcode: true,
          currentLocationType: true,
          product: {
            select: { name: true }
          }
        }
      })
    ]);

    return NextResponse.json({ products, stores, staff, serials });
  } catch (error) {
    console.error('[Search API Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
