import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderToStream } from '@react-pdf/renderer';
import { InventoryReportDocument } from '@/lib/pdf/inventoryReport';
import { getProductStock } from '@/lib/stock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const brandIdQuery = searchParams.get('brandId') || 'ALL';
    const categoryQuery = searchParams.get('category') || 'ALL';
    const searchQuery = searchParams.get('search') || '';

    // Fetch Brand and Category metadata
    let brandName = 'All Brands';
    if (brandIdQuery && brandIdQuery !== 'ALL') {
      const brandObj = await prisma.brand.findUnique({ where: { id: brandIdQuery } });
      if (brandObj) brandName = brandObj.name;
    }

    const categoryName = categoryQuery && categoryQuery !== 'ALL' ? categoryQuery : 'All Categories';

    // Fetch Products, Transaction aggregates, and Serial aggregates concurrently
    const [products, aggregates, serialAggs] = await Promise.all([
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          itemCode: true,
          category: true,
          brandId: true,
          isSerialized: true,
          brand: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' }
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['productId', 'transactionType', 'fromEntityType', 'toEntityType', 'returnStatus'],
        _sum: {
          quantity: true,
        },
      }),
      prisma.productSerialNumber.groupBy({
        by: ['productId', 'status', 'currentLocationType'],
        _count: { id: true }
      })
    ]);

    // Map database aggregates to products
    const aggsMap = new Map();
    aggregates.forEach(agg => {
      if (!aggsMap.has(agg.productId)) {
        aggsMap.set(agg.productId, []);
      }
      aggsMap.get(agg.productId).push(agg);
    });

    const serialsMap = new Map();
    serialAggs.forEach(item => {
      if (!serialsMap.has(item.productId)) {
        serialsMap.set(item.productId, {
          warehouse: 0,
          issued: 0,
          used: 0,
          withClient: 0,
          damage: 0,
          lost: 0
        });
      }
      const stats = serialsMap.get(item.productId);
      const count = item._count.id || 0;
      const status = item.status;
      const loc = item.currentLocationType;

      if (status === 'AVAILABLE') {
        if (loc === 'STORE') {
          stats.issued += count;
        } else {
          stats.warehouse += count;
        }
      } else if (status === 'WITH_CLIENT' || loc === 'CLIENT' || loc === 'BRAND') {
        stats.withClient += count;
      } else if (status === 'DAMAGED') {
        stats.damage += count;
      } else if (status === 'LOST') {
        stats.lost += count;
      } else if (status === 'USED' || loc === 'STAFF') {
        stats.used += count;
      }
    });

    // Compute stock calculations for each product
    const computedProducts = products.map(product => {
      const productAggs = aggsMap.get(product.id) || [];
      const fakeTransactions = productAggs.map(agg => ({
        transactionType: agg.transactionType,
        quantity: agg._sum.quantity || 0,
        fromEntityType: agg.fromEntityType,
        toEntityType: agg.toEntityType,
        returnStatus: agg.returnStatus,
      }));

      const stock = getProductStock(fakeTransactions);
      if (product.isSerialized && serialsMap.has(product.id)) {
        const sStats = serialsMap.get(product.id);
        stock.warehouse = sStats.warehouse;
        stock.withClient = sStats.withClient;
        stock.damage = sStats.damage;
        stock.lost = sStats.lost;
        stock.issued = sStats.issued;
        stock.used = sStats.used;
        stock.total = stock.warehouse;
      }

      return {
        ...product,
        stock
      };
    });

    // Filter matching criteria
    const filteredProducts = computedProducts.filter(p => {
      const matchesSearch = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBrand = brandIdQuery === 'ALL' || p.brandId === brandIdQuery;
      const matchesCategory = categoryQuery === 'ALL' || p.category === categoryQuery;
      return matchesSearch && matchesBrand && matchesCategory;
    });

    // Summary calculations
    const summary = filteredProducts.reduce((acc, p) => {
      acc.purchased += p.stock.purchased;
      acc.warehouse += p.stock.warehouse;
      acc.issued += p.stock.issued;
      acc.used += p.stock.used;
      acc.damage += p.stock.damage;
      acc.lost += p.stock.lost;
      acc.withClient += p.stock.withClient;
      acc.reBrand += p.stock.reBrand;
      acc.total += p.stock.total;
      return acc;
    }, { purchased: 0, warehouse: 0, issued: 0, used: 0, damage: 0, lost: 0, withClient: 0, reBrand: 0, total: 0 });

    const generatedDate = new Date().toLocaleString('en-AE', { 
      timeZone: 'Asia/Dubai',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const showImages = searchParams.get('images') === '1' || searchParams.get('images') === 'true' || searchParams.get('showImages') === 'true';

    const pdfStream = await renderToStream(
      <InventoryReportDocument
        title="GLOBAL STOCK SUMMARY REPORT"
        brandName={brandName}
        categoryName={categoryName}
        generatedDate={generatedDate}
        products={filteredProducts}
        summary={summary}
        showImages={showImages}
      />
    );

    const safeBrand = brandName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="IML-Stock-Report-${safeBrand}-${dateStr}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[PDF Report Generation Error]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
