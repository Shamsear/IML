'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, ArrowDownLeft, AlertCircle, Camera, QrCode, X, Smartphone, CheckCircle, Edit2, Info } from 'lucide-react';
import Link from 'next/link';
import { createBulkReceiveTransactions } from '@/app/actions/transactions';
import CustomSelect from '@/components/CustomSelect';

// Synthesize a premium barcode scanner beep sound (100% fileless/client-only)
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 900; // High pitch crisp beep
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.error(e);
  }
};

function InboundFormContent({ products, brands = [], recentReceivers = [], recentSuppliers = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Source (From) states - Locked to SUPPLIER
  const [fromId, setFromId] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  // Received By details - Receiver is locked to WAREHOUSE
  const [receivedBy, setReceivedBy] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Webcam scanning state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Sync isBulkScan to Ref
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

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

  // Helper to construct a blank receipt item configuration
  const createEmptyInboundItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    isNewProduct: false,
    productId: products[0]?.id || '',
    quantity: products[0]?.isSerialized ? 0 : 1,
    barcodesInput: '',
    notes: '',
    rangeStart: '',
    rangeEnd: '',
    rangeMode: false, // true = range builder, false = scan/text input
    isExpanded: true,
    error: '',
    // Inline Product registration states
    prodName: '',
    prodType: 'NORMAL',
    prodBrandId: brands[0]?.id || '',
    prodCategory: 'General',
    prodItemCode: '',
    prodLowStockAlert: '10',
    prodIsReturnable: false,
    prodImageFile: null,
    prodImagePreview: '',
  });

  // State array for receipt items queue
  const [items, setItems] = useState([]);

  // Initialize selected products from URL search parameter "productIds"
  useEffect(() => {
    const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
    if (urlIds.length > 0) {
      const initialItems = urlIds.map((id, idx) => {
        const prod = products.find(p => p.id === id);
        return {
          id: `temp-${Date.now()}-${idx}`,
          isNewProduct: false,
          productId: id,
          quantity: prod?.isSerialized ? 0 : 1,
          barcodesInput: '',
          notes: '',
          rangeStart: '',
          rangeEnd: '',
          rangeMode: false,
          isExpanded: idx === 0, // expand first item by default
          error: '',
          prodName: '',
          prodType: 'NORMAL',
          prodBrandId: brands[0]?.id || '',
          prodCategory: 'General',
          prodItemCode: '',
          prodLowStockAlert: '10',
          prodIsReturnable: false,
          prodImageFile: null,
          prodImagePreview: '',
        };
      });
      setItems(initialItems);
    } else {
      setItems([createEmptyInboundItem(0)]);
    }
  }, [searchParams, products, brands]);

  // Helper to update specific fields on item
  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      
      // If product changes, reset quantity based on tracking type
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        updated.quantity = prod?.isSerialized ? 0 : 1;
        updated.barcodesInput = '';
        updated.rangeStart = '';
        updated.rangeEnd = '';
      }

      // If inline product type changes, reset categories & serial lists
      if (field === 'prodType') {
        if (value === 'SIM') {
          updated.prodCategory = 'SIM Cards';
        } else if (value === 'ROUTER') {
          updated.prodCategory = 'Routers';
        } else {
          updated.prodCategory = 'General';
        }
        updated.quantity = 0;
        updated.barcodesInput = '';
        updated.rangeStart = '';
        updated.rangeEnd = '';
      }
      
      // Auto-update quantity if barcodesInput changes on serialized products
      if (field === 'barcodesInput') {
        const isSerialized = item.isNewProduct
          ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
          : (products.find(p => p.id === item.productId)?.isSerialized || false);
        if (isSerialized) {
          const barcodes = value.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
          updated.quantity = barcodes.length;
        }
      }
      return updated;
    }));
  };

  const addBarcodeToActiveItem = (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    let added = false;
    setItems(prev => {
      const activeIdx = prev.findIndex(item => item.isExpanded);
      if (activeIdx === -1) return prev;

      const activeItem = prev[activeIdx];
      
      if (activeItem.rangeMode) {
        // Range Input Mode: populate rangeStart and rangeEnd sequentially
        const start = activeItem.rangeStart.trim();
        const end = activeItem.rangeEnd.trim();
        if (!start) {
          added = true;
          return prev.map((item, i) => i === activeIdx ? { ...item, rangeStart: cleanCode } : item);
        } else if (!end) {
          added = true;
          return prev.map((item, i) => i === activeIdx ? { ...item, rangeEnd: cleanCode } : item);
        }
        return prev;
      } else {
        // Standard scan mode
        const currentList = activeItem.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          added = true;
          return prev.map((item, i) => i === activeIdx ? { 
            ...item, 
            barcodesInput: newList.join('\n'),
            quantity: newList.length
          } : item);
        }
        return prev;
      }
    });
    return added;
  };

  // Webcam scanning hooks
  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setCameraPermissionStatus('granted');
        })
        .catch(err => {
          console.error("Camera access error:", err);
          setCameraPermissionStatus('denied');
        });
    } else {
      setCameraPermissionStatus('prompt');
    }
  }, [isCameraOpen]);

  useEffect(() => {
    let html5QrcodeScanner = null;
    if (isCameraOpen && cameraPermissionStatus === 'granted') {
      const initScanner = async () => {
        try {
          const { Html5QrcodeScanner } = await import('html5-qrcode');
          html5QrcodeScanner = new Html5QrcodeScanner(
            "camera-reader-element",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
          );
          
          html5QrcodeScanner.render(
            (decodedText) => {
              const code = decodedText.trim();
              const now = Date.now();
              
              if (code.toLowerCase() === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = code.toLowerCase();
              lastScannedTimeRef.current = now;

              const added = addBarcodeToActiveItem(code);
              if (added) {
                playBeep();
                const flashOverlay = document.querySelector('.custom-scan-overlay > div');
                if (flashOverlay) {
                  flashOverlay.style.borderColor = '#10b981';
                  flashOverlay.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.4)';
                  setTimeout(() => {
                    if (flashOverlay) {
                      flashOverlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      flashOverlay.style.boxShadow = 'none';
                    }
                  }, 400);
                }
              }

              if (!isBulkScanRef.current) {
                setIsCameraOpen(false);
              }
            },
            (err) => {}
          );
        } catch (e) {
          console.error("Scanner failed:", e);
        }
      };
      initScanner();
    }
    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error("Failed to clear scanner:", e));
      }
    };
  }, [isCameraOpen, cameraPermissionStatus]);

  // Inject scan laser overlay
  useEffect(() => {
    if (cameraPermissionStatus === 'granted') {
      const interval = setInterval(() => {
        const videoElement = document.querySelector('#camera-reader-element video');
        if (videoElement) {
          clearInterval(interval);
          const videoParent = videoElement.parentElement;
          if (videoParent) {
            videoParent.style.position = 'relative';
            if (!videoParent.querySelector('.custom-scan-overlay')) {
              const overlay = document.createElement('div');
              overlay.className = 'custom-scan-overlay absolute inset-0 pointer-events-none flex items-center justify-center z-10';
              overlay.innerHTML = `
                <div class="w-[250px] h-[250px] border-2 border-white/30 rounded-lg relative overflow-hidden transition-all duration-300">
                  <div class="absolute top-0 left-0 right-0 h-0.5 bg-success shadow-[0_0_8px_#10b981] animate-scanner-laser"></div>
                  <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-success"></div>
                  <div class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-success"></div>
                  <div class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-success"></div>
                  <div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-success"></div>
                </div>
              `;
              videoParent.appendChild(overlay);
            }
          }
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [cameraPermissionStatus]);

  // Mobile companion scanner pairing
  const handleOpenMobileScanner = async () => {
    try {
      if (mobileSession?.sessionId) {
        setIsMobileModalOpen(true);
        return;
      }
      
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

  // Poll mobile companion scanned barcodes
  useEffect(() => {
    let interval = null;
    if (isMobileModalOpen && mobileSession?.sessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              data.barcodes.forEach(code => {
                const added = addBarcodeToActiveItem(code);
                if (added) playBeep();
              });
            }
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMobileModalOpen, mobileSession]);

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  // Generate sequence ranges for barcodes
  const generateSeries = (startCode, endCode) => {
    const startNumMatch = startCode.match(/\d+$/);
    const endNumMatch = endCode.match(/\d+$/);
    if (!startNumMatch || !endNumMatch) throw new Error("Range boundary barcodes must end with numbers.");

    const startNumStr = startNumMatch[0];
    const endNumStr = endNumMatch[0];
    const startNum = parseInt(startNumStr, 10);
    const endNum = parseInt(endNumStr, 10);
    
    if (startNum > endNum) throw new Error("Starting serial number cannot be larger than ending serial number.");
    if (endNum - startNum > 2000) throw new Error("Maximum range is limited to 2,000 serial mappings at a time.");

    const prefix = startCode.substring(0, startCode.length - startNumStr.length);
    const endPrefix = endCode.substring(0, endCode.length - endNumStr.length);
    if (prefix !== endPrefix) throw new Error("Barcodes must share matching alphanumeric prefixes.");

    const paddingLength = startNumStr.length;
    const generated = [];
    for (let val = startNum; val <= endNum; val++) {
      const valStr = val.toString().padStart(paddingLength, '0');
      generated.push(`${prefix}${valStr}`);
    }
    return generated;
  };

  const handleApplyRange = (idx) => {
    const item = items[idx];
    const start = item.rangeStart.trim();
    const end = item.rangeEnd.trim();
    if (!start || !end) {
      alert("Please enter both starting and ending barcodes.");
      return;
    }

    try {
      const generated = generateSeries(start, end);
      const currentList = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      const mergedList = Array.from(new Set([...currentList, ...generated]));
      
      updateItemField(idx, 'barcodesInput', mergedList.join('\n'));
      updateItemField(idx, 'rangeStart', '');
      updateItemField(idx, 'rangeEnd', '');
      playBeep();
    } catch (e) {
      alert(e.message || "Failed to generate barcode series.");
    }
  };

  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyInboundItem(prev.length)));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (item.isNewProduct) {
      if (!item.prodName.trim()) {
        updateItemField(idx, 'error', 'Product name is required for new product registration');
        return;
      }
      if (!item.prodBrandId) {
        updateItemField(idx, 'error', 'Brand is required for new product registration');
        return;
      }
      const isSerialized = item.prodType === 'SIM' || item.prodType === 'ROUTER';
      if (!isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
        updateItemField(idx, 'error', 'Quantity must be greater than 0');
        return;
      }
      if (isSerialized && item.quantity === 0) {
        updateItemField(idx, 'error', 'Please scan or enter at least one serial barcode');
        return;
      }
    } else {
      if (!item.productId) {
        updateItemField(idx, 'error', 'Product selection is required');
        return;
      }
      const prod = products.find(p => p.id === item.productId);
      if (!prod?.isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
        updateItemField(idx, 'error', 'Quantity must be greater than 0');
        return;
      }
      if (prod?.isSerialized && item.quantity === 0) {
        updateItemField(idx, 'error', 'Please scan or enter at least one serial barcode');
        return;
      }
    }

    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyInboundItem(0)];
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(item => item.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  // Submit batch transaction
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Global Form Validation
    if (!fromId.trim()) {
      setError('Please enter a valid source supplier name');
      setLoading(false);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isNewProduct) {
        if (!item.prodName.trim()) {
          updateItemField(i, 'error', 'Product name is required for new product registration');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (!item.prodBrandId) {
          updateItemField(i, 'error', 'Brand is required for new product registration');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        const isSerialized = item.prodType === 'SIM' || item.prodType === 'ROUTER';
        if (!isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
          updateItemField(i, 'error', 'Quantity must be greater than 0');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (isSerialized && item.quantity === 0) {
          updateItemField(i, 'error', 'Please scan or enter at least one serial barcode');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      } else {
        const prod = products.find(p => p.id === item.productId);
        if (!item.productId) {
          updateItemField(i, 'error', 'Product selection is required');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (!prod?.isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
          updateItemField(i, 'error', 'Quantity must be greater than 0');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (prod?.isSerialized && item.quantity === 0) {
          updateItemField(i, 'error', 'Please scan or enter at least one serial barcode');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      }
    }

    // Construct FormData
    const formData = new FormData();
    formData.append('fromEntityType', 'SUPPLIER');
    formData.append('fromEntityId', fromId.trim());
    formData.append('toEntityType', 'WAREHOUSE');
    formData.append('toEntityId', '');
    formData.append('receivedBy', receivedBy || '');

    // Map items to payload
    const itemsPayload = items.map((item, idx) => {
      const isSerialized = item.isNewProduct 
        ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
        : (products.find(p => p.id === item.productId)?.isSerialized || false);

      let barcodes = [];
      if (isSerialized) {
        barcodes = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      }

      if (item.isNewProduct && item.prodImageFile) {
        formData.append(`item_${idx}_imageFile`, item.prodImageFile);
      }

      return {
        isNewProduct: item.isNewProduct,
        productId: item.productId,
        quantity: parseInt(item.quantity, 10),
        barcodes,
        notes: item.notes,
        // Inline Product details
        prodName: item.prodName,
        prodType: item.prodType,
        prodBrandId: item.prodBrandId,
        prodCategory: item.prodCategory,
        prodItemCode: item.prodItemCode,
        prodLowStockAlert: item.prodLowStockAlert,
        prodIsReturnable: item.prodIsReturnable,
      };
    });

    formData.append('items', JSON.stringify(itemsPayload));

    try {
      await createBulkReceiveTransactions(formData);
      setSuccessMsg(`Logged inbound receive of ${items.length} items successfully!`);
      setTimeout(() => {
        router.push('/dashboard/inbound');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to complete inbound transaction.');
      setLoading(false);
    }
  };

  // Autocomplete Suggestions for Receiver
  const filteredSuggestions = recentReceivers.filter(r => 
    r.toLowerCase().includes(receivedBy.toLowerCase()) && 
    r.toLowerCase() !== receivedBy.toLowerCase()
  );

  // Autocomplete Suggestions for Supplier
  const filteredSupplierSuggestions = recentSuppliers.filter(s => 
    s.toLowerCase().includes(fromId.toLowerCase()) && 
    s.toLowerCase() !== fromId.toLowerCase()
  );

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link href="/dashboard/inbound" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inbound Stock Receive
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Log supplier shipments in a rapid batch accordion queue.
          </p>
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
          <CheckCircle size={16} className="text-success" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Global Form Configurations */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ArrowDownLeft size={18} className="text-success" />
          <span>Inbound Shipment Details</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Supplier (From)</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={fromId}
                onChange={(e) => { setFromId(e.target.value); setShowSupplierSuggestions(true); }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                placeholder="e.g. Sadia Supplier"
                required
              />
              {showSupplierSuggestions && filteredSupplierSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                  {filteredSupplierSuggestions.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium"
                      onClick={() => {
                        setFromId(name);
                        setShowSupplierSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Received By (Staff)</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={receivedBy}
                onChange={(e) => { setReceivedBy(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                placeholder="e.g. John Doe"
                required
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                  {filteredSuggestions.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium"
                      onClick={() => {
                        setReceivedBy(name);
                        setShowSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Form Cards Queue */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const selectedProd = products.find(p => p.id === item.productId);
            const brandObj = brands.find(b => b.id === item.prodBrandId);
            const isSerialized = item.isNewProduct
              ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
              : (selectedProd?.isSerialized || false);

            const displayTitle = item.isNewProduct
              ? (item.prodName || `New Product Entry #${idx + 1}`)
              : (selectedProd ? `${selectedProd.brand.name} - ${selectedProd.name}` : `Receipt Entry #${idx + 1}`);

            return (
              <div 
                key={item.id}
                className={`bg-surface border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden
                  ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
                `}
              >
                {/* 1. COLLAPSED PREVIEW CARD */}
                {!item.isExpanded && (
                  <div 
                    onClick={() => handleExpandItem(idx)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.isNewProduct ? (
                        item.prodImagePreview ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                            <img src={item.prodImagePreview} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                            <Camera size={18} />
                          </div>
                        )
                      ) : (
                        selectedProd?.imageUrl ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                            <img src={selectedProd.imageUrl} alt="Product" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                            <Camera size={18} />
                          </div>
                        )
                      )}
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-primary truncate">
                            {displayTitle}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider
                            ${item.isNewProduct ? 'bg-success/15 text-success border border-success/20' : 'bg-surface-elevated border border-border text-text-secondary'}
                          `}>
                            {item.isNewProduct ? 'New Inline' : 'Catalog'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {item.isNewProduct ? (
                            <span>Brand: <strong>{brandObj?.name || '---'}</strong> | Tracking: <strong>{item.prodType}</strong></span>
                          ) : (
                            <span>Category: <strong>{selectedProd?.category || '---'}</strong> | Tracking: <strong>{isSerialized ? 'Serialized' : 'Bulk'}</strong></span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Inbound Qty</span>
                        <span className="text-xs font-bold text-primary">
                          {item.quantity || 0} items
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleExpandItem(idx)}
                          className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          title="Expand Entry"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                          title="Remove Entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. EXPANDED FORM CARD */}
                {item.isExpanded && (
                  <div className="p-6 sm:p-8 flex flex-col gap-6 animate-slide-down">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Receipt Item Entry #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                      >
                        <Trash2 size={13} />
                        <span>Remove Item</span>
                      </button>
                    </div>

                    {item.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{item.error}</span>
                      </div>
                    )}

                    {/* Radio toggle for existing vs inline product creation */}
                    <div className="flex items-center gap-6 pb-4 border-b border-border/60">
                      <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                        <input
                          type="radio"
                          name={`productSource-${item.id}`}
                          checked={!item.isNewProduct}
                          onChange={() => updateItemField(idx, 'isNewProduct', false)}
                          className="accent-primary"
                        />
                        <span>Inbound Existing Catalog Product</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                        <input
                          type="radio"
                          name={`productSource-${item.id}`}
                          checked={item.isNewProduct}
                          onChange={() => updateItemField(idx, 'isNewProduct', true)}
                          className="accent-primary"
                        />
                        <span className="text-primary font-bold">Register &amp; Inbound New Product</span>
                      </label>
                    </div>

                    {/* Product fields based on selection */}
                    {!item.isNewProduct ? (
                      /* EXISTING PRODUCT dropdown */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">Product to Receive</label>
                          <CustomSelect
                            options={products.map(p => ({ value: p.id, label: `${p.brand.name} - ${p.name} (${p.category})`, imageUrl: p.imageUrl }))}
                            value={item.productId}
                            onChange={(val) => updateItemField(idx, 'productId', val)}
                            placeholder="-- Select Product --"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      /* NEW INLINE PRODUCT form */
                      <div className="flex flex-col gap-6 animate-slide-down">
                        <div className="flex flex-col gap-4">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60 flex items-center gap-1.5">
                            <Info size={13} className="text-primary" />
                            <span>1. New Catalog Classification</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Tracking Type</label>
                              <CustomSelect
                                options={[
                                  { value: 'NORMAL', label: 'Bulk Product (Stands, Shirts, etc.)' },
                                  { value: 'SIM', label: 'SIM Card (Serialized Barcode)' },
                                  { value: 'ROUTER', label: 'Router Device (Serialized Barcode)' },
                                ]}
                                value={item.prodType}
                                onChange={(val) => updateItemField(idx, 'prodType', val)}
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Associated Brand</label>
                              <CustomSelect
                                options={brands.map(b => ({ value: b.id, label: b.name }))}
                                value={item.prodBrandId}
                                onChange={(val) => updateItemField(idx, 'prodBrandId', val)}
                                placeholder="-- Select Brand --"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60">2. New Product Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-semibold text-text-secondary">Display Name</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                value={item.prodName}
                                onChange={(e) => updateItemField(idx, 'prodName', e.target.value)}
                                placeholder="e.g. Ooredoo Promo Stand"
                                required
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">SKU / Item Code</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                                value={item.prodItemCode}
                                onChange={(e) => updateItemField(idx, 'prodItemCode', e.target.value)}
                                placeholder="e.g. SKU-100223"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Category Group</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:bg-surface-elevated/45"
                                value={item.prodCategory}
                                onChange={(e) => updateItemField(idx, 'prodCategory', e.target.value)}
                                disabled={item.prodType !== 'NORMAL'}
                                placeholder="e.g. Materials"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Low Stock Threshold</label>
                              <input
                                type="number"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                value={item.prodLowStockAlert}
                                onChange={(e) => updateItemField(idx, 'prodLowStockAlert', e.target.value)}
                                placeholder="e.g. 10"
                              />
                            </div>

                            <div className="flex items-center gap-6 mt-4">
                              <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  className="custom-checkbox"
                                  checked={item.prodIsReturnable}
                                  onChange={(e) => updateItemField(idx, 'prodIsReturnable', e.target.checked)}
                                />
                                <span>Returnable Asset</span>
                              </label>
                            </div>

                            {/* Image Upload Area */}
                            <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                              <label className="text-xs font-semibold text-text-secondary">Product Image</label>
                              <div className="flex items-center gap-4 border border-border border-dashed p-4 rounded-xl bg-surface-elevated/10">
                                {item.prodImagePreview ? (
                                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <img src={item.prodImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateItemField(idx, 'prodImageFile', null);
                                        updateItemField(idx, 'prodImagePreview', '');
                                      }}
                                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                                    <Camera size={24} />
                                  </div>
                                )}
                                <div className="flex-1 flex flex-col gap-1.5">
                                  <span className="text-xs text-text-secondary">Upload product picture for catalog preview</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        updateItemField(idx, 'prodImageFile', file);
                                        updateItemField(idx, 'prodImagePreview', URL.createObjectURL(file));
                                      }
                                    }}
                                    className="hidden"
                                    id={`inline-image-${item.id}`}
                                  />
                                  <label
                                    htmlFor={`inline-image-${item.id}`}
                                    className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-1.5 w-fit border-dashed"
                                  >
                                    <span>Browse Picture</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stock quantities or barcode scanners */}
                    {!isSerialized ? (
                      /* BULK QUANTITY INPUT */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Quantity to Receive</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      /* SERIALIZED INPUT SECTION */
                      <div className="flex flex-col gap-4 pt-4 border-t border-border/60 animate-slide-down">
                        <div className="flex items-center justify-between pb-1">
                          <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <QrCode size={15} className="text-primary" />
                            <span>Scan / Input Serial Barcodes</span>
                          </label>
                          
                          {/* Range input builder mode toggle */}
                          <button
                            type="button"
                            onClick={() => updateItemField(idx, 'rangeMode', !item.rangeMode)}
                            className="text-xs text-primary font-bold hover:underline"
                          >
                            {item.rangeMode ? "Switch to Manual Scan List" : "Switch to Serial Range Builder"}
                          </button>
                        </div>

                        {item.rangeMode ? (
                          /* RANGE BUILDER CONTAINER */
                          <div className="p-4 bg-surface-elevated/20 border border-border border-dashed rounded-xl flex flex-col gap-3.5 animate-slide-down">
                            <div className="flex items-center gap-2 text-text-secondary text-[11px] font-medium leading-relaxed">
                              <span>Enter the starting barcode and ending barcode of the package sequence (e.g. SIM001 to SIM100) to auto-generate the list.</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Range Start Barcode</label>
                                <input
                                  type="text"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                                  placeholder="e.g. ACC001"
                                  value={item.rangeStart}
                                  onChange={(e) => updateItemField(idx, 'rangeStart', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Range End Barcode</label>
                                <input
                                  type="text"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                                  placeholder="e.g. ACC100"
                                  value={item.rangeEnd}
                                  onChange={(e) => updateItemField(idx, 'rangeEnd', e.target.value)}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApplyRange(idx)}
                              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow w-fit cursor-pointer"
                            >
                              Generate Range &amp; Add
                            </button>
                          </div>
                        ) : (
                          /* STANDARD SCANS / TEXT AREA */
                          <div className="flex flex-col gap-1.5 animate-slide-down">
                            <textarea
                              rows={5}
                              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary font-mono focus:ring-1 focus:ring-primary/20 leading-relaxed"
                              placeholder="Type or scan barcodes separated by commas or lines...&#10;e.g.&#10;SIM87600123&#10;SIM87600124"
                              value={item.barcodesInput}
                              onChange={(e) => updateItemField(idx, 'barcodesInput', e.target.value)}
                            />
                            <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1">
                              <span>Barcodes parsed: <strong className="text-primary">{item.quantity}</strong></span>
                              <span>Press Enter in the top scanner to quick-append barcodes.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes field */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Receipt Remarks / Notes</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 duration-200" 
                        value={item.notes}
                        onChange={(e) => updateItemField(idx, 'notes', e.target.value)}
                        placeholder="e.g. Delivered directly from regional supplier shipment..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => handleFinishItem(idx)}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow cursor-pointer"
                      >
                        Finish &amp; Collapse Card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add item row trigger button */}
        <button
          type="button"
          onClick={handleAddNewItem}
          className="w-full py-4 border-2 border-dashed border-border hover:border-primary/50 text-text-secondary hover:text-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all bg-surface/50 hover:bg-surface duration-200 cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Another Inbound Item</span>
        </button>

        {/* Action triggers */}
        <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-border">
          <Link href="/dashboard/inbound" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
            Cancel
          </Link>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-success hover:bg-success/90 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
            disabled={loading}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Log Inbound Receive</span>
          </button>
        </div>
      </form>

      {/* Webcam scanner overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] sm:max-w-[850px] max-h-[90vh] shadow-lg flex flex-col gap-4 animate-slide-down overflow-hidden">
            
            <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
              <h3 className="font-display font-bold text-sm text-text-primary">Camera Barcode Scanner</h3>
              
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox"
                    checked={isBulkScan}
                    onChange={(e) => setIsBulkScan(e.target.checked)}
                  />
                  <span className="text-[10px] font-bold text-text-secondary uppercase">Bulk Scan</span>
                </label>

                <button 
                  type="button" 
                  className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" 
                  onClick={() => setIsCameraOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {cameraPermissionStatus !== 'granted' ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4 flex-1">
                {cameraPermissionStatus === 'prompt' ? (
                  <>
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-xs text-text-secondary">Requesting camera access...</span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                      <Camera size={32} />
                    </div>
                    <div className="flex flex-col gap-1.5 max-w-sm">
                      <h4 className="font-display font-extrabold text-base text-text-primary">Camera Access Blocked</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Camera permissions are required to scan barcodes. Please enable it in browser settings.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                          stream.getTracks().forEach(track => track.stop());
                          setCameraPermissionStatus('granted');
                        } catch (e) {
                          alert("Camera access is still blocked. Please enable it in site settings.");
                        }
                      }}
                      className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md transition-all"
                    >
                      Enable Camera Access
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-border flex-1 bg-black flex items-center justify-center">
                <div id="camera-reader-element" className="w-full h-full"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wireless Companion pairings pairing modal */}
      {isMobileModalOpen && mobileSession && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-1.5">
                <Smartphone size={16} className="text-primary" />
                <span>Pair Wireless Companion Scanner</span>
              </h3>
              <button 
                type="button" 
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" 
                onClick={() => setIsMobileModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 text-center py-4 items-center">
              <div className="p-3 bg-primary/5 rounded-full text-primary border border-primary/10">
                <QrCode size={40} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-text-primary font-mono">Pair code: {mobileSession.sessionId}</span>
                <p className="text-[11px] text-text-secondary max-w-xs leading-relaxed mt-1">
                  Open the Wireless Companion app on your phone, scan this pairing code or type it in, and scan serial numbers instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboundClient({ products, recentReceivers, recentSuppliers, brands }) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    }>
      <InboundFormContent 
        products={products} 
        recentReceivers={recentReceivers}
        recentSuppliers={recentSuppliers}
        brands={brands}
      />
    </Suspense>
  );
}
