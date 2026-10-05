import { getProductsSlim } from '@/app/actions/products';
import { getStores } from '@/app/actions/stores';
import { getBrands } from '@/app/actions/brands';
import { getTransactionsByDeliveryNote } from '@/app/actions/transactions';
import RebrandClient from '../../RebrandClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Edit Stock Rebranding - Inventory System',
  description: 'Edit existing stock rebranding and conversion details',
};

export default async function EditRebrandPage({ params }) {
  const { dn } = await params;
  const decodedDn = decodeURIComponent(dn);

  const [
    products, 
    stores, 
    brands,
    initialItems
  ] = await Promise.all([
    getProductsSlim(),
    getStores(),
    getBrands(),
    getTransactionsByDeliveryNote(decodedDn)
  ]);

  if (!initialItems || initialItems.length === 0) {
    notFound();
  }

  const outTx = initialItems.find(t => t.transactionType === 'REBRAND_OUT' || t.transactionType === 'REBRAND');
  const inTx = initialItems.find(t => t.transactionType === 'REBRAND_IN');

  const sourceProductId = outTx?.productId || initialItems[0]?.productId || '';
  const targetProductId = inTx?.productId || '';
  
  // Extract clean remarks (strip auto-generated rebrand notes prefix)
  let remarks = outTx?.notes || inTx?.notes || '';
  if (remarks) {
    remarks = remarks.replace(/^Rebrand (?:output ->|input <-)[^.]+\.\s*/i, '').trim();
  }

  // Construct mappings for serialized products
  const outSerials = (outTx?.serialNumbers || []).map(s => s.serialNumber).filter(Boolean);
  const inSerials = (inTx?.serialNumbers || []).map(s => s.serialNumber).filter(Boolean);

  const mappings = [];
  if (outSerials.length > 0) {
    outSerials.forEach((s, idx) => {
      let targetBarcode = '';
      if (s.replacedBy?.barcode) {
        targetBarcode = s.replacedBy.barcode;
      } else if (inSerials[idx]) {
        targetBarcode = inSerials[idx].barcode;
      }
      mappings.push({
        sourceBarcode: s.barcode,
        targetBarcode,
        isExpanded: false,
        error: ''
      });
    });
  }

  const nonSerializedQty = String(outTx?.quantity || inTx?.quantity || initialItems[0]?.quantity || 1);

  return (
    <RebrandClient 
      products={products} 
      stores={stores} 
      brands={brands}
      editMode={true}
      existingDn={decodedDn}
      initialSourceProductId={sourceProductId}
      initialTargetProductId={targetProductId}
      initialRemarks={remarks}
      initialMappings={mappings}
      initialNonSerializedQty={nonSerializedQty}
    />
  );
}
