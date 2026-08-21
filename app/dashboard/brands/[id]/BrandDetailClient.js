'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { 
  connectStoreToBrand, 
  disconnectStoreFromBrand, 
  createStoreAndLinkToBrand 
} from '@/app/actions/brands';
import { createProduct, importBarcodes, getProductSerials } from '@/app/actions/products';
import { 
  ArrowLeft, Store, Plus, Package, Edit2, Trash2, QrCode, 
  Loader2, X, Link as LinkIcon, AlertCircle, Camera, Upload, ArrowDownLeft, ArrowUpRight, Share2
} from 'lucide-react';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';

const regions = ['AUH', 'DXB', 'SHJ', 'ALN', 'RAK', 'FUJ', 'UAQ'];

export default function BrandDetailClient({ brand, allStores, supervisors, staff }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

  // Portal link copy state
  const [copied, setCopied] = useState(false);
  const [showPortalAccess, setShowPortalAccess] = useState(false);
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const portalUrl = `${window.location.origin}/portal/brand/${brand.secretKey}`;
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Modals / Panels
  const [activeModal, setActiveModal] = useState(null); // 'connectStore', 'createStore', 'createProduct', 'serials', null
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Bulk Issue States
  const [checkedProductIds, setCheckedProductIds] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);

  // Connect Store Form
  const [storeToConnect, setStoreToConnect] = useState('');

  // Create Store Form
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreRegion, setNewStoreRegion] = useState('DXB');
  const [newStoreLocation, setNewStoreLocation] = useState('');

  // Create Product Form
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('NORMAL'); // 'NORMAL', 'SIM', 'ROUTER'
  const [productCode, setProductCode] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [productCap, setProductCap] = useState('');
  const [productReturnable, setProductReturnable] = useState(false);
  const [productDisposable, setProductDisposable] = useState(false);
  const [productFile, setProductFile] = useState(null);
  const [productRack, setProductRack] = useState('');
  const [productShelf, setProductShelf] = useState('');
  
  // Auto-naming SIM states
  const [simStoreId, setSimStoreId] = useState(brand.stores[0]?.id || '');
  const [simStoreCode, setSimStoreCode] = useState('');
  const [autoGenName, setAutoGenName] = useState(true);

  // Manage Serials states
  const [serialsList, setSerialsList] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [secondaryBarcodeInput, setSecondaryBarcodeInput] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [entryMode, setEntryMode] = useState('SINGLES');
  const [startBarcode, setStartBarcode] = useState('');
  const [endBarcode, setEndBarcode] = useState('');
  const [importQty, setImportQty] = useState(100);
  const [scanInput, setScanInput] = useState('');
  
  // Camera scanning states
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTargetField, setCameraTargetField] = useState('');

  // Filter stores that are NOT already connected
  const unconnectedStores = allStores.filter(
    s => !brand.stores.some(connected => connected.id === s.id)
  );

  // Sync category with product type
  useEffect(() => {
    if (productType === 'NORMAL') {
      if (productCategory.toUpperCase().includes('SIM') || productCategory.toUpperCase().includes('ROUTER')) {
        setProductCategory('');
      }
    } else if (productType === 'SIM') {
      if (!productCategory.toUpperCase().includes('SIM')) {
        setProductCategory('SIM');
      }
    } else if (productType === 'ROUTER') {
      if (!productCategory.toUpperCase().includes('ROUTER')) {
        setProductCategory('ROUTER');
      }
    }
  }, [productType]);

  // Sync SIM auto-name preview
  useEffect(() => {
    if (productType === 'SIM' && autoGenName) {
      const sObj = brand.stores.find(s => s.id === simStoreId);
      if (sObj && simStoreCode) {
        setProductName(`${brand.name} ${simStoreCode.trim()} ${sObj.name}`);
      } else {
        setProductName('');
      }
    }
  }, [productType, simStoreId, simStoreCode, autoGenName, brand.name, brand.stores]);

  const handleConnectStore = async (e) => {
    e.preventDefault();
    if (!storeToConnect) return;
    setLoading(true);
    setError('');
    try {
      await connectStoreToBrand(brand.id, storeToConnect);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to connect store');
      setLoading(false);
    }
  };

  const handleDisconnectStore = async (storeId) => {
    if (!confirm('Are you sure you want to disconnect this store outlet from this brand?')) return;
    setLoading(true);
    setError('');
    try {
      await disconnectStoreFromBrand(brand.id, storeId);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to disconnect store');
      setLoading(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', newStoreName);
    formData.append('region', newStoreRegion);
    formData.append('location', newStoreLocation);
    formData.append('isPublic', 'true');
    try {
      await createStoreAndLinkToBrand(brand.id, formData);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to register store');
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', productName);
    formData.append('itemCode', productCode);
    formData.append('category', productCategory);
    formData.append('stockCap', productCap);
    formData.append('isReturnable', productReturnable.toString());
    formData.append('isDisposable', productDisposable.toString());
    formData.append('isSerialized', (productType !== 'NORMAL').toString());
    formData.append('brandId', brand.id);
    formData.append('rack', productRack);
    formData.append('shelf', productShelf);
    if (productFile) {
      formData.append('imageFile', productFile);
    }
    try {
      await createProduct(formData);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to create product');
      setLoading(false);
    }
  };

  const openSerialsModal = async (product) => {
    setSelectedProduct(product);
    setImportStatus('');
    setBarcodeInput('');
    setSecondaryBarcodeInput('');
    setStartBarcode('');
    setEndBarcode('');
    setActiveModal('serials');
    try {
      const serials = await getProductSerials(product.id);
      setSerialsList(serials);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportSerials = async (e) => {
    e.preventDefault();
    setLoading(true);
    setImportStatus('Uploading...');
    
    let codes = [];
    let secondaryCodes = [];

    if (entryMode === 'SINGLES') {
      codes = barcodeInput.split('\n').map(x => x.trim()).filter(Boolean);
      secondaryCodes = secondaryBarcodeInput.split('\n').map(x => x.trim()).filter(Boolean);
    } else {
      if (!startBarcode.trim()) {
        setImportStatus('Error: Start barcode sequence required.');
        setLoading(false);
        return;
      }
      try {
        const startVal = BigInt(startBarcode.trim());
        const count = entryMode === 'RANGE' 
          ? Number(BigInt(endBarcode.trim()) - startVal + 1n)
          : parseInt(importQty, 10);

        if (isNaN(count) || count <= 0 || count > 5000) {
          setImportStatus('Error: Invalid range count (Limit: 5000 items).');
          setLoading(false);
          return;
        }

        for (let i = 0; i < count; i++) {
          codes.push((startVal + BigInt(i)).toString());
        }
      } catch (err) {
        setImportStatus('Error: Invalid barcode number sequence.');
        setLoading(false);
        return;
      }
    }

    try {
      const result = await importBarcodes(selectedProduct.id, codes, secondaryCodes);
      setImportStatus(`Successfully registered ${result.count} barcodes.`);
      setBarcodeInput('');
      setSecondaryBarcodeInput('');
      setStartBarcode('');
      setEndBarcode('');
      const updated = await getProductSerials(selectedProduct.id);
      setSerialsList(updated);
    } catch (err) {
      setImportStatus(`Error: ${err.message || 'Import failed.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (scanInput.trim()) {
        setBarcodeInput(prev => prev ? `${prev}\n${scanInput.trim()}` : scanInput.trim());
        setScanInput('');
      }
    }
  };

  const calculateStock = (rawTransactions) => {
    const transactions = [...(rawTransactions || [])];

    let totalQtyMarkedUsed = 0;
    transactions.forEach(t => {
      if (t.transactionType === 'ISSUE' && t.fromEntityType !== 'STORE' && t.returnStatus === 'USED') {
        totalQtyMarkedUsed += t.quantity || 0;
      }
    });

    let totalQtyStoreToStaff = 0;
    transactions.forEach(t => {
      if (t.transactionType === 'ISSUE' && t.fromEntityType === 'STORE' && t.toEntityType === 'STAFF') {
        totalQtyStoreToStaff += t.quantity || 0;
      }
    });

    const virtualQty = Math.max(0, totalQtyMarkedUsed - totalQtyStoreToStaff);
    if (virtualQty > 0) {
      transactions.push({
        transactionType: 'ISSUE',
        fromEntityType: 'STORE',
        toEntityType: 'STAFF',
        quantity: virtualQty,
      });
    }

    let purchased = 0;
    let warehouse = 0;
    let issued = 0;
    let used = 0;
    let withClient = 0;
    let damage = 0;
    let lost = 0;
    let reBrand = 0;
    
    transactions.forEach(t => {
      const qty = t.quantity || 0;
      if (t.transactionType === 'RECEIVE') {
        purchased += qty;
        warehouse += qty;
      } else if (t.transactionType === 'ISSUE') {
        if (t.fromEntityType === 'STORE') {
          issued -= qty;
          if (t.toEntityType === 'STAFF') used += qty;
        } else {
          warehouse -= qty;
          if (t.toEntityType === 'STORE' || t.toEntityType === 'SUPERVISOR') issued += qty;
          else if (t.toEntityType === 'STAFF') used += qty;
          else if (t.toEntityType === 'CLIENT' || t.toEntityType === 'BRAND') withClient += qty;
        }
      } else if (t.transactionType === 'CLIENT_RETURN') {
        warehouse -= qty;
        withClient += qty;
      } else if (t.transactionType === 'RETURN') {
        warehouse += qty;
        if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
      } else if (t.transactionType === 'DAMAGE') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
        damage += qty;
      } else if (t.transactionType === 'LOST') {
        if (t.fromEntityType === 'WAREHOUSE') warehouse -= qty;
        else if (t.fromEntityType === 'STORE' || t.fromEntityType === 'SUPERVISOR') issued -= qty;
        else if (t.fromEntityType === 'STAFF') used -= qty;
        else if (t.fromEntityType === 'CLIENT' || t.fromEntityType === 'BRAND') withClient -= qty;
        lost += qty;
      } else if (t.transactionType === 'REBRAND_OUT') {
        warehouse -= qty;
        reBrand += qty;
      } else if (t.transactionType === 'REBRAND_IN') {
        warehouse += qty;
      }
    });

    const total = warehouse + issued + used + damage + lost + withClient + reBrand;

    return { purchased, warehouse, issued, used, damage, lost, withClient, reBrand, total };
  };

  const itemsPerPage = 25;
  const totalPages = Math.ceil(brand.products.length / itemsPerPage);
  const paginatedProducts = brand.products.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
  const uniqueCategories = Array.from(new Set(brand.products.map(p => p.category).filter(Boolean)));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/brands" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors flex-shrink-0">
            <ArrowLeft size={16} />
          </Link>
          
          {brand.imageUrl ? (
            <img 
              src={getOptimizedImageUrl(brand.imageUrl, 120, 120)} 
              alt={brand.name} 
              className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-border flex-shrink-0 cursor-pointer hover:border-primary transition-all shadow-sm"
              onClick={() => setLightboxImage({ url: brand.imageUrl, name: brand.name })}
              onError={(e) => {
                if (e.target.src !== brand.imageUrl) {
                  e.target.src = brand.imageUrl;
                }
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-extrabold text-lg flex-shrink-0 border border-primary/20">
              {brand.name.substring(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
              {brand.name} Control Panel
            </h1>
            <p className="text-text-secondary text-sm mt-1">{brand.description || 'Campaign details, store mapping, and product catalog'}</p>
            {(brand.rack || brand.shelf) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/10 mt-2 select-none">
                Default Location: {brand.rack ? `Rack ${brand.rack}` : ''}{brand.rack && brand.shelf ? ', ' : ''}{brand.shelf ? `Shelf ${brand.shelf}` : ''}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap lg:justify-end items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => { setStoreToConnect(''); setError(''); setActiveModal('connectStore'); }}>
            <LinkIcon size={14} />
            <span>Link Outlet</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => { setNewStoreName(''); setNewStoreLocation(''); setError(''); setActiveModal('createStore'); }}>
            <Store size={14} />
            <span>Register &amp; Link Outlet</span>
          </button>
          <button 
            type="button" 
            className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold transition-all duration-200 ${
              showPortalAccess 
                ? 'bg-primary/10 border-primary/20 text-primary' 
                : 'bg-surface border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary'
            }`} 
            onClick={() => setShowPortalAccess(!showPortalAccess)}
          >
            <Share2 size={14} />
            <span>Portal Access</span>
          </button>
          <Link href={`/dashboard/products/new?brandId=${brand.id}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all duration-200">
            <Plus size={14} />
            <span>Add Product</span>
          </Link>
        </div>
      </header>

      {success && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-sm font-semibold animate-slide-down">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-4 text-sm font-semibold flex items-center gap-2 animate-slide-down">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Brand Portal Share Card (Collapsible) */}
      {showPortalAccess && (
        <div className="bg-surface border border-primary/25 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-down">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <QrCode size={16} className="text-primary animate-pulse-once" />
              <h4 className="font-display font-bold text-sm text-text-primary">Brand Partner Portal Link</h4>
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Provide your brand client with this secure link to view their catalog products, live stocks, inbound dispatches, and warehouse ledger logs.
            </p>
            <span className="text-xs font-mono font-semibold text-primary truncate block select-all mt-1.5 bg-primary/5 px-2.5 py-1 rounded border border-primary/10">
              {typeof window !== 'undefined' ? `${window.location.origin}/portal/brand/${brand.secretKey}` : `/portal/brand/${brand.secretKey}`}
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end flex-shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={`/portal/brand/${brand.secretKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center"
            >
              Preview
            </a>
          </div>
        </div>
      )}

      {/* 2. Catalog Products Section */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h3 className="font-display font-bold text-lg text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <Package size={18} className="text-primary" />
          <span>Catalog Products ({brand.products.length})</span>
        </h3>
        {brand.products.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">
            No products registered for this brand. Click &quot;Add Product&quot; to define catalog items.
          </div>
        ) : (
          <>
          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3">
            {paginatedProducts.map(product => {
              const stock = calculateStock(product.transactions);
              return (
                <div key={product.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input type="checkbox" className="custom-checkbox mt-0.5" checked={checkedProductIds.includes(product.id)} onChange={(e) => { if (e.target.checked) setCheckedProductIds(prev => [...prev, product.id]); else setCheckedProductIds(prev => prev.filter(id => id !== product.id)); }} />
                      {product.imageUrl ? (
                        <img src={getOptimizedImageUrl(product.imageUrl, 80, 80)} alt={product.name} className="w-10 h-10 rounded-lg object-contain bg-background p-0.5 border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Package size={18} /></div>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-text-primary block truncate">{product.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-text-muted font-mono">{product.itemCode || '---'}</span>
                          <span className="badge bg-surface-elevated text-text-secondary border border-border text-[9px]">{product.category || '---'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-lg text-primary flex-shrink-0">{stock.total}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-2 border-t border-border/50">
                    <div><span className="text-text-muted block">Warehouse</span><span className="font-mono font-bold text-sm">{stock.warehouse}</span></div>
                    <div><span className="text-text-muted block">Issued</span><span className="font-mono font-bold text-sm">{stock.issued}</span></div>
                    <div><span className="text-text-muted block">Used</span><span className="font-mono font-bold text-sm">{stock.used}</span></div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/inbound/new?productIds=${product.id}`} className="text-success font-semibold hover:underline inline-flex items-center gap-0.5"><ArrowDownLeft size={11} /> Recv</Link>
                      <Link href={`/dashboard/outbound/new?productIds=${product.id}`} className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5"><ArrowUpRight size={11} /> Issue</Link>
                    </div>
                    {product.isSerialized && (
                      <button className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5" onClick={() => openSerialsModal(product)} type="button"><QrCode size={11} /> SIM ({product._count?.serialNumbers || 0})</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                    <th className="py-3 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface-sticky z-20">
                      <input 
                        type="checkbox" 
                        className="custom-checkbox"
                        checked={checkedProductIds.length === brand.products.length && brand.products.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCheckedProductIds(brand.products.map(p => p.id));
                          } else {
                            setCheckedProductIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 px-5 whitespace-nowrap sticky left-8 bg-surface-sticky z-20 border-r border-border shadow-sm">Item Description</th>
                    <th className="py-3 px-5 whitespace-nowrap">Item Code</th>
                    <th className="py-3 px-5 whitespace-nowrap">Item category</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Purchased / Received</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Available In Warehouse</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Issued</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Used</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-danger">Damage</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-danger">Lost / Not Found</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-primary">With Client</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap text-secondary">Re Brand</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap font-bold">Total</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Stock Status</th>
                    <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-primary">
                  {paginatedProducts.map(product => {
                    const stock = calculateStock(product.transactions);
                    return (
                      <tr key={product.id} className="hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none/20 transition-colors group/row">
                        <td className="py-3.5 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10">
                          <input 
                            type="checkbox" 
                            className="custom-checkbox"
                            checked={checkedProductIds.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCheckedProductIds(prev => [...prev, product.id]);
                              } else {
                                setCheckedProductIds(prev => prev.filter(id => id !== product.id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap sticky left-8 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img 
                                src={getOptimizedImageUrl(product.imageUrl, 80, 80)} 
                                alt={product.name} 
                                className="w-8 h-8 rounded-lg object-contain bg-background p-0.5 border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxImage({ url: product.imageUrl, name: product.name });
                                }}
                                onError={(e) => {
                                  if (e.target.src !== product.imageUrl) {
                                    e.target.src = product.imageUrl;
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                <Package size={15} />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-text-primary truncate">{product.name}</span>
                              {((product.rack || product.shelf) || (brand.rack || brand.shelf)) && (
                                <span className="text-[10px] text-text-muted mt-0.5 font-medium">
                                  Loc: {product.rack || brand.rack ? `Rack ${product.rack || brand.rack}` : ''}{(product.rack || brand.rack) && (product.shelf || brand.shelf) ? ', ' : ''}{product.shelf || brand.shelf ? `Shelf ${product.shelf || brand.shelf}` : ''}
                                </span>
                              )}
                              {product.isSerialized && (
                                <div className="has-tooltip self-start">
                                  <button 
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline mt-0.5 animate-fade-in" 
                                    onClick={() => openSerialsModal(product)}
                                    type="button"
                                  >
                                    <QrCode size={11} />
                                    <span>{product.category?.toUpperCase().includes('ROUTER') ? 'Router' : 'SIM'} ({product._count?.serialNumbers || 0})</span>
                                  </button>
                                  <span className="tooltip-box">Registered barcodes index</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded border border-border">{product.itemCode || '---'}</code>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="badge bg-surface-elevated text-text-secondary border border-border">
                            {product.category || '---'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap">{stock.purchased}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap">{stock.warehouse}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap">{stock.issued}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap">{stock.used}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap text-danger">{stock.damage}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap text-danger">{stock.lost}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap text-primary">{stock.withClient}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-semibold whitespace-nowrap text-secondary">{stock.reBrand}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold whitespace-nowrap">{stock.total}</td>
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          {product.stockCap ? (
                            stock.warehouse <= 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full font-mono">
                                Out
                              </span>
                            ) : stock.warehouse < product.stockCap ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-warning/10 text-warning border border-warning/20 rounded-full font-mono animate-pulse">
                                Low
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-success/10 text-success border border-success/20 rounded-full font-mono">
                                Ok
                              </span>
                            )
                          ) : (
                            <span className="text-text-muted text-xs">---</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-3">
                            <div className="has-tooltip">
                              <Link href={`/dashboard/inbound/new?productIds=${product.id}`} className="text-xs font-semibold text-success hover:underline inline-flex items-center gap-0.5">
                                <ArrowDownLeft size={12} />
                                <span>Recv</span>
                              </Link>
                              <span className="tooltip-box tooltip-left">Inbound stock log</span>
                            </div>
                            {brand.stores.length > 0 && (
                              <div className="has-tooltip">
                                <Link href={`/dashboard/outbound/new?productIds=${product.id}`} className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5">
                                  <ArrowUpRight size={12} />
                                  <span>Issue</span>
                                </Link>
                                <span className="tooltip-box tooltip-left">Outbound stock dispatch</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
                <span className="text-text-muted">
                  Showing <strong className="text-text-primary">{currentPage * itemsPerPage + 1}</strong> to{" "}
                  <strong className="text-text-primary">
                    {Math.min((currentPage + 1) * itemsPerPage, brand.products.length)}
                  </strong> of{" "}
                  <strong className="text-text-primary">{brand.products.length}</strong> products
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* 1. Connected Outlets Section (moved to bottom) */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <h3 className="font-display font-bold text-lg text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <Store size={18} className="text-secondary" />
          <span>Connected Outlets ({brand.stores.length})</span>
        </h3>
        {brand.stores.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-muted">
            No store outlets linked. Click &quot;Link Outlet&quot; above to assign stores.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brand.stores.map(store => (
              <div key={store.id} className="p-4 bg-surface-elevated/40 border border-black/5 rounded-xl flex justify-between items-center hover:border-border transition-all duration-200">
                <div className="min-w-0">
                  <span className="font-semibold text-sm text-text-primary truncate block">{store.name}</span>
                  <span className="text-xs text-text-secondary mt-1 block">
                    {store.region || 'DXB'} — {store.location || 'No physical address'}
                  </span>
                </div>
                <button 
                  className="px-2.5 py-1.5 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-md text-xs font-semibold transition-all duration-200 ml-4 flex-shrink-0" 
                  onClick={() => handleDisconnectStore(store.id)}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Connect Store Modal */}
      {activeModal === 'connectStore' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[400px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-lg text-text-primary">Connect Store</h3>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConnectStore} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Select Store</label>
                <CustomSelect
                  options={unconnectedStores.map(s => ({ value: s.id, label: `${s.name} (${s.region})` }))}
                  value={storeToConnect}
                  onChange={(val) => setStoreToConnect(val)}
                  placeholder="Choose store..."
                  required
                />
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors" disabled={loading || unconnectedStores.length === 0}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>Link Store</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Store Modal */}
      {activeModal === 'createStore' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[420px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-lg text-text-primary">Register &amp; Link Store</h3>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStore} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Outlet Name</label>
                <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} placeholder="e.g. Carrefour Reem Mall" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Region</label>
                  <CustomSelect
                    options={regions.map(r => ({ value: r, label: r }))}
                    value={newStoreRegion}
                    onChange={(val) => setNewStoreRegion(val)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Coordinates</label>
                  <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" value={newStoreLocation} onChange={(e) => setNewStoreLocation(e.target.value)} placeholder="Coordinates" />
                </div>
              </div>
              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors" disabled={loading}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>Register Store</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Product Modal */}
      {activeModal === 'createProduct' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[500px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-lg text-text-primary">Add Brand Product</h3>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Product Type / Serialization</label>
                <div className="flex gap-4 mt-0.5">
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                    <input type="radio" name="prodType" value="NORMAL" checked={productType === 'NORMAL'} onChange={() => setProductType('NORMAL')} className="text-primary focus:ring-primary/20" />
                    <span>Normal (No Serials)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                    <input type="radio" name="prodType" value="SIM" checked={productType === 'SIM'} onChange={() => setProductType('SIM')} className="text-primary focus:ring-primary/20" />
                    <span>SIM (Bulk Barcodes)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                    <input type="radio" name="prodType" value="ROUTER" checked={productType === 'ROUTER'} onChange={() => setProductType('ROUTER')} className="text-primary focus:ring-primary/20" />
                    <span>Router (IMEI Singles)</span>
                  </label>
                </div>
              </div>

              {productType === 'SIM' && (
                <div className="p-3 bg-surface-elevated/50 border border-dashed border-border rounded-lg flex flex-col gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
                    <input type="checkbox" checked={autoGenName} onChange={(e) => setAutoGenName(e.target.checked)} className="custom-checkbox" />
                    <span>Auto-generate Product Name from Store Details</span>
                  </label>
                  {autoGenName && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase">Store Code</label>
                        <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none" value={simStoreCode} onChange={(e) => setSimStoreCode(e.target.value)} placeholder="e.g. VMGS0023" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-text-secondary uppercase">Select Store</label>
                        <CustomSelect
                          options={brand.stores.map(s => ({ value: s.id, label: s.name }))}
                          value={simStoreId}
                          onChange={(val) => setSimStoreId(val)}
                          size="sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Product Name</label>
                <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={autoGenName && productType === 'SIM' ? "Will auto-generate..." : "e.g. T-Shirt Medium"} required disabled={autoGenName && productType === 'SIM'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">SKU / Code</label>
                  <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g. SKU-1234" />
                </div>
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-text-secondary">Category</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={productCategory}
                      onChange={(e) => { setProductCategory(e.target.value); setShowCategorySuggestions(true); }}
                      onFocus={() => setShowCategorySuggestions(true)}
                    onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); const next = e.target.nextElementSibling; if (next && next.tagName === 'DIV') { const btns = next.querySelectorAll('button'); if (btns.length > 0) btns[0].focus(); } } }}
                      onBlur={(e) => { if (e.relatedTarget && e.relatedTarget.getAttribute('data-smart') === 'true') return; setTimeout(() => setShowCategorySuggestions(false), 250); }}
                      placeholder="Category"
                    />
                    {showCategorySuggestions && (() => {
                      const list = ['Stands', 'Uniforms', 'Gifts', 'Disposables', ...uniqueCategories];
                      const unique = Array.from(new Set(list));
                      const filtered = productCategory ? unique.filter(c => c.toLowerCase().includes(productCategory.toLowerCase())) : unique;
                      return filtered.length > 0;
                    })() && (
                      <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                        {(() => {
                          const list = ['Stands', 'Uniforms', 'Gifts', 'Disposables', ...uniqueCategories];
                          const unique = Array.from(new Set(list));
                          return productCategory ? unique.filter(c => c.toLowerCase().includes(productCategory.toLowerCase())) : unique;
                        })().map((cat, catIdx) => (
                          <button
                            key={catIdx}
                            type="button" data-smart="true" onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const btns = Array.from(e.target.parentElement.querySelectorAll('button')); const idx = btns.indexOf(e.target); if (e.key === 'ArrowDown' && idx < btns.length - 1) btns[idx + 1].focus(); else if (e.key === 'ArrowUp') { if (idx > 0) btns[idx - 1].focus(); else e.target.parentElement.previousElementSibling?.focus(); } } }} 
                            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary transition-colors border-b border-border last:border-0 font-medium font-semibold"
                            onClick={() => {
                              setProductCategory(cat);
                              setShowCategorySuggestions(false);
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Upload Product Image</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  onChange={(e) => setProductFile(e.target.files[0] || null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Cap Threshold</label>
                  <input type="number" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" value={productCap} onChange={(e) => setProductCap(e.target.value)} placeholder="Max Limit" />
                </div>
                <div className="flex items-center gap-6 mt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer">
                    <input type="checkbox" checked={productReturnable} onChange={(e) => setProductReturnable(e.target.checked)} className="custom-checkbox" />
                    <span>Returnable Item</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary cursor-pointer">
                    <input type="checkbox" checked={productDisposable} onChange={(e) => setProductDisposable(e.target.checked)} className="custom-checkbox" />
                    <span>Disposable (Single Use)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Warehouse Rack (Optional)</label>
                  <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" value={productRack} onChange={(e) => setProductRack(e.target.value)} placeholder="e.g. Rack A" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Warehouse Shelf (Optional)</label>
                  <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" value={productShelf} onChange={(e) => setProductShelf(e.target.value)} placeholder="e.g. Shelf 3" />
                </div>
              </div>

              <button type="submit" className="w-full inline-flex items-center justify-center gap-2 mt-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors" disabled={loading}>
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>Create Product</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Manage Serials Modal */}
      {activeModal === 'serials' && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[850px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="font-display font-bold text-lg text-text-primary">Manage Barcodes: {selectedProduct.name}</h3>
                <p className="text-xs text-text-secondary mt-0.5">Import and lookup barcodes.</p>
              </div>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            {importStatus && (
              <div className={`p-3 rounded-lg text-xs font-semibold text-center ${
                importStatus.includes('Error') 
                  ? 'bg-danger/10 text-danger border border-danger/20' 
                  : 'bg-success/10 text-success border border-success/20'
              }`}>
                {importStatus}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-sm text-text-primary">Register Barcodes</h4>
                {selectedProduct.category?.toUpperCase().includes('SIM') && (
                  <div className="flex bg-surface-elevated border border-border p-1 rounded-lg">
                    {['SINGLES', 'RANGE', 'COUNT'].map(m => (
                      <button 
                        key={m} 
                        type="button" 
                        className={`flex-1 text-[11px] font-bold py-1.5 rounded transition-all duration-200
                          ${entryMode === m 
                            ? 'bg-primary text-white shadow-sm' 
                            : 'text-text-secondary hover:text-text-primary'
                          }`}
                        onClick={() => { setEntryMode(m); setStartBarcode(''); setEndBarcode(''); }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleImportSerials} className="flex flex-col gap-4">
                  {entryMode === 'SINGLES' ? (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Scan Barcode (Keyboard/Scanner)</label>
                        <div className="flex gap-2">
                          <input type="text" className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={handleScanInputKeyDown} placeholder="Scan &amp; press enter..." />
                          <button type="button" className="px-3 bg-surface-elevated border border-border hover:bg-surface-hover rounded-lg text-text-secondary transition-colors" onClick={() => { setCameraTargetField('barcodeInput'); setIsCameraModalOpen(true); }}><Camera size={15} /></button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Primary Barcodes list</label>
                        <textarea className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" rows={4} value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} placeholder="One barcode per line..." required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Secondary Barcodes (Optional)</label>
                        <textarea className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" rows={2} value={secondaryBarcodeInput} onChange={(e) => setSecondaryBarcodeInput(e.target.value)} placeholder="Match line-for-line..." />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">First Barcode</label>
                        <div className="flex gap-2">
                          <input type="text" className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={startBarcode} onChange={(e) => setStartBarcode(e.target.value)} placeholder="Start sequence" required />
                          <button type="button" className="px-3 bg-surface-elevated border border-border hover:bg-surface-hover rounded-lg text-text-secondary transition-colors" onClick={() => { setCameraTargetField('startBarcode'); setIsCameraModalOpen(true); }}><Camera size={15} /></button>
                        </div>
                      </div>
                      {entryMode === 'RANGE' ? (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Last Barcode</label>
                          <div className="flex gap-2">
                            <input type="text" className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={endBarcode} onChange={(e) => setEndBarcode(e.target.value)} placeholder="End sequence" required />
                            <button type="button" className="px-3 bg-surface-elevated border border-border hover:bg-surface-hover rounded-lg text-text-secondary transition-colors" onClick={() => { setCameraTargetField('endBarcode'); setIsCameraModalOpen(true); }}><Camera size={15} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Quantity to auto-generate</label>
                          <input type="number" className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" value={importQty} onChange={(e) => setImportQty(e.target.value)} min={1} required />
                        </div>
                      )}
                    </>
                  )}
                  <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold transition-colors" disabled={loading}>
                    <Upload size={14} /> 
                    <span>Upload Barcodes</span>
                  </button>
                </form>
              </div>
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-sm text-text-primary">Registered Barcodes ({serialsList.length})</h4>
                <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead>
                      <tr className="text-left font-bold text-text-secondary uppercase bg-surface-elevated">
                        <th className="p-2.5">Barcode</th>
                        <th className="p-2.5">Location</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-text-primary">
                      {serialsList.map(s => (
                        <tr key={s.id} className="hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none/40">
                          <td className="p-2.5"><code>{s.barcode}</code></td>
                          <td className="p-2.5">{s.currentLocationType}</td>
                          <td className="p-2.5 text-center">
                            <span className={`badge text-[9px] px-1.5 py-0.5 ${s.status === 'AVAILABLE' ? 'badge-success' : 'badge-danger'}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Checked Items Actions Bar */}
      {checkedProductIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface/95 border border-primary/40 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-6 backdrop-blur-md animate-slide-up max-w-[90vw] md:max-w-xl">
          <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
            <strong>{checkedProductIds.length}</strong> items selected
          </span>
          <div className="flex gap-2.5">
            <button 
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-success/15 hover:bg-success text-success hover:text-white border border-success/30 rounded-lg text-xs font-semibold transition-all duration-200"
              onClick={() => router.push(`/dashboard/inbound/new?productIds=${checkedProductIds.join(',')}`)}
            >
              <ArrowDownLeft size={13} />
              <span>Bulk Receive</span>
            </button>
            <button 
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/15 hover:bg-primary text-primary hover:text-white border border-primary/30 rounded-lg text-xs font-semibold transition-all duration-200"
              onClick={() => router.push(`/dashboard/outbound/new?productIds=${checkedProductIds.join(',')}`)}
            >
              <ArrowUpRight size={13} />
              <span>Bulk Issue</span>
            </button>
          </div>
          <button 
            className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setCheckedProductIds([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-pointer select-none"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X size={20} />
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[80vh] flex flex-col items-center gap-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/15 animate-scale-up"
            />
            <span className="text-white text-sm font-semibold tracking-wide text-center">
              {lightboxImage.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
