'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import EmptyState from '@/components/EmptyState';
import { 
  createProduct, updateProduct, deleteProduct, importBarcodes, getProductSerials,
  bulkCreateProducts, bulkUpdateProducts, bulkDeleteProducts 
} from '@/app/actions/products';
import { createTransaction } from '@/app/actions/transactions';
import { 
  Package, Plus, Edit2, Trash2, ShieldAlert, CheckCircle, 
  QrCode, Upload, Filter, Loader2, X, Search,
  Copy, Trash, Camera, ArrowDownLeft, ArrowUpRight,
  FileText, CheckSquare, Square, Eye, Image as ImageIcon, Download
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import ExportToExcel from '@/components/ExportToExcel';
import ImageLightbox from '@/components/ImageLightbox';
import Pagination from '@/components/Pagination';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import SortableHeader from '@/components/SortableHeader';
import ScrollableTable from '@/components/ScrollableTable';
import { useTableSort } from '@/hooks/useTableSort';
import { usePermissions } from '@/hooks/usePermissions';

const shirtSizes = ['Small', 'Medium', 'Large', 'Xl', 'X-large', 'Xref', 'Xxl'];

const PDF_AVAILABLE_COLUMNS = [
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Category' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'issued', label: 'Issued' },
  { key: 'used', label: 'Used' },
  { key: 'damage', label: 'Damage' },
  { key: 'lost', label: 'Lost' },
  { key: 'withClient', label: 'With Client' },
  { key: 'reBrand', label: 'Rebrand' },
  { key: 'total', label: 'Total Stock' },
];

export default function ProductsClient({ initialProducts, brands, stores = [] }) {
  const router = useRouter();
  const toast = useToast();
  const { isReadOnly } = usePermissions();
  const [products, setProducts] = useState(initialProducts);
  const [activePanel, setActivePanel] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [error, setError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', danger: false, onConfirm: null });

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

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
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Precompute unique categories from products
  const categoryOptions = useMemo(() => {
    const set = new Set();
    (products || []).forEach(p => {
      if (p.category) set.add(p.category);
    });
    return [
      { value: 'ALL', label: 'All Categories' },
      ...Array.from(set).sort().map(cat => ({ value: cat, label: cat }))
    ];
  }, [products]);

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
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
      
      // Parse CSV line respecting quotes
      const parseRow = (line) => {
        const result = [];
        let curr = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === '\t') && !inQuotes) {
            result.push(curr.trim().replace(/^"(.*)"$/, '$1').trim());
            curr = '';
          } else {
            curr += char;
          }
        }
        result.push(curr.trim().replace(/^"(.*)"$/, '$1').trim());
        return result;
      };

      const rawHeaders = parseRow(lines[0]);
      const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

      // Find column indices using alias maps
      const findHeaderIndex = (aliases) => {
        const cleanAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return normalizedHeaders.findIndex(h => cleanAliases.includes(h));
      };

      const nameIdx = findHeaderIndex(['name', 'productname', 'product', 'itemname', 'item', 'title']);
      const brandIdx = findHeaderIndex(['brandname', 'brand', 'brandtitle']);
      const itemCodeIdx = findHeaderIndex(['itemcode', 'code', 'sku', 'skucode', 'partnumber']);
      const categoryIdx = findHeaderIndex(['category', 'cat', 'type', 'producttype']);
      const sizeIdx = findHeaderIndex(['size', 'uniformsize', 'shirtsize']);
      const returnableIdx = findHeaderIndex(['isreturnable', 'returnable', 'canreturn']);
      const disposableIdx = findHeaderIndex(['isdisposable', 'disposable', 'singleuse']);
      const serializedIdx = findHeaderIndex(['isserialized', 'serialized', 'hasserial', 'hasserials']);
      const stockCapIdx = findHeaderIndex(['stockcap', 'cap', 'maxstock', 'limit', 'stocklimit']);

      if (nameIdx === -1) {
        throw new Error('Missing "Product Name" or "Name" column in CSV header.');
      }
      if (brandIdx === -1) {
        throw new Error('Missing "Brand" or "Brand Name" column in CSV header.');
      }

      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseRow(lines[i]);
        if (values.every(v => !v)) continue; // skip empty rows

        const prodName = values[nameIdx] || '';
        const brandVal = values[brandIdx] || '';

        if (!prodName) throw new Error(`Row ${i + 1}: Product name cannot be empty.`);
        if (!brandVal) throw new Error(`Row ${i + 1}: Brand name cannot be empty.`);

        const cleanBrandVal = brandVal.toLowerCase().trim();
        const matchedBrand = brands.find(b => 
          b.name.toLowerCase().trim() === cleanBrandVal || 
          b.id.toLowerCase().trim() === cleanBrandVal
        );

        if (!matchedBrand) {
          const available = brands.map(b => b.name).slice(0, 5).join(', ');
          throw new Error(`Row ${i + 1}: Brand "${brandVal}" not found. Available brands include: ${available}...`);
        }

        const isRet = returnableIdx !== -1 ? (values[returnableIdx]?.toLowerCase() === 'true' || values[returnableIdx] === '1' || values[returnableIdx]?.toLowerCase() === 'yes') : false;
        const isDisp = disposableIdx !== -1 ? (values[disposableIdx]?.toLowerCase() === 'true' || values[disposableIdx] === '1' || values[disposableIdx]?.toLowerCase() === 'yes') : false;
        const isSer = serializedIdx !== -1 ? (values[serializedIdx]?.toLowerCase() === 'true' || values[serializedIdx] === '1' || values[serializedIdx]?.toLowerCase() === 'yes') : false;
        const stockCapVal = stockCapIdx !== -1 && values[stockCapIdx] ? parseInt(values[stockCapIdx], 10) : null;

        parsed.push({
          name: prodName,
          brandId: matchedBrand.id,
          brandName: matchedBrand.name,
          itemCode: itemCodeIdx !== -1 ? (values[itemCodeIdx] || null) : null,
          category: categoryIdx !== -1 ? (values[categoryIdx] || 'STANDS') : 'STANDS',
          size: sizeIdx !== -1 ? (values[sizeIdx] || null) : null,
          isReturnable: isRet,
          isDisposable: isDisp,
          isSerialized: isSer,
          stockCap: isNaN(stockCapVal) ? null : stockCapVal,
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
    try { const count = await bulkCreateProducts(csvPreview); toast.success('Import Complete', `${count} products imported successfully.`); router.refresh(); }
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
          if (updateData.isDisposable !== undefined) updated.isDisposable = updateData.isDisposable;
          if (updateData.isPublic !== undefined) updated.isPublic = updateData.isPublic;
          return updated;
        }
        return p;
      }));
      setSelectedProductIds([]);
      toast.success('Products Updated', 'Bulk update applied successfully.');
      router.refresh();
    } catch (err) { toast.error('Update Failed', err.message); } finally { setLoading(false); }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    setConfirmData({
      title: `Delete ${count} Products?`,
      message: `This will permanently delete ${count} selected product${count > 1 ? 's' : ''} and all their stock transactions.`,
      danger: true,
      confirmLabel: 'Delete Products',
      onConfirm: async () => {
        setLoading(true);
        try { 
          await bulkDeleteProducts(selectedProductIds); 
          setProducts(prev => prev.filter(p => !selectedProductIds.includes(p.id))); 
          setSelectedProductIds([]); 
          toast.success('Products Deleted', `${count} products removed.`); 
          router.refresh();
        }
        catch (err) { toast.error('Delete Failed', err.message); } finally { setLoading(false); }
      },
    });
    setConfirmOpen(true);
  };

  const handleBulkDuplicate = async () => {
    if (selectedProductIds.length === 0) return;
    setLoading(true);
    try {
      const clonedList = selectedProductIds.map(id => {
        const prod = products.find(p => p.id === id);
        return { name: `${prod.name} (Copy)`, brandId: prod.brandId, itemCode: prod.itemCode ? `${prod.itemCode}-COPY` : null, category: prod.category || 'STANDS', isReturnable: prod.isReturnable, isPublic: prod.isPublic, isSerialized: prod.isSerialized, stockCap: prod.stockCap };
      });
      const count = await bulkCreateProducts(clonedList); toast.success('Products Duplicated', `${count} copies created.`); router.refresh();
    } catch (err) { toast.error('Duplicate Failed', err.message); setLoading(false); }
  };

  const openSerialModal = async (product) => {
    setSerialProduct(product); setBarcodeInput(''); setSecondaryBarcodeInput(''); setImportStatus(''); setSerialSearch('');
    setEntryMode('SINGLES'); setStartBarcode(''); setEndBarcode(''); setImportQty(100); setScanInput('');
    setLoading(true);
    try { const serials = await getProductSerials(product.id); setSerialsList(serials); setActivePanel('serials'); }
    catch { toast.error('Load Failed', 'Could not load serial numbers.'); } finally { setLoading(false); }
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
      toast.success('Stock Added', `${addQtyValue} units of ${addQtyProduct.name} added to Warehouse.`);
      setAddQtyProduct(null);
      router.refresh();
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

  const handleDelete = (id) => {
    setConfirmData({
      title: 'Delete Product?',
      message: 'This will permanently delete this product and all stock transactions.',
      danger: true,
      confirmLabel: 'Delete Product',
      onConfirm: async () => {
        setLoading(true);
        try { 
          await deleteProduct(id); 
          setProducts(prev => prev.filter(p => p.id !== id)); 
          toast.success('Product Deleted', 'Product and all transactions removed.'); 
          router.refresh();
        }
        catch (err) { toast.error('Delete Failed', err.message); } finally { setLoading(false); }
      },
    });
    setConfirmOpen(true);
  };

  const filteredProducts = products.filter(p => {
    const matchesBrand = brandFilter === 'ALL' || p.brandId === brandFilter;
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.itemCode && p.itemCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesBrand && matchesCategory && matchesSearch;
  });

  const productCustomGetters = useMemo(() => ({
    name: (p) => p.name || '',
    itemCode: (p) => p.itemCode || '',
    brand: (p) => p.brand?.name || '',
    stock: (p) => p.warehouseStock ?? 0,
    type: (p) => (p.isSerialized ? 'Serialized' : 'Bulk'),
    category: (p) => p.category || '',
    isReturnable: (p) => (p.isReturnable ? 1 : 0),
    isDisposable: (p) => (p.isDisposable ? 1 : 0),
    trackExpiry: (p) => (p.trackExpiry ? 1 : 0),
  }), []);

  const {
    sortedItems: sortedProducts,
    sortField: productSortField,
    sortDirection: productSortDirection,
    handleSort: handleProductSort,
  } = useTableSort(filteredProducts, 'name', 'asc', productCustomGetters);

  // Reset pagination on brand, category filter or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [brandFilter, categoryFilter, searchQuery]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const filteredSerials = serialsList.filter(s =>
    s.barcode.toLowerCase().includes(serialSearch.toLowerCase()) ||
    (s.secondaryBarcode && s.secondaryBarcode.toLowerCase().includes(serialSearch.toLowerCase())) ||
    (s.status && s.status.toLowerCase().includes(serialSearch.toLowerCase()))
  );

  const {
    sortedItems: sortedSerials,
    sortField: serialSortField,
    sortDirection: serialSortDirection,
    handleSort: handleSerialSort,
  } = useTableSort(filteredSerials, 'barcode', 'asc');

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfSelectedCols, setPdfSelectedCols] = useState(() => PDF_AVAILABLE_COLUMNS.map(c => c.key));
  const [pdfIncludeImages, setPdfIncludeImages] = useState(true);

  const togglePdfColumn = (key) => {
    setPdfSelectedCols(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const selectAllPdfCols = () => {
    setPdfSelectedCols(PDF_AVAILABLE_COLUMNS.map(c => c.key));
  };

  const getPdfApiUrl = () => {
    const params = new URLSearchParams();
    if (brandFilter) params.set('brandId', brandFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (searchQuery) params.set('search', searchQuery);
    if (pdfSelectedCols.length > 0) {
      params.set('cols', pdfSelectedCols.join(','));
    }
    if (pdfIncludeImages) {
      params.set('images', '1');
    }
    return `/api/dashboard/reports/pdf?${params.toString()}`;
  };

  const handleOpenPdfPreview = () => {
    const pdfApiUrl = getPdfApiUrl();
    const previewUrl = `/pdf-preview?url=${encodeURIComponent(pdfApiUrl)}&title=${encodeURIComponent('Product Inventory Catalog Report')}`;
    window.open(previewUrl, '_blank');
    setIsPdfModalOpen(false);
  };

  const handleDirectPdfDownload = () => {
    const pdfApiUrl = getPdfApiUrl();
    const a = document.createElement('a');
    a.href = pdfApiUrl;
    a.download = `Product-Inventory-Report-${new Date().toISOString().split('T')[0]}.pdf`;
    a.target = '_blank';
    a.click();
    setIsPdfModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button 
              type="button" 
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition-all duration-150 cursor-pointer whitespace-nowrap"
            >
              <FileText size={15} />
              <span>Export PDF</span>
            </button>
            <ExportToExcel
              data={filteredProducts.map(p => ({
                Image: p.imageUrl || '',
                'Product Name': p.name,
                'Item Code': p.itemCode || '',
                Brand: p.brand?.name || '',
                Category: p.category || '',
                'Shirt Size': p.size || p.shirtSize || '',
                Barcode: p.barcode || '',
                Supplier: p.supplier || '',
                'Unit Price': p.unitPrice || '',
                Returnable: p.isReturnable ? 'Yes' : 'No',
                Disposable: p.isDisposable ? 'Yes' : 'No',
                'Track Expiry': p.trackExpiry ? 'Yes' : 'No',
                Status: p.status || '',
              }))}
              columns={[
                { header: 'Image', key: 'Image', width: 16, isImage: true },
                { header: 'Product Name', key: 'Product Name', width: 25 },
                { header: 'Item Code', key: 'Item Code', width: 16 },
                { header: 'Brand', key: 'Brand', width: 18 },
                { header: 'Category', key: 'Category', width: 16 },
                { header: 'Shirt Size', key: 'Shirt Size', width: 12 },
                { header: 'Barcode', key: 'Barcode', width: 22 },
                { header: 'Supplier', key: 'Supplier', width: 20 },
                { header: 'Unit Price', key: 'Unit Price', width: 12 },
                { header: 'Returnable', key: 'Returnable', width: 12 },
                { header: 'Disposable', key: 'Disposable', width: 12 },
                { header: 'Track Expiry', key: 'Track Expiry', width: 14 },
                { header: 'Status', key: 'Status', width: 12 },
              ]}
              filename="IML-Products"
            />
            {!isReadOnly && (
              <>
                <div className="has-tooltip">
                  <button 
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap" 
                    onClick={openCSVModal}
                    type="button"
                  >
                    <Upload size={13} /> <span>Import CSV</span>
                  </button>
                  <span className="tooltip-box">Import catalog items via CSV</span>
                </div>
                <div className="has-tooltip">
                  <Link 
                    href="/dashboard/products/new" 
                    className="inline-flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                  >
                    <Plus size={14} /> <span>Add Product</span>
                  </Link>
                  <span className="tooltip-box">Create a new catalog item</span>
                </div>
              </>
            )}
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
                <h2 className="font-display font-bold text-lg text-text-primary">{isReadOnly ? 'Barcodes:' : 'Manage Barcodes:'} {serialProduct.name}</h2>
                <p className="text-xs text-text-secondary mt-0.5">{isReadOnly ? 'Registered barcodes and locations for this device.' : 'Register, upload and lookup barcodes for this device.'}</p>
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

            <div className={`grid grid-cols-1 ${isReadOnly ? '' : 'md:grid-cols-2'} gap-6 mt-2`}>
              {!isReadOnly && (
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
              )}

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
                          <SortableHeader field="barcode" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="p-2.5">Barcode</SortableHeader>
                          <SortableHeader field="secondaryBarcode" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="p-2.5">Secondary</SortableHeader>
                          <SortableHeader field="currentLocationType" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} className="p-2.5">Location</SortableHeader>
                          <SortableHeader field="status" currentField={serialSortField} direction={serialSortDirection} onSort={handleSerialSort} align="center" className="p-2.5">Status</SortableHeader>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-text-primary">
                        {sortedSerials.map(s => (
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

            {mounted && isCameraModalOpen && createPortal(
              <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] shadow-lg flex flex-col gap-4 animate-slide-down max-h-[90vh] overflow-y-auto my-auto">
                  <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
                    <h3 className="font-display font-bold text-sm text-text-primary">Scan Barcode</h3>
                    <button className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => setIsCameraModalOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div id="camera-reader" className="w-full rounded-lg overflow-hidden border border-border flex-shrink-0"></div>
                  <p className="text-[10px] text-text-secondary text-center flex-shrink-0">Align the barcode inside the camera viewfinder.</p>
                </div>
              </div>,
              document.body
            )}
          </div>
        )}

        {/* Products List Pane */}
        <div className="w-full flex flex-col gap-4">
          {/* Filters & Search Bar */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 shadow-sm">
            {/* Top Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
              <input
                type="text"
                placeholder="Search by name, SKU, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center">
              {/* Brand Filter */}
              <div className="w-full">
                <CustomSelect
                  options={[{ value: 'ALL', label: 'All Brands' }, ...brands.map(brand => ({ value: brand.id, label: brand.name }))]}
                  value={brandFilter}
                  onChange={(val) => setBrandFilter(val)}
                  placeholder="All Brands"
                />
              </div>

              {/* Category Filter */}
              <div className="w-full">
                <CustomSelect
                  options={categoryOptions}
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val)}
                  placeholder="All Categories"
                />
              </div>

              {/* Reset & Count */}
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full">
                {(searchQuery || brandFilter !== 'ALL' || categoryFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setBrandFilter('ALL'); setCategoryFilter('ALL'); }}
                    className="px-3 py-2 text-xs font-semibold text-text-muted hover:text-danger hover:bg-danger/10 border border-border rounded-lg transition-all flex items-center gap-1.5"
                    title="Reset all filters"
                  >
                    <X size={13} />
                    <span>Clear</span>
                  </button>
                )}
                <span className="text-xs font-semibold text-text-muted whitespace-nowrap">
                  {filteredProducts.length} products total
                </span>
              </div>
            </div>
          </div>

          {/* Bulk Update / Duplicate Bar */}
          {!isReadOnly && selectedProductIds.length > 0 && (
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
                    { value: 'UNIFORM', label: 'UNIFORM' },
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

          {/* Top Pagination */}
          <Pagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(p) => setCurrentPage(p - 1)}
            itemLabel="products"
          />

          {/* Mobile Card View */}
          {filteredProducts.length === 0 ? (
            <div className="md:hidden">
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Products are the items you track in inventory."
                actionLabel={isReadOnly ? undefined : "Add Product"}
                actionHref={isReadOnly ? undefined : "/dashboard/products/new"}
              />
            </div>
          ) : (
            <div className="md:hidden grid grid-cols-1 gap-3">
              {paginatedProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => router.push(`/dashboard/products/${product.id}`)}
                  className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  {/* Top row: image, name, stock */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {product.imageUrl ? (
                        <img 
                          src={getOptimizedImageUrl(product.imageUrl, 80, 80)} 
                          alt={product.name} 
                          className="w-10 h-10 rounded-sm object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200"
                          onClick={() => setLightboxImage({ url: product.imageUrl, name: product.name })}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-sm bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                          <Package size={18} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/products/${product.id}`} className="font-semibold text-sm text-text-primary break-words leading-snug block hover:text-primary transition-colors">{product.name}</Link>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="badge bg-secondary/15 text-secondary border border-secondary/10 text-[10px]">
                            {product.brand.name}
                          </span>
                          <span className="badge bg-surface-elevated text-text-secondary border border-border text-[10px]">
                            {product.category || 'STANDS'}
                          </span>
                          {product.isReturnable && (
                            <span className="badge badge-warning text-[10px]"><ShieldAlert size={9} /> Returnable</span>
                          )}
                          {product.isDisposable && (
                            <span className="badge bg-warning/15 text-warning border border-warning/20 text-[10px]">Disposable</span>
                          )}
                          {product.trackExpiry && (
                            <span className="badge bg-danger/15 text-danger border border-danger/20 text-[10px]">Track Expiry</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Stock badge */}
                    <div className="flex-shrink-0">
                      {product.stockCap ? (
                        product.warehouseStock <= 0 ? (
                          <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full">
                            0 / Out
                          </span>
                        ) : product.warehouseStock < product.stockCap ? (
                          <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold bg-warning/10 text-warning border border-warning/20 rounded-full animate-pulse">
                            {product.warehouseStock} / Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-[10px] font-bold bg-success/10 text-success border border-success/20 rounded-full">
                            {product.warehouseStock}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-[10px] font-semibold bg-surface-elevated text-text-primary border border-border rounded-full font-mono">
                          {product.warehouseStock}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Bottom row: SKU + type + actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      {product.itemCode && <span className="font-mono">{product.itemCode}</span>}
                      {product.isSerialized && (
                        <button 
                          className="inline-flex items-center gap-0.5 text-primary font-semibold"
                          onClick={(e) => { e.stopPropagation(); openSerialModal(product); }}
                          type="button"
                        >
                          <QrCode size={10} />
                          <span>SIM ({product._count.serialNumbers})</span>
                        </button>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {!product.isSerialized && (
                          <button 
                            className="p-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-md transition-colors"
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
                            <Plus size={13} />
                          </button>
                        )}
                        <button type="button" className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors" onClick={() => openEditModal(product)}>
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products yet"
                description="Products are the items you track in inventory."
                actionLabel={isReadOnly ? undefined : "Add Product"}
                actionHref={isReadOnly ? undefined : "/dashboard/products/new"}
              />
            ) : (
              <ScrollableTable>
                <table className="min-w-full divide-y divide-border text-[10px] sm:text-[11px] md:text-xs">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        {!isReadOnly && (
                          <th className="py-3 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface-sticky z-20">
                            <input type="checkbox" className="custom-checkbox" checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                              onChange={(e) => { e.target.checked ? setSelectedProductIds(filteredProducts.map(p => p.id)) : setSelectedProductIds([]); }} />
                          </th>
                        )}
                        <SortableHeader field="name" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className={`py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 sticky ${isReadOnly ? 'left-0' : 'left-8'} bg-surface-sticky z-20 border-r border-border shadow-sm`}>Product Details</SortableHeader>
                        <SortableHeader field="itemCode" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Code (SKU)</SortableHeader>
                        <SortableHeader field="brand" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Brand</SortableHeader>
                        <SortableHeader field="stock" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} align="center" className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Stock</SortableHeader>
                        <SortableHeader field="type" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Type</SortableHeader>
                        <SortableHeader field="category" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Category</SortableHeader>
                        <SortableHeader field="isReturnable" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Returnable</SortableHeader>
                        <SortableHeader field="isDisposable" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Disposable</SortableHeader>
                        <SortableHeader field="trackExpiry" currentField={productSortField} direction={productSortDirection} onSort={handleProductSort} className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5">Track Expiry</SortableHeader>
                        {!isReadOnly && <th className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {paginatedProducts.map(product => (
                        <tr 
                          key={product.id} 
                          className="hover:bg-surface-elevated/30 transition-all duration-150 cursor-pointer group/row"
                          onClick={() => router.push(`/dashboard/products/${product.id}`)}
                        >
                          {!isReadOnly && (
                            <td className="py-3.5 pl-4 pr-0 w-8 text-center sticky left-0 bg-surface group-hover/row:bg-surface-elevated z-10" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="custom-checkbox" checked={selectedProductIds.includes(product.id)}
                                onChange={(e) => { e.target.checked ? setSelectedProductIds(prev => [...prev, product.id]) : setSelectedProductIds(prev => prev.filter(id => id !== product.id)); }} />
                            </td>
                          )}
                          <td className={`py-2 sm:py-3 pl-4 sm:pl-5 pr-3 sm:pr-4 min-w-[220px] sticky ${isReadOnly ? 'left-0' : 'left-8'} bg-surface group-hover/row:bg-surface-elevated z-10 border-r border-border shadow-sm`}>
                            <div className="flex items-center gap-2.5">
                              {product.imageUrl ? (
                                <img 
                                  src={getOptimizedImageUrl(product.imageUrl, 80, 80)} 
                                  alt={product.name} 
                                  className="w-8 h-8 rounded-sm object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200"
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
                                <div className="w-8 h-8 rounded-sm bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                  <Package size={15} />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <Link href={`/dashboard/products/${product.id}`} className="font-semibold text-text-primary break-words leading-snug hover:text-primary transition-colors">{product.name}</Link>
                                {((product.rack || product.shelf) || (product.brand?.rack || product.brand?.shelf)) && (
                                  <span className="text-[10px] text-text-muted mt-0.5 font-medium">
                                    Loc: {product.rack || product.brand?.rack ? `Rack ${product.rack || product.brand?.rack}` : ''}{(product.rack || product.brand?.rack) && (product.shelf || product.brand?.shelf) ? ', ' : ''}{product.shelf || product.brand?.shelf ? `Shelf ${product.shelf || product.brand?.shelf}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 font-mono text-xs text-text-secondary whitespace-nowrap">{product.itemCode || '---'}</td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                            <span className="badge bg-secondary/15 text-secondary border border-secondary/10">
                              {product.brand.name}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-center">
                            {product.stockCap ? (
                              product.warehouseStock <= 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-danger/10 text-danger border border-danger/20 rounded-full">
                                  0 / Out of Stock
                                </span>
                              ) : product.warehouseStock < product.stockCap ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-warning/10 text-warning border border-warning/20 rounded-full tabular-nums">
                                  {product.warehouseStock} / Low (Cap: {product.stockCap})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-success/10 text-success border border-success/20 rounded-full tabular-nums">
                                  {product.warehouseStock} / Ok
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-surface-elevated text-text-primary border border-border rounded-full font-mono">
                                {product.warehouseStock}
                              </span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
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
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                            <span className="badge bg-surface-elevated text-text-secondary border border-border">
                              {product.category || 'STANDS'}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                            {product.isReturnable ? (
                              <span className="badge badge-warning text-[10px]"><ShieldAlert size={10} /> Yes</span>
                            ) : (
                              <span className="badge badge-success text-[10px]"><CheckCircle size={10} /> No</span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                            {product.isDisposable ? (
                              <span className="badge bg-warning/15 text-warning border border-warning/20 text-[10px] font-bold">Yes</span>
                            ) : (
                              <span className="badge bg-surface-elevated text-text-muted border border-border text-[10px]">No</span>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap">
                            {product.trackExpiry ? (
                              <span className="badge bg-danger/15 text-danger border border-danger/20 text-[10px] font-bold">Yes</span>
                            ) : (
                              <span className="badge bg-surface-elevated text-text-muted border border-border text-[10px]">No</span>
                            )}
                          </td>
                          {!isReadOnly && (
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
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
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
            )}
          </div>

          {/* Bottom Pagination */}
          <Pagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(p) => setCurrentPage(p - 1)}
            itemLabel="products"
          />

        {mounted && addQtyProduct && createPortal(
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <form onSubmit={handleAddQtySubmit} className="bg-surface border border-border rounded-xl p-6 w-full max-w-[420px] shadow-lg flex flex-col gap-4 animate-slide-down max-h-[90vh] overflow-y-auto my-auto">
              <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
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

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border flex-shrink-0">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setAddQtyProduct(null)} disabled={loading}>Cancel</button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" disabled={loading}>
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  <span>Add Stock</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
      </div>

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmData.onConfirm}
        type="confirm"
        danger={confirmData.danger}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel={confirmData.confirmLabel}
      />

      {/* PDF Export Configuration Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">Export Product Catalog to PDF</h3>
                  <p className="text-xs text-text-secondary">
                    Customize columns and options for your print-ready document
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              
              {/* Active Filter Scope Indicator */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-elevated/60 border border-border rounded-xl text-xs">
                <span className="text-text-muted">Target Filtered Scope:</span>
                <span className="font-bold text-text-primary font-mono">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
                </span>
              </div>

              {/* Columns Selector Grid */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Select Columns ({pdfSelectedCols.length} of {PDF_AVAILABLE_COLUMNS.length})
                  </label>
                  <button
                    type="button"
                    onClick={selectAllPdfCols}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3 bg-surface-elevated/40 border border-border rounded-xl">
                  {PDF_AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = pdfSelectedCols.includes(col.key);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => togglePdfColumn(col.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer border ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                            : 'bg-surface border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare size={13} className="text-primary shrink-0" />
                        ) : (
                          <Square size={13} className="text-text-muted shrink-0" />
                        )}
                        <span className="truncate">{col.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-text-muted italic px-1">
                  * Product Details is always included as the primary descriptor column.
                </span>
              </div>

              {/* Product Photos Toggle */}
              <label className="flex items-center justify-between p-3.5 bg-surface-elevated/40 border border-border rounded-xl cursor-pointer hover:bg-surface-elevated/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                    pdfIncludeImages ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-surface border-border text-text-muted'
                  }`}>
                    <ImageIcon size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">
                      Include Product Photos
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Renders high-definition product thumbnail images inside the PDF table
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={pdfIncludeImages}
                  onChange={(e) => setPdfIncludeImages(e.target.checked)}
                  className="w-5 h-5 rounded text-primary focus:ring-primary/20 border-border cursor-pointer accent-primary"
                />
              </label>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-2.5 px-5 py-3.5 border-t border-border bg-surface-elevated">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface border border-border hover:bg-surface-elevated rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPdfDownload}
                  disabled={filteredProducts.length === 0 || pdfSelectedCols.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-text-primary bg-surface border border-border hover:bg-surface-elevated rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:shadow"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPdfPreview}
                  disabled={filteredProducts.length === 0 || pdfSelectedCols.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover active:scale-98 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Eye size={13} />
                  <span>Open PDF Preview</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  </div>
  );
}


