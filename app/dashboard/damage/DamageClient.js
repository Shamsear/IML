'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, AlertCircle, Camera, QrCode, X, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { createBulkDamageTransactions } from '@/app/actions/transactions';
import { getAvailableBarcodes, getProductStockAtLocation, getProductBatchesAtLocation, findProductByBarcode } from '@/app/actions/products';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { getClientScanCompanionUrl } from '@/lib/scan-companion-url';
import { playBeep } from '@/lib/audio';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import useBarcodeScanner from '@/hooks/useBarcodeScanner';

function DamageFormContent({ products, brands = [], initialItems = null, lockedType = null, stores = [], directSellers = [] }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });

  // Brand filter for product selection
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Report type: locked by prop, or preset via ?type= URL param
  const [reportType, setReportType] = useState(() => {
    if (lockedType) return lockedType;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('type');
      return p === 'LOST' ? 'LOST' : 'DAMAGE';
    }
    return 'DAMAGE';
  });
  const [fromType, setFromType] = useState('WAREHOUSE'); // 'WAREHOUSE', 'STORE', 'DIRECT'
  const [fromId, setFromId] = useState('');
  const [showDirectSellerSuggestions, setShowDirectSellerSuggestions] = useState(false);
  const [highlightedSellerIdx, setHighlightedSellerIdx] = useState(-1);

  // State for bulk damage items
  const [items, setItems] = useState([]);

  // Warn before navigating away with unsaved items
  useUnsavedChanges(items.length > 0 && !loading);

  // Scanning inputs states (one per row index)
  const [scanInputs, setScanInputs] = useState({});

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraRow, setActiveCameraRow] = useState(null);
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);

  // Load saved mobile session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('iml_mobile_scan_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          fetch(`/api/scan-companion?sessionId=${parsed.sessionId}`)
            .then(res => {
              if (res.ok) {
                setMobileSession(parsed);
                setIsCompanionActive(true);
              } else {
                localStorage.removeItem('iml_mobile_scan_session');
              }
            })
            .catch(() => {});
        } catch (e) {
          localStorage.removeItem('iml_mobile_scan_session');
        }
      }
    }
  }, []);

  // Sync isBulkScan to Ref to prevent stale closures without re-triggering camera instantiations
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Barcode scanner hook
  const onBarcodeScan = useCallback((code) => {
    const lowercaseCode = code.toLowerCase();
    setItems(prev => {
      const item = prev[activeCameraRow];
      if (!item) return prev;

      const matched = item.availableBarcodes.find(b => b.barcode.toLowerCase() === lowercaseCode);
      if (matched) {
        if (!item.selectedBarcodes.includes(matched.barcode)) {
          playBeep();
          const newSelected = [...item.selectedBarcodes, matched.barcode];
          return prev.map((x, idx) => idx === activeCameraRow ? { ...x, selectedBarcodes: newSelected, quantity: newSelected.length } : x);
        }
      } else {
        toast.error('Not Found', `Barcode "${code}" is not in the Warehouse.`);
      }
      return prev;
    });
  }, [activeCameraRow]);
  const { cameraPermissionStatus, retryCameraPermission } = useBarcodeScanner({
    isOpen: isCameraOpen && activeCameraRow !== null,
    onScan: onBarcodeScan,
  });

  // Initialize selected products from URL search parameter "productIds" or initialItems
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initRows = async () => {
      let initialItemsList = [];
      if (initialItems) {
        initialItemsList = initialItems.map((item, idx) => {
          const prod = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            selectedBarcodes: item.barcodes || [],
            availableBarcodes: [],
            currentStock: 0,
            notes: item.notes || '',
            availableBatches: [],
            selectedBatches: prod?.trackExpiry && !prod?.isSerialized ? [{
              manufactureDate: item.manufactureDate,
              expiryDate: item.expiryDate,
              quantity: item.quantity
            }] : []
          };
        });
      } else {
        const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
        if (urlIds.length > 0) {
          initialItemsList = urlIds.map(id => {
            const prod = products.find(p => p.id === id);
            return {
              productId: id,
              quantity: prod?.isSerialized ? 0 : 1,
              selectedBarcodes: [],
              availableBarcodes: [],
              currentStock: prod?.warehouseStock || 0,
              notes: '',
              availableBatches: [],
              selectedBatches: []
            };
          });
        } else {
          initialItemsList = [{
            productId: '',
            quantity: 1,
            selectedBarcodes: [],
            availableBarcodes: [],
            currentStock: 0,
            notes: '',
            availableBatches: [],
            selectedBatches: []
          }];
        }
      }

      setItems(initialItemsList);

      for (let i = 0; i < initialItemsList.length; i++) {
        const item = initialItemsList[i];
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          try {
            const available = prod.isSerialized ? await getAvailableBarcodes(item.productId, fromType, fromId || null) : [];
            const stock = prod.isSerialized ? available.length : (fromType === 'WAREHOUSE' ? prod.warehouseStock : await getProductStockAtLocation(item.productId, fromType, fromId || null));
            let batches = [];
            if (prod.trackExpiry && !prod.isSerialized) {
              batches = await getProductBatchesAtLocation(item.productId, fromType, fromId || null);
            }
            setItems(prev => prev.map((x, idx) => idx === i ? { ...x, availableBarcodes: available || [], currentStock: stock, availableBatches: batches } : x));
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    initRows();
  }, [searchParams, products, initialItems]);

  // Effect to reload available barcodes and stock counts when location changes
  useEffect(() => {
    const reloadLocationData = async () => {
      const updated = await Promise.all(items.map(async (item) => {
        const prod = products.find(p => p.id === item.productId);
        let available = [];
        let currentStock = 0;
        let batches = [];
        
        if (prod) {
          if (prod.isSerialized) {
            try {
              available = await getAvailableBarcodes(item.productId, fromType, fromId || null);
              currentStock = available.length;
            } catch (e) {
              console.error(e);
            }
          } else {
            try {
              if (fromType === 'WAREHOUSE') {
                currentStock = prod.warehouseStock;
              } else {
                currentStock = await getProductStockAtLocation(item.productId, fromType, fromId || null);
              }
              if (prod.trackExpiry) {
                batches = await getProductBatchesAtLocation(item.productId, fromType, fromId || null);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
        
        return {
          ...item,
          availableBarcodes: available || [],
          selectedBarcodes: [],
          quantity: prod?.isSerialized ? 0 : 1,
          currentStock,
          availableBatches: batches || [],
          selectedBatches: []
        };
      }));
      setItems(updated);
    };

    if (items.length > 0) {
      reloadLocationData();
    }
  }, [fromType, fromId]);

  const handleAddRow = async () => {
    setItems(prev => [...prev, { 
      productId: '', 
      quantity: 1, 
      selectedBarcodes: [], 
      availableBarcodes: [], 
      currentStock: 0,
      notes: '',
      availableBatches: [],
      selectedBatches: []
    }]);
  };

  const handleRemoveRow = (index) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleFieldChange = (index, field, value) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const updated = { ...item, [field]: value };
        if (field === 'selectedBarcodes') {
          updated.quantity = value.length;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleProductChange = async (index, productId) => {
    const prod = products.find(p => p.id === productId);
    let available = [];
    let currentStock = 0;
    let batches = [];

    if (prod) {
      if (prod.isSerialized) {
        try {
          available = await getAvailableBarcodes(productId, fromType, fromId || null);
          currentStock = available.length;
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          if (fromType === 'WAREHOUSE') {
            currentStock = prod.warehouseStock;
          } else {
            currentStock = await getProductStockAtLocation(productId, fromType, fromId || null);
          }
          if (prod.trackExpiry) {
            batches = await getProductBatchesAtLocation(productId, fromType, fromId || null);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }

    setItems(prev => prev.map((x, idx) => idx === index ? {
      ...x,
      productId,
      quantity: prod?.isSerialized ? 0 : 1,
      selectedBarcodes: [],
      availableBarcodes: available || [],
      currentStock,
      notes: '',
      availableBatches: batches || [],
      selectedBatches: []
    } : x));
  };

  // Keyboard scan input toggle handler
  const handleScanInputKeyDown = (e, index, availableBarcodes, selectedBarcodes) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = (scanInputs[index] || '').trim().toLowerCase();
      if (!code) return;

      const matched = availableBarcodes.find(b => b.barcode.toLowerCase() === code);
      if (matched) {
        if (!selectedBarcodes.includes(matched.barcode)) {
          const newSelected = [...selectedBarcodes, matched.barcode];
          handleFieldChange(index, 'selectedBarcodes', newSelected);
          playBeep();
        } else {
          // Toggle off
          const newSelected = selectedBarcodes.filter(b => b !== matched.barcode);
          handleFieldChange(index, 'selectedBarcodes', newSelected);
        }
      } else {
        toast.error('Not Found', `Barcode "${scanInputs[index]}" is not in the Warehouse.`);
      }
      setScanInputs(prev => ({ ...prev, [index]: '' }));
    }
  };

  // Mobile pairing setup
  const handleOpenMobileScanner = async (rowIndex) => {
    setActiveCameraRow(rowIndex);
    setIsCompanionActive(true);
    if (mobileSession?.sessionId) {
      setIsMobileModalOpen(true);
      return;
    }
    try {
      const res = await fetch('/api/scan-companion', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMobileSession(data);
        localStorage.setItem('iml_mobile_scan_session', JSON.stringify(data));
        setIsMobileModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to initialize mobile session:", e);
    }
  };

  // Global barcode lookup for damage — finds product by barcode and auto-assigns to first empty row
  const processGlobalBarcode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    try {
      const serial = await findProductByBarcode(cleanCode);
      if (!serial) {
        toast.error('Not Found', `Barcode "${cleanCode}" was not found in the catalogue.`);
        return;
      }
      const prod = serial.product;

      // Find existing row for this product
      const existingIdx = items.findIndex(item => item.productId === prod.id);
      if (existingIdx !== -1) {
        const item = items[existingIdx];
        if (!item.selectedBarcodes.includes(cleanCode)) {
          let available = item.availableBarcodes;
          if (available.length === 0) {
            available = await getAvailableBarcodes(prod.id, 'WAREHOUSE', null);
          }
          setItems(prev => prev.map((x, idx) => idx === existingIdx ? {
            ...x,
            availableBarcodes: available || [],
            selectedBarcodes: [...x.selectedBarcodes, cleanCode],
            quantity: x.selectedBarcodes.length + 1,
          } : x));
          playBeep();
        }
      } else {
        // Find empty slot or add new row
        const emptyIdx = items.findIndex(item => !item.productId);
        const available = await getAvailableBarcodes(prod.id, 'WAREHOUSE', null);
        if (emptyIdx !== -1) {
          setItems(prev => prev.map((x, idx) => idx === emptyIdx ? {
            ...x,
            productId: prod.id,
            quantity: 1,
            selectedBarcodes: [cleanCode],
            availableBarcodes: available || [],
            currentStock: 0,
            notes: '',
          } : x));
          playBeep();
        } else {
          setItems(prev => [...prev, {
            productId: prod.id,
            quantity: 1,
            selectedBarcodes: [cleanCode],
            availableBarcodes: available || [],
            currentStock: 0,
            notes: '',
            availableBatches: [],
            selectedBatches: [],
          }]);
          playBeep();
        }
      }
    } catch (err) {
      console.error('Global scan query failed:', err);
      toast.error('Server Error', 'Error fetching barcode from server.');
    }
  };

  // Listen to mobile companion scanned barcodes in real-time via SSE
  useEffect(() => {
    if (!mobileSession?.sessionId || !isCompanionActive) return;

    let eventSource = null;
    let fallbackInterval = null;

    const processCode = async (code) => {
      if (activeCameraRow !== null) {
        const cleanCode = code.trim();
        const lowercaseCode = cleanCode.toLowerCase();
        setItems(prev => {
          const item = prev[activeCameraRow];
          if (!item) return prev;
          const matched = item.availableBarcodes.find(b => b.barcode.toLowerCase() === lowercaseCode);
          if (matched) {
            if (!item.selectedBarcodes.includes(matched.barcode)) {
              playBeep();
              const newSelected = [...item.selectedBarcodes, matched.barcode];
              return prev.map((x, idx) => idx === activeCameraRow ? { ...x, selectedBarcodes: newSelected, quantity: newSelected.length } : x);
            }
          } else {
            toast.error('Not Available', `Scanned barcode "${cleanCode}" is not in the Warehouse.`);
          }
          return prev;
        });
      } else {
        await processGlobalBarcode(code);
      }
    };

    const setupSSE = () => {
      eventSource = new EventSource(`/api/scan-companion/sync?sessionId=${mobileSession.sessionId}`);

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.barcode) {
            await processCode(data.barcode);
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection lost, falling back to polling...", err);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!fallbackInterval) {
          fallbackInterval = setInterval(async () => {
            try {
              const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
              if (res.ok) {
                const data = await res.json();
                if (data.barcodes && data.barcodes.length > 0) {
                  for (const code of data.barcodes) {
                    await processCode(code);
                  }
                }
              }
            } catch (e) {
              console.error("Polling fallback error:", e);
            }
          }, 500);
        }
      };
    };

    setupSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [mobileSession, activeCameraRow, isCompanionActive]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod?.isSerialized && item.selectedBarcodes.length === 0) {
        setError(`Please select at least one barcode for ${prod.name}`);
        setLoading(false);
        return;
      }
      if (prod?.trackExpiry && !prod?.isSerialized) {
        const selected = item.selectedBatches || [];
        const totalSelected = selected.reduce((sum, b) => sum + b.quantity, 0);
        if (totalSelected <= 0) {
          setError(`Please specify quantities for at least one batch of ${prod.name}`);
          setLoading(false);
          return;
        }
      } else if (!prod?.isSerialized) {
        const qty = parseInt(item.quantity, 10);
        if (qty <= 0 || isNaN(qty)) {
          setError(`Quantity for ${prod.name} must be greater than 0`);
          setLoading(false);
          return;
        }
        if (qty > (item.currentStock || 0)) {
          setError(`Quantity for ${prod.name} exceeds available stock (${item.currentStock || 0})`);
          setLoading(false);
          return;
        }
      }
    }

    const itemsPayload = [];
    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      if (prod?.trackExpiry && !prod?.isSerialized) {
        const selected = item.selectedBatches || [];
        selected.forEach(batch => {
          itemsPayload.push({
            productId: item.productId,
            quantity: batch.quantity,
            barcodes: [],
            manufactureDate: batch.manufactureDate,
            expiryDate: batch.expiryDate,
            notes: item.notes
          });
        });
      } else {
        itemsPayload.push({
          productId: item.productId,
          quantity: prod?.isSerialized ? item.selectedBarcodes.length : item.quantity,
          barcodes: prod?.isSerialized ? item.selectedBarcodes : [],
          notes: item.notes
        });
      }
    }

    try {
      await createBulkDamageTransactions({
        fromEntityType: fromType,
        fromEntityId: fromId || null,
        transactionType: reportType,
        items: itemsPayload
      });
      const label = reportType === 'LOST' ? 'Loss Report Filed' : 'Damage Report Filed';
      setConfirmData({ title: label, message: `${items.length} product(s) have been recorded as ${reportType === 'LOST' ? 'lost' : 'damaged'}.` });
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to complete transaction.');
      setLoading(false);
    }
  };

  // Get current session barcodes for bulk list view
  const currentItem = items[activeCameraRow];
  const scannedBarcodesList = currentItem?.selectedBarcodes || [];
  const currentScannedCount = scannedBarcodesList.length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <AlertCircle size={180} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link
            href={lockedType === 'LOST' ? '/dashboard/loss' : '/dashboard/damage'}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
              {lockedType === 'LOST' ? 'Report Loss / Missing' : 'Report Damage & Wastage'}
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {lockedType === 'LOST'
                ? 'Log items that are missing, stolen, or cannot be accounted for.'
                : 'Log damaged items or serial numbers to discard them from Central Warehouse stock.'}
            </p>
          </div>
        </div>
        {/* Companion Scanner Status Badge */}
        <div className="flex items-center">
          {isCompanionActive && mobileSession?.sessionId ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Companion Active: {mobileSession.sessionId}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface border border-border text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
              Companion Scanner Off
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-4 text-sm font-semibold flex items-center gap-2.5 animate-slide-down">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-sm font-semibold flex items-center gap-2.5 animate-slide-down">
          <span>{successMsg}</span>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/damage'); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
        {/* Report Type Toggle — hidden when type is locked by page */}
        {!lockedType && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Report Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReportType('DAMAGE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
                reportType === 'DAMAGE'
                  ? 'bg-danger text-white border-danger shadow-md'
                  : 'bg-surface border-border text-text-secondary hover:border-danger/50 hover:text-danger'
              }`}
            >
              <ShieldAlert size={15} />
              Damage / Wastage
            </button>
            <button
              type="button"
              onClick={() => setReportType('LOST')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
                reportType === 'LOST'
                  ? 'bg-warning text-white border-warning shadow-md'
                  : 'bg-surface border-border text-text-secondary hover:border-warning/50 hover:text-warning'
              }`}
            >
              <AlertCircle size={15} />
              Lost / Missing
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            {reportType === 'DAMAGE'
              ? 'Use for physically damaged, broken, or wasted items that are being written off.'
              : 'Use for items that are missing, stolen, or cannot be accounted for.'}
          </p>
        </div>
        )}

        {/* Source Selection Header */}
        <div className="bg-surface-elevated/40 border border-border rounded-xl p-5 shadow-sm">
          <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-2 pb-3 border-b border-border">
            <AlertCircle size={15} className="text-danger animate-pulse" />
            <span>Report Source / Location</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Source Location Type</label>
              <CustomSelect
                options={[
                  { value: 'WAREHOUSE', label: 'Central Warehouse' },
                  { value: 'STORE', label: 'Retail Store / Placement' },
                  { value: 'DIRECT', label: 'Direct Seller / Promoter Staff' },
                ]}
                value={fromType}
                onChange={(val) => {
                  setFromType(val);
                  setFromId('');
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              {fromType === 'STORE' && (
                <>
                  <label className="text-xs font-semibold text-text-secondary">Select Retail Store</label>
                  <CustomSelect
                    options={stores.map(s => ({ value: s.id, label: s.name }))}
                    value={fromId}
                    onChange={(val) => setFromId(val)}
                    placeholder="-- Select Retail Store --"
                    required
                  />
                </>
              )}
              {fromType === 'DIRECT' && (
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-text-secondary">Direct Seller / Staff Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fromId}
                      onChange={(e) => {
                        setFromId(e.target.value);
                        setShowDirectSellerSuggestions(true);
                        setHighlightedSellerIdx(0);
                      }}
                      onFocus={() => {
                        setShowDirectSellerSuggestions(true);
                        setHighlightedSellerIdx(0);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setShowDirectSellerSuggestions(false);
                          setHighlightedSellerIdx(-1);
                        }, 250);
                      }}
                      onKeyDown={(e) => {
                        const filtered = fromId ? directSellers.filter(ds => ds.toLowerCase().includes(fromId.toLowerCase())) : directSellers;
                        if (filtered.length === 0) return;

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedSellerIdx(prev => Math.min(prev + 1, filtered.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedSellerIdx(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          if (highlightedSellerIdx >= 0 && highlightedSellerIdx < filtered.length) {
                            e.preventDefault();
                            setFromId(filtered[highlightedSellerIdx]);
                            setShowDirectSellerSuggestions(false);
                            setHighlightedSellerIdx(-1);
                          }
                        } else if (e.key === 'Escape') {
                          setShowDirectSellerSuggestions(false);
                          setHighlightedSellerIdx(-1);
                        }
                      }}
                      placeholder="Type or select seller/staff name"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                      required
                    />
                    {showDirectSellerSuggestions && (() => {
                      const filtered = fromId ? directSellers.filter(ds => ds.toLowerCase().includes(fromId.toLowerCase())) : directSellers;
                      return filtered.length > 0;
                    })() && (
                      <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                        {(() => {
                          return fromId ? directSellers.filter(ds => ds.toLowerCase().includes(fromId.toLowerCase())) : directSellers;
                        })().map((ds, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-0 font-medium ${
                              idx === highlightedSellerIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-elevated text-text-primary'
                            }`}
                            onClick={() => {
                              setFromId(ds);
                              setShowDirectSellerSuggestions(false);
                            }}
                          >
                            {ds}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Destination Header */}
        <h3 className="font-display font-bold text-lg text-text-primary pb-3 border-b border-border font-semibold">
          {reportType === 'LOST' ? 'Lost / Missing Products' : 'Damaged Products Ledger'}
        </h3>

        {/* Dynamic products rows */}
        <div className="flex flex-col gap-6">
          {items.map((item, index) => {
            const selectedProd = products.find(p => p.id === item.productId);
            return (
              <div key={index} className="relative p-5 bg-surface-elevated/40 border border-black/5 rounded-xl flex flex-col gap-4">
                <button 
                  type="button" 
                  className="absolute top-4 right-4 p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors" 
                  onClick={() => handleRemoveRow(index)}
                  disabled={items.length === 1}
                  title="Remove item"
                >
                  <Trash2 size={16} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mr-8">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-text-secondary">Product Item</label>
                    {/* Brand filter pills */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBrandFilter('ALL')}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${brandFilter === 'ALL' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                      >All Brands</button>
                      {brands.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBrandFilter(b.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${brandFilter === b.id ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                        >{b.name}</button>
                      ))}
                    </div>
                    <CustomSelect
                      options={products
                        .filter(p => brandFilter === 'ALL' || p.brand?.id === brandFilter)
                        .map(p => ({
                          value: p.id,
                          label: p.name,
                          imageUrl: p.imageUrl,
                          warehouseStock: p.warehouseStock,
                          disabled: p.isSerialized && items.filter((_, i) => i !== index).map(it => it.productId).filter(Boolean).includes(p.id)
                        }))}
                      value={item.productId}
                      onChange={(id) => handleProductChange(index, id)}
                      placeholder="Choose product..."
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-text-secondary">
                        {!selectedProd?.isSerialized ? 'Quantity Damaged' : 'Quantity (Selected)'}
                      </label>
                      {selectedProd && !selectedProd.isSerialized && (
                        <span className="text-[10px] font-mono text-text-muted">
                          In Stock: <strong className="text-primary">{item.currentStock || 0}</strong>
                        </span>
                      )}
                    </div>
                    {!selectedProd?.isSerialized ? (
                      <div className="flex flex-col gap-1.5 w-full">
                         <input 
                           type="number" 
                           className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-200" 
                           min={1} 
                           max={item.currentStock || 0}
                           value={item.quantity}
                           onChange={(e) => handleFieldChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                           disabled={selectedProd?.trackExpiry}
                           required 
                         />
                         {selectedProd?.trackExpiry && (
                           <span className="text-[10px] text-text-muted mt-0.5">Quantity is computed automatically from selected batch quantities below.</span>
                         )}
                         {!selectedProd?.trackExpiry && item.quantity > (item.currentStock || 0) && (
                           <span className="text-[10px] font-semibold text-danger mt-1 animate-pulse block">
                             ⚠️ Warning: Quantity exceeds available stock ({item.currentStock || 0})!
                           </span>
                         )}
                         {!selectedProd?.trackExpiry && item.quantity <= 0 && (
                           <span className="text-[10px] font-semibold text-danger mt-1 block">
                             ⚠️ Warning: Quantity must be greater than 0.
                           </span>
                         )}
                       </div>
                    ) : (
                      <input 
                        type="number" 
                        className="w-full bg-surface-elevated text-danger border border-border rounded-lg px-3 py-2.5 text-sm font-bold font-mono"
                        value={item.quantity}
                        disabled
                      />
                    )}
                  </div>
                </div>

                {selectedProd?.isSerialized && (
                  <div className="flex flex-col gap-1.5 mt-2 bg-surface p-4 border border-border rounded-lg">
                    {/* Scan Input Header */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      <label className="text-xs font-semibold text-text-primary flex items-center gap-1">
                        <QrCode size={14} className="text-primary" />
                        <span>Scan / Enter Barcode to Select</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                          value={scanInputs[index] || ''}
                          onChange={(e) => setScanInputs(prev => ({ ...prev, [index]: e.target.value }))}
                          onKeyDown={(e) => handleScanInputKeyDown(e, index, item.availableBarcodes, item.selectedBarcodes)}
                          placeholder="Scan barcode to select, then press Enter..."
                        />
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            className="px-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1"
                            onClick={() => { setActiveCameraRow(index); setIsCameraOpen(true); }}
                            title="Scan via PC Webcam"
                          >
                            <Camera size={13} />
                            <span className="text-[10px] font-bold uppercase hidden sm:inline">Camera</span>
                          </button>
                          
                          <button
                            type="button"
                            className="px-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1"
                            onClick={() => handleOpenMobileScanner(index)}
                            title="Pair Wireless Mobile phone camera"
                          >
                            <Smartphone size={13} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase hidden sm:inline">Mobile</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <label className="text-xs font-semibold text-text-secondary flex items-center gap-1 pb-1">
                      <span>Available Barcodes ({item.availableBarcodes?.length || 0} in Warehouse)</span>
                    </label>
                    
                    {item.availableBarcodes?.length === 0 ? (
                      <span className="text-xs text-danger font-semibold py-1">No available barcodes found in the Warehouse for this product.</span>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto p-2 bg-surface-elevated/20 border border-border rounded-md mt-1">
                        {item.availableBarcodes.map(s => {
                          const isSelected = item.selectedBarcodes.includes(s.barcode);
                          return (
                            <label 
                              key={s.id} 
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold cursor-pointer transition-all duration-200 select-none
                                ${isSelected 
                                  ? 'bg-danger/10 border-danger text-danger' 
                                  : 'bg-surface border-border text-text-secondary hover:border-text-primary hover:text-text-primary'
                                }
                              `}
                            >
                              <input 
                                type="checkbox"
                                className="sr-only"
                                checked={isSelected}
                                onChange={() => {
                                  const newSelected = isSelected
                                    ? item.selectedBarcodes.filter(b => b !== s.barcode)
                                    : [...item.selectedBarcodes, s.barcode];
                                  handleFieldChange(index, 'selectedBarcodes', newSelected);
                                }}
                              />
                              <span>{s.barcode}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Item Specific Remarks / Notes</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors duration-200" 
                    value={item.notes}
                    onChange={(e) => handleFieldChange(index, 'notes', e.target.value)}
                    placeholder="e.g. Scratched panel, Damaged packaging..."
                  />
                </div>

                {/* Expiry Batch selection section */}
                {selectedProd?.trackExpiry && !selectedProd?.isSerialized && (
                  <div className="flex flex-col gap-3 mt-2 bg-surface p-4 border border-border rounded-lg">
                    <label className="text-xs font-bold text-text-primary uppercase tracking-wider">Select Quantities by Expiry Batch</label>
                    <div className="flex flex-col gap-2">
                      {(!item.availableBatches || item.availableBatches.length === 0) ? (
                        <div className="text-xs text-text-muted italic p-2 bg-surface border border-border rounded-lg">
                          No available stock batches found at this location for this product.
                        </div>
                      ) : (
                        item.availableBatches.map((batch, bIdx) => {
                          const mDateStr = batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString() : 'N/A';
                          const eDateStr = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A';
                          const now = new Date();
                          const isExpired = batch.expiryDate && new Date(batch.expiryDate) < now;

                          const selectedQty = item.selectedBatches?.find(b => 
                            b.manufactureDate === batch.manufactureDate && 
                            b.expiryDate === batch.expiryDate
                          )?.quantity || '';

                          return (
                            <div key={bIdx} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-xl shadow-sm">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-text-primary">Expires: {eDateStr}</span>
                                  {isExpired && (
                                    <span className="px-1.5 py-0.5 text-[8px] font-bold bg-danger/10 text-danger rounded uppercase">Expired</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-text-secondary">Mfg: {mDateStr} | Available: <strong className="text-primary">{batch.quantity} units</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Qty:</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={batch.quantity}
                                  className="w-20 bg-surface border border-border rounded px-2.5 py-1 text-xs text-center focus:outline-none focus:border-primary font-bold text-text-primary"
                                  value={selectedQty}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const enteredVal = e.target.value;
                                    const valInt = parseInt(enteredVal, 10) || 0;
                                    const cappedVal = Math.min(valInt, batch.quantity);
                                    
                                    const currentSelected = item.selectedBatches || [];
                                    const existingIdx = currentSelected.findIndex(b => 
                                      b.manufactureDate === batch.manufactureDate && 
                                      b.expiryDate === batch.expiryDate
                                    );

                                    let nextSelected = [...currentSelected];
                                    if (existingIdx !== -1) {
                                      if (cappedVal > 0) {
                                        nextSelected[existingIdx] = { ...nextSelected[existingIdx], quantity: cappedVal };
                                      } else {
                                        nextSelected = nextSelected.filter((_, i) => i !== existingIdx);
                                      }
                                    } else if (cappedVal > 0) {
                                      nextSelected.push({
                                        manufactureDate: batch.manufactureDate,
                                        expiryDate: batch.expiryDate,
                                        quantity: cappedVal
                                      });
                                    }

                                    const totalQty = nextSelected.reduce((sum, b) => sum + b.quantity, 0);
                                    
                                    setItems(prev => prev.map((x, idx) => idx === index ? {
                                      ...x,
                                      selectedBatches: nextSelected,
                                      quantity: totalQty
                                    } : x));
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mt-4 pt-5 border-t border-border">
          <button 
            type="button" 
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-colors duration-200" 
            onClick={handleAddRow}
          >
            <Plus size={15} /> 
            <span>Add Product Row</span>
          </button>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/damage" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-colors duration-200">
              Cancel
            </Link>
            <button 
              type="submit" 
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-colors shadow duration-200 ${
                reportType === 'LOST' ? 'bg-warning hover:bg-warning/90' : 'bg-danger hover:bg-danger/90'
              }`}
              disabled={loading || items.length === 0}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>{reportType === 'LOST' ? 'Submit Loss Report' : 'Submit Damage Logs'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Floating Webcam Scanner Panel */}
      {isCameraOpen && (
        <div className="fixed bottom-4 right-4 z-[999] w-[520px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-elevated/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-bold text-text-primary">Scan Damaged Barcode</span>
              <span className="text-[10px] font-semibold text-text-muted">{currentScannedCount} scanned</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="custom-checkbox" checked={isBulkScan} onChange={(e) => setIsBulkScan(e.target.checked)} />
                <span className="text-[10px] font-bold text-text-secondary uppercase">Bulk</span>
              </label>
              <button type="button" className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" onClick={() => { setIsCameraOpen(false); setActiveCameraRow(null); }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {activeCameraRow !== null && (
            <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-bold text-primary">Scanning into:</span>
              <span className="text-[10px] font-semibold text-text-primary bg-primary/10 px-2 py-0.5 rounded-full">Item #{activeCameraRow + 1}</span>
            </div>
          )}
          {activeCameraRow === null && (
            <div className="px-4 py-2.5 bg-warning/5 border-b border-border flex items-center gap-2 flex-shrink-0">
              <AlertCircle size={12} className="text-warning flex-shrink-0" />
              <span className="text-[11px] font-semibold text-warning">Select an item's Scan button on the form first</span>
            </div>
          )}

          {cameraPermissionStatus !== 'granted' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3 px-4">
              {cameraPermissionStatus === 'prompt' ? (
                <><Loader2 size={24} className="animate-spin text-primary" /><span className="text-[11px] text-text-secondary">Requesting camera access...</span></>
              ) : (
                <><div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center"><Camera size={20} /></div><span className="text-[11px] text-text-secondary">Camera access blocked.</span><button type="button" onClick={() => retryCameraPermission()} className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-lg">Retry</button></>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="relative h-[180px] bg-black"><div id="camera-reader-element" className="w-full h-full"></div></div>
              {isBulkScan && currentScannedCount > 0 && (
                <div className="max-h-[100px] overflow-y-auto flex flex-wrap gap-1.5 p-3 bg-surface-elevated/30 border-t border-border">
                  {scannedBarcodesList.map((code, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-danger/10 text-danger border border-danger/20 text-[10px] font-mono px-2 py-0.5 rounded font-semibold">{code}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile Scanner Pairing Modal */}
      {isMobileModalOpen && mobileSession && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-[450px] shadow-lg flex flex-col gap-4 animate-slide-down text-center">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="font-display font-bold text-sm text-text-primary">Pair Mobile Barcode Scanner</h3>
              <button 
                type="button" 
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
                onClick={() => { setIsMobileModalOpen(false); setActiveCameraRow(null); }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              {/* QR Code Container */}
              <div className="p-3 bg-white border border-border rounded-lg shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(getClientScanCompanionUrl(mobileSession.sessionId, mobileSession.localIp, mobileSession.port))}`}
                  alt="Scan QR to pair phone"
                  className="w-[200px] h-[200px] block"
                />
              </div>

              <div className="flex flex-col gap-1.5 max-w-sm">
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mx-auto">
                  Pairing Code: {mobileSession.sessionId}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed px-4 mt-2">
                  1. Scan this QR code with your phone's camera.<br/>
                  2. Keep both phone and PC on the same Wi-Fi.<br/>
                  3. Scan barcodes with your phone to sync instantly!
                </p>
              </div>

              {/* Loader indicator */}
              <div className="flex items-center justify-center gap-2 mt-2 py-1.5 px-4 bg-surface-elevated rounded-lg border border-border">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-[11px] font-bold text-text-secondary uppercase">Waiting for mobile scans...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DamageClient({ products, brands = [], initialItems = null, lockedType = null, stores = [], directSellers = [] }) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    }>
      <DamageFormContent products={products} brands={brands} initialItems={initialItems} lockedType={lockedType} stores={stores} directSellers={directSellers} />
    </Suspense>
  );
}
