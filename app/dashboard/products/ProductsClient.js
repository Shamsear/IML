'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { 
  createProduct, updateProduct, deleteProduct, importBarcodes, getProductSerials,
  bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts 
} from '@/app/actions/products';
import { createTransaction } from '@/app/actions/transactions';
import { 
  Package, Plus, Edit2, Trash2, ShieldAlert, CheckCircle, 
  QrCode, Upload, Filter, Loader2, X, Search,
  Copy, Trash, Camera, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

const shirtSizes = ['Small', 'Medium', 'Large', 'Xl', 'X-large', 'Xref', 'Xxl'];

export default function ProductsClient({ initialProducts, brands, stores = [] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [activePanel, setActivePanel] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productFile, setProductFile] = useState(null);
  
  // Quick stock addition states
  const [addQtyProduct, setAddQtyProduct] = useState(null);
  const [addQtyValue, setAddQtyValue] = useState('');
  const [addQtyDN, setAddQtyDN] = useState('');
  const [addQtyDeliveryFrom, setAddQtyDeliveryFrom] = useState('');
  const [addQtyNotes, setAddQtyNotes] = useState('');
  const [addQtyError, setAddQtyError] = useState('');
  const [isReturnable, setIsReturnable] = useState(false);
  const [isDisposable, setIsDisposable] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSerialized, setIsSerialized] = useState(false);
  const [productType, setProductType] = useState('NORMAL'); // 'NORMAL', 'SIM', 'ROUTER'
  const [stockCap, setStockCap] = useState('');

  // Sync serialization and category defaults with productType
  useEffect(() => {
    if (productType === 'NORMAL') {
      setIsSerialized(false);
    } else {
      setIsSerialized(true);
      if (productType === 'SIM' && !category.toUpperCase().includes('SIM')) {
        setCategory('SIM');
      } else if (productType === 'ROUTER' && !category.toUpperCase().includes('ROUTER')) {
        setCategory('ROUTER');
      }
    }
  }, [productType]);

  const [serialProduct, setSerialProduct] = useState(null);
  const [serialsList, setSerialsList] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [secondaryBarcodeInput, setSecondaryBarcodeInput] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [serialSearch, setSerialSearch] = useState('');

  // Auto-naming states for SIM
  const [simBrandId, setSimBrandId] = useState(brands[0]?.id || '');
  const [simStoreId, setSimStoreId] = useState(stores[0]?.id || '');
  const [simStoreCode, setSimStoreCode] = useState('');
  const [autoGenName, setAutoGenName] = useState(true);

  // Barcode import series states
  const [entryMode, setEntryMode] = useState('SINGLES'); // 'SINGLES', 'RANGE', 'COUNT'
  const [startBarcode, setStartBarcode] = useState('');
  const [endBarcode, setEndBarcode] = useState('');
  const [importQty, setImportQty] = useState(100);
  const [scanInput, setScanInput] = useState('');

  // Camera scanner states
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraTargetField, setCameraTargetField] = useState(''); // 'barcodeInput', 'startBarcode', 'endBarcode'

  // Update product name when brand/store changes in SIM mode
  useEffect(() => {
    if (category.toUpperCase().includes('SIM') && autoGenName) {
      const bObj = brands.find(b => b.id === simBrandId);
      const sObj = stores.find(s => s.id === simStoreId);
      if (bObj && sObj && simStoreCode) {
        setName(`${bObj.name} ${simStoreCode.trim()} ${sObj.name}`);
      } else {
        setName('');
      }
    }
  }, [category, simBrandId, simStoreId, simStoreCode, autoGenName, brands, stores]);

  // Camera scanner lifecycle
  useEffect(() => {
    let html5QrcodeScanner = null;
    if (isCameraModalOpen) {
      const initScanner = async () => {
        try {
          const { Html5QrcodeScanner } = await import('html5-qrcode');
          html5QrcodeScanner = new Html5QrcodeScanner(
            "camera-reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
          );
          
          html5QrcodeScanner.render(
            (decodedText) => {
              if (cameraTargetField === 'barcodeInput') {
                setBarcodeInput(prev => prev ? `${prev}\n${decodedText}` : decodedText);
              } else if (cameraTargetField === 'startBarcode') {
                setStartBarcode(decodedText);
              } else if (cameraTargetField === 'endBarcode') {
                setEndBarcode(decodedText);
              }
              setIsCameraModalOpen(false);
            },
            (err) => {
              // Ignore scanning errors
            }
          );
        } catch (err) {
          console.error("Failed to init scanner:", err);
        }
      };
      
      initScanner();
    }
    
    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [isCameraModalOpen, cameraTargetField]);

  const [csvInput, setCsvInput] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError] = useState('');

  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 25;

  const openAddModal = () => {
    setEditingProduct(null);
    setName(''); setBrandId(brands[0]?.id || ''); setItemCode(''); setCategory('STANDS');
    setImageUrl(''); setIsReturnable(false); setIsPublic(true); setIsSerialized(false); setProductType('NORMAL'); setStockCap('');
    setProductFile(null);
    setSimBrandId(brands[0]?.id || ''); setSimStoreId(stores[0]?.id || ''); setSimStoreCode(''); setAutoGenName(true);
    setError(''); setActivePanel('form');
  };

  const openEditModal = (product) => {
    router.push(`/dashboard/products/new?editId=${product.id}`);
  };

  const openCSVModal = () => { setCsvInput(''); setCsvPreview([]); setCsvError(''); setError(''); setActivePanel('csv'); };

  const handleCSVParse = (text) => {
    setCsvError('');
    if (!text.trim()) { setCsvPreview([]); return; }
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
      const headers = lines[0].split(/[\t,]/).map(h => h.trim().toLowerCase());
      ['name', 'brandname'].forEach(req => { if (!headers.includes(req)) throw new Error(`Missing column: "${req}"`); });
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/[\t,]/).map(v => v.trim());
        const rowObj = {};
        headers.forEach((header, index) => { rowObj[header] = values[index] || ''; });
        const matchedBrand = brands.find(b => b.name.toLowerCase() === rowObj['brandname'].toLowerCase());
        if (!matchedBrand) throw new Error(`Row ${i + 1}: Brand "${rowObj['brandname']}" not found.`);
        parsed.push({
          name: rowObj['name'], brandId: matchedBrand.id, brandName: matchedBrand.name,
          itemCode: rowObj['itemcode'] || null, category: rowObj['category'] || 'STANDS',
          isReturnable: rowObj['isreturnable']?.toLowerCase() === 'true' || rowObj['isreturnable'] === '1',
          isSerialized: rowObj['isserialized']?.toLowerCase() === 'true' || rowObj['isserialized'] === '1',
          stockCap: rowObj['stockcap'] ? parseInt(rowObj['stockcap'], 10) : null
        });
      }
      setCsvPreview(parsed);
    } catch (err) { setCsvError(err.message); setCsvPreview([]); }
  };

  const handleCSVFileUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { const text = event.target?.result; if (typeof text === 'string') { setCsvInput(text); handleCSVParse(text); } };
    reader.readAsText(file);
  };

  const handleCSVSubmit = async () => {
    if (csvPreview.length === 0) return;
    setLoading(true); setCsvError('');
    try { const count = await bulkCreateProducts(csvPreview); alert(`Imported ${count} products!`); window.location.reload(); }
    catch (err) { setCsvError(err.message); setLoading(false); }
  };

  const handleBulkUpdate = async (updateData) => {
    if (selectedProductIds.length === 0) return;
    setLoading(true);
    try {
      await bulkUpdateProducts(selectedProductIds, updateData);
      setProducts(prev => prev.map(p => {
        if (selectedProductIds.includes(p.id)) {
          const updated = { ...p };
          if (updateData.brandId !== undefined) { updated.brandId = updateData.brandId; updated.brand = brands.find(b => b.id === updateData.brandId) || updated.brand; }
          if (updateData.category !== undefined) updated.category = updateData.category;
          if (updateData.isReturnable !== undefined) updated.isReturnable = updateData.isReturnable;
          if (updateData.isPublic !== undefined) updated.isPublic = updateData.isPublic;
          return updated;
        }
        return p;
      }));
      setSelectedProductIds([]); alert('Updated!');
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Delete ${selectedProductIds.length} selected products?`)) return;
    setLoading(true);
    try { await bulkDeleteProducts(selectedProductIds); setProducts(prev => prev.filter(p => !selectedProductIds.includes(p.id))); setSelectedProductIds([]); }
    catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const handleBulkDuplicate = async () => {
    if (selectedProductIds.length === 0) return;
    setLoading(true);
    try {
      const clonedList = selectedProductIds.map(id => {
        const prod = products.find(p => p.id === id);
        return { name: `${prod.name} (Copy)`, brandId: prod.brandId, itemCode: prod.itemCode ? `${prod.itemCode}-COPY` : null, category: prod.category || 'STANDS', isReturnable: prod.isReturnable, isPublic: prod.isPublic, isSerialized: prod.isSerialized, stockCap: prod.stockCap };
      });
      const count = await bulkCreateProducts(clonedList); alert(`Duplicated ${count} products!`); window.location.reload();
    } catch (err) { alert(err.message); setLoading(false); }
  };

  const openSerialModal = async (product) => {
    setSerialProduct(product); setBarcodeInput(''); setSecondaryBarcodeInput(''); setImportStatus(''); setSerialSearch('');
    setEntryMode('SINGLES'); setStartBarcode(''); setEndBarcode(''); setImportQty(100); setScanInput('');
    setLoading(true);
    try { const serials = await getProductSerials(product.id); setSerialsList(serials); setActivePanel('serials'); }
    catch { alert('Failed to load serials.'); } finally { setLoading(false); }
  };



  const handleAddQtySubmit = async (e) => {
    e.preventDefault();
    if (!addQtyValue || parseInt(addQtyValue, 10) <= 0) {
      setAddQtyError('Please enter a valid quantity.');
      return;
    }
    setLoading(true);
    setAddQtyError('');
    try {
      await createTransaction({
        productId: addQtyProduct.id,
        transactionType: 'RECEIVE',
        fromEntityType: 'SUPPLIER',
        fromEntityId: addQtyDeliveryFrom,
        toEntityType: 'WAREHOUSE',
        quantity: parseInt(addQtyValue, 10),
        deliveryNote: addQtyDN || null,
        notes: addQtyNotes || 'Direct manual stock add',
      });
      alert(`Added ${addQtyValue} units of ${addQtyProduct.name} to Warehouse successfully!`);
      setAddQtyProduct(null);
      window.location.reload();
    } catch (err) {
      setAddQtyError(err.message || 'Failed to add quantity.');
      setLoading(false);
    }
  };

  const handleImportSerials = async (e) => {
    e.preventDefault();
    setLoading(true); setImportStatus('');
    let barcodes = [];
    if (entryMode === 'SINGLES') {
      if (!barcodeInput.trim()) {
        setImportStatus('Error: Barcodes input is empty');
        setLoading(false);
        return;
      }
      barcodes = barcodeInput.split(/[\n,]/).map(b => b.trim()).filter(b => b.length > 0);
    } else {
      if (!startBarcode.trim()) {
        setImportStatus('Error: Start barcode is empty');
        setLoading(false);
        return;
      }
      try {
        const startNum = BigInt(startBarcode.trim());
        let qty = 0;
        if (entryMode === 'COUNT') {
          qty = parseInt(importQty, 10);
        } else {
          if (!endBarcode.trim()) {
            throw new Error('End barcode is empty');
          }
          const endNum = BigInt(endBarcode.trim());
          qty = Number(endNum - startNum + 1n);
        }

        if (isNaN(qty) || qty <= 0) {
          throw new Error('Invalid barcode range or quantity');
        }
        if (qty > 5000) {
          throw new Error('Cannot import more than 5000 barcodes at once');
        }

        for (let i = 0n; i < BigInt(qty); i++) {
          barcodes.push((startNum + i).toString());
        }
      } catch (err) {
        setImportStatus(`Error: ${err.message}`);
        setLoading(false);
        return;
      }
    }

    const secondaryBarcodes = secondaryBarcodeInput.split(/[\n,]/).map(b => b.trim()).filter(b => b.length > 0);
    try {
      const count = await importBarcodes(serialProduct.id, barcodes, secondaryBarcodes);
      setImportStatus(`Imported ${count} barcodes!`); setBarcodeInput(''); setSecondaryBarcodeInput('');
      setStartBarcode(''); setEndBarcode('');
      const serials = await getProductSerials(serialProduct.id); setSerialsList(serials);
    } catch (err) { setImportStatus(`Error: ${err.message}`); } finally { setLoading(false); }
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this product and all stock transactions?')) return;
    setLoading(true);
    try { await deleteProduct(id); setProducts(prev => prev.filter(p => p.id !== id)); }
    catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  const filteredProducts = products.filter(p => {
    const matchesBrand = brandFilter === 'ALL' || p.brandId === brandFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesBrand && matchesSearch;
  });

  // Reset pagination on brand filter or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [brandFilter, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
  const filteredSerials = serialsList.filter(s =>
    s.barcode.toLowerCase().includes(serialSearch.toLowerCase()) ||
    (s.secondaryBarcode && s.secondaryBarcode.toLowerCase().includes(serialSearch.toLowerCase())) ||
    (s.status && s.status.toLowerCase().includes(serialSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Package size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inventory Catalog
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Define bulk goods and serialized accessories (SIM cards, stands, uniforms).
          </p>
        </div>
        {!activePanel && (
          <div className="flex gap-2.5">
            <div className="has-tooltip">
              <button 
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" 
                onClick={openCSVModal}
                type="button"
              >
                <Upload size={14} /> <span>Import CSV</span>
              </button>
              <span className="tooltip-box">Import catalog items via CSV</span>
            </div>
            <div className="has-tooltip">
              <Link 
                href="/dashboard/products/new" 
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus size={16} /> <span>Add Product</span>
              </Link>
              <span className="tooltip-box">Create a new catalog item</span>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">


        {/* CSV Panel */}
        {activePanel === 'csv' && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="font-display font-bold text-lg text-text-primary">Bulk Product Import</h2>
                <p className="text-xs text-text-secondary mt-0.5">Upload CSV or paste spreadsheet data.</p>
              </div>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => setActivePanel(null)}>
                <X size={18} />
              </button>
            </div>
            
            {csvError && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold text-center animate-slide-down">
                {csvError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Select CSV File</label>
                <input type="file" accept=".csv,.txt" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none" onChange={handleCSVFileUpload} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Or Paste CSV Data</label>
                <textarea className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" rows={5} value={csvInput} onChange={(e) => { setCsvInput(e.target.value); handleCSVParse(e.target.value); }}
                  placeholder={"Name,BrandName,ItemCode,Category,IsReturnable,IsSerialized,StockCap\nSadia Uniform,Sadia,SAD-UNI,UNIFORMS,true,false,100"} />
                <span className="text-[10px] text-text-muted mt-0.5">Brand names must match database records exactly.</span>
              </div>
              {csvPreview.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="font-bold text-xs text-text-primary">Preview ({csvPreview.length} items)</h4>
                  <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                    <table className="min-w-full divide-y divide-border text-xs">
                      <thead>
                        <tr className="text-left font-bold text-text-secondary bg-surface-elevated">
                          <th className="p-2">Name</th>
                          <th className="p-2">Brand</th>
                          <th className="p-2">Code</th>
                          <th className="p-2">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-text-primary">
                        {csvPreview.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="hover:bg-surface-elevated/40">
                            <td className="p-2">{row.name}</td>
                            <td className="p-2">{row.brandName}</td>
                            <td className="p-2"><code>{row.itemCode || '---'}</code></td>
                            <td className="p-2">{row.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <div className="p-2 text-center text-xs text-text-muted border-t border-border bg-surface-elevated/20">
                        +{csvPreview.length - 10} more items...
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setActivePanel(null)} disabled={loading}>Cancel</button>
                <button type="button" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" onClick={handleCSVSubmit} disabled={loading || csvPreview.length === 0}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>Import {csvPreview.length} Products</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Serials Manage Panel */}
        {activePanel === 'serials' && serialProduct && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="font-display font-bold text-lg text-text-primary">Manage Barcodes: {serialProduct.name}</h2>
                <p className="text-xs text-text-secondary mt-0.5">Register, upload and lookup barcodes for this device.</p>
              </div>
              <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => setActivePanel(null)}>
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
                {serialProduct.category?.toUpperCase().includes('SIM') && (
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
                  <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold transition-colors mt-2" disabled={loading}>
                    <Upload size={14} /> 
                    <span>Upload Barcodes</span>
                  </button>
                </form>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-sm text-text-primary">Registered ({filteredSerials.length})</h4>
                  <input type="text" className="bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none w-36 sm:w-48" placeholder="Search serials..." value={serialSearch} onChange={(e) => setSerialSearch(e.target.value)} />
                </div>
                <div className="max-h-[350px] overflow-y-auto border border-border rounded-lg">
                  {filteredSerials.length === 0 ? (
                    <div className="p-12 text-center text-xs text-text-muted">No serials found matching search.</div>
                  ) : (
                    <table className="min-w-full divide-y divide-border text-xs">
                      <thead>
                        <tr className="text-left font-bold text-text-secondary uppercase bg-surface-elevated">
                          <th className="p-2.5">Barcode</th>
                          <th className="p-2.5">Secondary</th>
                          <th className="p-2.5">Location</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-text-primary">
                        {filteredSerials.map(s => (
                          <tr key={s.id} className="hover:bg-surface-elevated/40">
                            <td className="p-2.5"><code>{s.barcode}</code></td>
                            <td className="p-2.5 text-text-muted">{s.secondaryBarcode || '---'}</td>
                            <td className="p-2.5">{s.currentLocationType}</td>
                            <td className="p-2.5 text-center">
                              <span className={`badge text-[9px] px-1.5 py-0.5 ${
                                s.status === 'AVAILABLE' ? 'badge-success' : s.status === 'USED' ? 'badge-info' : 'badge-danger'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {isCameraModalOpen && (
              <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] shadow-lg flex flex-col gap-4 animate-slide-down">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h3 className="font-display font-bold text-sm text-text-primary">Scan Barcode</h3>
                    <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => setIsCameraModalOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div id="camera-reader" className="w-full rounded-lg overflow-hidden border border-border"></div>
                  <p className="text-[10px] text-text-secondary text-center">Align the barcode inside the camera viewfinder.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products List Pane */}
        <div className="w-full flex flex-col gap-4">
          {/* Filters & Search Bar */}
          <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 sm:gap-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end flex-1 w-full max-w-2xl">
              {/* Search Input */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Search Catalog</label>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
                  <input
                    type="text"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-4 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-[34px]"
                  />
                </div>
              </div>

              {/* Brand Filter */}
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Filter by Brand</label>
                <CustomSelect
                  options={[{ value: 'ALL', label: 'All Brands' }, ...brands.map(brand => ({ value: brand.id, label: brand.name }))]}
                  value={brandFilter}
                  onChange={(val) => setBrandFilter(val)}
                  size="sm"
                />
              </div>
            </div>
            <span className="text-xs font-semibold text-text-muted pb-2">{filteredProducts.length} products total</span>
          </div>

          {/* Bulk Update / Duplicate Bar */}
          {selectedProductIds.length > 0 && (
            <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 animate-slide-down">
              <span className="text-xs font-semibold text-text-primary">
                <strong>{selectedProductIds.length}</strong> items selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <CustomSelect
                  options={brands.map(b => ({ value: b.id, label: b.name }))}
                  onChange={(val) => { if (val) handleBulkUpdate({ brandId: val }); }}
                  placeholder="Set Brand..."
                  size="sm"
                  className="w-[140px]"
                />
                <CustomSelect
                  options={[
                    { value: 'STANDS', label: 'STANDS' },
                    { value: 'SIMS', label: 'SIMS' },
                    { value: 'UNIFORMS', label: 'UNIFORMS' },
                    { value: 'GIFTS', label: 'GIFTS' },
                  ]}
                  onChange={(val) => { if (val) handleBulkUpdate({ category: val }); }}
                  placeholder="Set Category..."
                  size="sm"
                  className="w-[140px]"
                />
                <div className="has-tooltip">
                  <button 
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/15 hover:bg-success text-success hover:text-white border border-success/20 rounded-lg text-xs font-bold transition-all duration-200" 
                    onClick={() => router.push(`/dashboard/inbound/new?productIds=${selectedProductIds.join(',')}`)}
                  >
                    <ArrowDownLeft size={13} /> 
                    <span>Bulk Receive</span>
                  </button>
                  <span className="tooltip-box">Create bulk inbound note</span>
                </div>
                <div className="has-tooltip">
                  <button 
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded-lg text-xs font-bold transition-all duration-200" 
                    onClick={() => router.push(`/dashboard/outbound/new?productIds=${selectedProductIds.join(',')}`)}
                  >
                    <ArrowUpRight size={13} /> 
                    <span>Bulk Issue</span>
                  </button>
                  <span className="tooltip-box">Create bulk outbound note</span>
                </div>
                <div className="has-tooltip">
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={handleBulkDuplicate} type="button">
                    <Copy size={12} /> 
                    <span>Clone</span>
                  </button>
                  <span className="tooltip-box">Clone selected products</span>
                </div>
                <div className="has-tooltip">
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/30 rounded-lg text-xs font-semibold transition-all duration-200" onClick={handleBulkDelete} type="button">
                    <Trash size={12} /> 
                    <span>Delete</span>
                  </button>
                  <span className="tooltip-box">Delete selected products</span>
                </div>
                <button className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors ml-2" onClick={() => setSelectedProductIds([])} type="button">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Products Table Wrapper */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm bg-surface">
                <Package size={48} />
                <h3 className="font-display font-bold text-lg text-text-primary">No Products Registered</h3>
                <p className="text-sm max-w-xs">Define your products to start tracking stock levels.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <th className="py-3 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface-sticky z-20">
                          <input type="checkbox" className="custom-checkbox" checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                            onChange={(e) => { e.target.checked ? setSelectedProductIds(filteredProducts.map(p => p.id)) : setSelectedProductIds([]); }} />
                        </th>
                        <th className="py-3 px-3 sm:px-5 sticky left-8 bg-surface-sticky z-20 border-r border-border shadow-sm">Product Details</th>
                        <th className="py-3 px-3 sm:px-5 hidden lg:table-cell">Code (SKU)</th>
                        <th className="py-3 px-3 sm:px-5">Brand</th>
                        <th className="py-3 px-3 sm:px-5 text-center">Stock</th>
                        <th className="py-3 px-3 sm:px-5 hidden md:table-cell">Type</th>
                        <th className="py-3 px-3 sm:px-5 hidden lg:table-cell">Category</th>
                        <th className="py-3 px-3 sm:px-5 hidden md:table-cell">Returnable</th>
                        <th className="py-3 px-3 sm:px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {paginatedProducts.map(product => (
                        <tr 
                          key={product.id} 
                          className="hover:bg-surface-elevated/30 transition-all duration-150 cursor-pointer group/row"
                          onClick={() => openEditModal(product)}
                        >
                          <td className="py-3.5 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="custom-checkbox" checked={selectedProductIds.includes(product.id)}
                              onChange={(e) => { e.target.checked ? setSelectedProductIds(prev => [...prev, product.id]) : setSelectedProductIds(prev => prev.filter(id => id !== product.id)); }} />
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap sticky left-8 bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm">
                            <div className="flex items-center gap-2.5">
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
                                {((product.rack || product.shelf) || (product.brand?.rack || product.brand?.shelf)) && (
                                  <span className="text-[10px] text-text-muted mt-0.5 font-medium">
                                    Loc: {product.rack || product.brand?.rack ? `Rack ${product.rack || product.brand?.rack}` : ''}{(product.rack || product.brand?.rack) && (product.shelf || product.brand?.shelf) ? ', ' : ''}{product.shelf || product.brand?.shelf ? `Shelf ${product.shelf || product.brand?.shelf}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 font-mono text-xs text-text-secondary whitespace-nowrap hidden lg:table-cell">{product.itemCode || '---'}</td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap">
                            <span className="badge bg-secondary/15 text-secondary border border-secondary/10">
                              {product.brand.name}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap text-center">
                            {product.stockCap ? (
                              product.warehouseStock <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full">
                                  0 / Out of Stock
                                </span>
                              ) : product.warehouseStock < product.stockCap ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-warning/10 text-warning border border-warning/20 rounded-full animate-pulse">
                                  {product.warehouseStock} / Low (Cap: {product.stockCap})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-success/10 text-success border border-success/20 rounded-full">
                                  {product.warehouseStock} / Ok
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-surface-elevated text-text-primary border border-border rounded-full font-mono">
                                {product.warehouseStock}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap hidden md:table-cell">
                            {product.isSerialized ? (
                              <button 
                                className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${
                                  product.category?.toUpperCase().includes('ROUTER') ? 'text-secondary' : 'text-primary'
                                }`} 
                                onClick={(e) => { e.stopPropagation(); openSerialModal(product); }}
                                type="button"
                              >
                                <QrCode size={13} />
                                <span>{product.category?.toUpperCase().includes('ROUTER') ? 'Router' : 'SIM'} ({product._count.serialNumbers})</span>
                              </button>
                            ) : (
                              <span className="text-xs text-text-muted">Normal</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap hidden lg:table-cell">
                            <span className="badge bg-surface-elevated text-text-secondary border border-border">
                              {product.category || 'STANDS'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap hidden md:table-cell">
                            {product.isReturnable ? (
                              <span className="badge badge-warning text-[10px]"><ShieldAlert size={10} /> Yes</span>
                            ) : (
                              <span className="badge badge-success text-[10px]"><CheckCircle size={10} /> No</span>
                            )}
                          </td>
                           <td className="py-3.5 px-3 sm:px-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {!product.isSerialized && (
                                <div className="has-tooltip">
                                  <button 
                                    className="inline-flex items-center gap-0.5 px-2 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded text-xs font-semibold transition-colors"
                                    onClick={() => {
                                      setAddQtyProduct(product);
                                      setAddQtyValue('');
                                      setAddQtyDN('');
                                      setAddQtyDeliveryFrom('');
                                      setAddQtyNotes('');
                                      setAddQtyError('');
                                    }}
                                    type="button"
                                  >
                                    <Plus size={11} /> 
                                    <span>Stock</span>
                                  </button>
                                  <span className="tooltip-box tooltip-left">Quick receive warehouse stock</span>
                                </div>
                              )}
                              <div className="has-tooltip">
                                <button type="button" className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors" onClick={() => openEditModal(product)}>
                                  <Edit2 size={13} />
                                </button>
                                <span className="tooltip-box tooltip-left">Edit product settings</span>
                              </div>
                              <div className="has-tooltip">
                                <button type="button" className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors" onClick={() => handleDelete(product.id)}>
                                  <Trash2 size={13} />
                                </button>
                                <span className="tooltip-box tooltip-left">Delete product and stock ledger</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-elevated/20 text-xs">
                    <span className="text-text-muted">
                      Showing <strong className="text-text-primary">{currentPage * itemsPerPage + 1}</strong> to{" "}
                      <strong className="text-text-primary">
                        {Math.min((currentPage + 1) * itemsPerPage, filteredProducts.length)}
                      </strong> of{" "}
                      <strong className="text-text-primary">{filteredProducts.length}</strong> products
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                        className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={currentPage === totalPages - 1}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                        className="px-2.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated disabled:opacity-50 text-text-secondary disabled:hover:bg-surface disabled:hover:text-text-secondary rounded-lg font-semibold transition-all duration-200"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        {addQtyProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <form onSubmit={handleAddQtySubmit} className="bg-surface border border-border rounded-xl p-6 w-full max-w-[420px] shadow-lg flex flex-col gap-4 animate-slide-down">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="font-display font-bold text-lg text-text-primary">Add Warehouse Stock</h3>
                <button type="button" className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => setAddQtyProduct(null)}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-text-secondary">
                Product: <strong className="text-text-primary font-semibold">{addQtyProduct.name}</strong>
              </p>
              
              {addQtyError && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold text-center animate-slide-down">
                  {addQtyError}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Quantity to Add</label>
                <input 
                  type="number" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                  value={addQtyValue} 
                  onChange={(e) => setAddQtyValue(e.target.value)} 
                  placeholder="e.g. 50" 
                  min="1" 
                  required 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Delivery From (Supplier / Vendor)</label>
                <input 
                  type="text" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                  value={addQtyDeliveryFrom} 
                  onChange={(e) => setAddQtyDeliveryFrom(e.target.value)} 
                  placeholder="e.g. Sadia Factory, UAE Distributor" 
                  required 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Receive Note (Optional)</label>
                <input 
                  type="text" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                  value={addQtyDN} 
                  onChange={(e) => setAddQtyDN(e.target.value)} 
                  placeholder="e.g. DN-99882" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Remarks / Notes</label>
                <input 
                  type="text" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                  value={addQtyNotes} 
                  onChange={(e) => setAddQtyNotes(e.target.value)} 
                  placeholder="e.g. Additional production arrival" 
                />
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setAddQtyProduct(null)} disabled={loading}>Cancel</button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" disabled={loading}>
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  <span>Add Stock</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

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
  </div>
  );
}


