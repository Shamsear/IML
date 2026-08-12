import { getProductsSlim } from '@/app/actions/products';
import { getRecentReceivers, getRecentSuppliers } from '@/app/actions/transactions';
import InboundClient from '../InboundClient';

export const metadata = {
  title: 'New Inbound Receipt - Inventory System',
  description: 'Log inbound supplier inventory receipts',
};

export default async function NewInboundPage() {
  const [
    products,
    recentReceivers,
    recentSuppliers
  ] = await Promise.all([
    getProductsSlim(),
    getRecentReceivers(),
    getRecentSuppliers()
  ]);

  return (
    <InboundClient 
      products={products} 
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
    />
  );
}
