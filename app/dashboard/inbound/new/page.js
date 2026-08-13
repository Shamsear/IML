import { getProductsSlim } from '@/app/actions/products';
import { getRecentReceivers, getRecentSuppliers } from '@/app/actions/transactions';
import { getBrands } from '@/app/actions/brands';
import { getStores } from '@/app/actions/stores';
import InboundClient from '../InboundClient';

export const metadata = {
  title: 'New Inbound Receipt - Inventory System',
  description: 'Log inbound supplier inventory receipts',
};

export default async function NewInboundPage() {
  const [
    products,
    recentReceivers,
    recentSuppliers,
    brands,
    stores
  ] = await Promise.all([
    getProductsSlim(),
    getRecentReceivers(),
    getRecentSuppliers(),
    getBrands(),
    getStores()
  ]);

  return (
    <InboundClient 
      products={products} 
      recentReceivers={recentReceivers}
      recentSuppliers={recentSuppliers}
      brands={brands}
      stores={stores}
    />
  );
}
