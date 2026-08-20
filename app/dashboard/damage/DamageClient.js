'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, AlertCircle, Camera, QrCode, X, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { createBulkDamageTransactions } from '@/app/actions/transactions';
import { getAvailableBarcodes, getProductStockAtLocation } from '@/app/actions/products';
import CustomSelect from '@/components/CustomSelect';
import { getClientScanCompanionUrl } from '@/lib/scan-companion-url';

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

function DamageFormContent({ products, brands = [], initialItems = null, lockedType = null, stores = [], directSellers = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  // State for bulk damage items
  const [items, setItems] = useState([]);

  // Scanning inputs states (one per row index)
  const [scanInputs, setScanInputs] = useState({});

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraRow, setActiveCameraRow] = useState(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);

  // Sync isBulkScan to Ref to prevent stale closures without re-triggering camera instantiations
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Initialize selected products from URL search parameter "productIds" or initialItems
  useEffect(() => {
    const initRows = async () => {
      let initialItemsList = [];
      if (initialItems) {
        initialItemsList = initialItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          selectedBarcodes: item.barcodes || [],
          availableBarcodes: [],
          currentStock: 0,
          notes: item.notes || ''
        }));
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
              notes: ''
            };
          });
        } else {
          const defaultId = products[0]?.id || '';
          const prod = products.find(p => p.id === defaultId);
          initialItemsList = [{
            productId: defaultId,
            quantity: prod?.isSerialized ? 0 : 1,
            selectedBarcodes: [],
            availableBarcodes: [],
            currentStock: prod?.warehouseStock || 0,
            notes: ''
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
            setItems(prev => prev.map((x, idx) => idx === i ? { ...x, availableBarcodes: available || [], currentStock: stock } : x));
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    initRows();
  }, [searchParams, products]);

  // Effect to reload available barcodes and stock counts when location changes
  useEffect(() => {
    const reloadLocationData = async () => {
      const updated = await Promise.all(items.map(async (item) => {
        const prod = products.find(p => p.id === item.productId);
        let available = [];
        let currentStock = 0;
        
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
          currentStock
        };
      }));
      setItems(updated);
    };

    if (items.length > 0) {
      reloadLocationData();
    }
  }, [fromType, fromId]);

  const handleAddRow = async () => {
    const defaultId = products[0]?.id || '';
    const prod = products.find(p => p.id === defaultId);
    const newIdx = items.length;
    let available = [];
    let currentStock = prod?.warehouseStock || 0;

    if (prod) {
      if (prod.isSerialized) {
        try {
          available = await getAvailableBarcodes(defaultId, fromType, fromId || null);
          currentStock = available.length;
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          if (fromType === 'WAREHOUSE') {
            currentStock = prod.warehouseStock;
          } else {
            currentStock = await getProductStockAtLocation(defaultId, fromType, fromId || null);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    
    setItems(prev => [...prev, { 
      productId: defaultId, 
      quantity: prod?.isSerialized ? 0 : 1, 
      selectedBarcodes: [], 
      availableBarcodes: available || [], 
      currentStock,
      notes: '' 
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
      notes: ''
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
        alert(`Barcode "${scanInputs[index]}" is not in the Warehouse.`);
      }
      setScanInputs(prev => ({ ...prev, [index]: '' }));
    }
  };

  // Camera permissions check
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

  // Camera scanned hook
  useEffect(() => {
    let html5QrcodeScanner = null;
    if (isCameraOpen && activeCameraRow !== null && cameraPermissionStatus === 'granted') {
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
              const lowercaseCode = code.toLowerCase();
              const now = Date.now();
              
              // Cooldown checks
              if (lowercaseCode === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = lowercaseCode;
              lastScannedTimeRef.current = now;

              setItems(prev => {
                const item = prev[activeCameraRow];
                if (!item) return prev;

                const matched = item.availableBarcodes.find(b => b.barcode.toLowerCase() === lowercaseCode);
                if (matched) {
                  if (!item.selectedBarcodes.includes(matched.barcode)) {
                    playBeep();
                    const newSelected = [...item.selectedBarcodes, matched.barcode];
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
                    return prev.map((x, idx) => idx === activeCameraRow ? { ...x, selectedBarcodes: newSelected, quantity: newSelected.length } : x);
                  }
                } else {
                  alert(`Barcode "${decodedText}" is not in the Warehouse.`);
                }
                return prev;
              });

              if (!isBulkScanRef.current) {
                setIsCameraOpen(false);
                setActiveCameraRow(null);
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
        html5QrcodeScanner.clear().catch(e => console.error(e));
      }
    };
  }, [isCameraOpen, activeCameraRow, cameraPermissionStatus]);

  // Hook to dynamically inject scanning laser line & custom corners over the live HTML video container
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
        setIsMobileModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to initialize mobile session:", e);
    }
  };

  // Poll for mobile scanned items
  useEffect(() => {
    let interval = null;
    if (mobileSession?.sessionId && activeCameraRow !== null && isCompanionActive) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              data.barcodes.forEach(code => {
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
                    alert(`Mobile Scanned Barcode "${cleanCode}" is not available in the Warehouse.`);
                  }
                  return prev;
                });
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
      if (!prod?.isSerialized) {
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

    const itemsPayload = items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: prod?.isSerialized ? item.selectedBarcodes.length : item.quantity,
        barcodes: prod?.isSerialized ? item.selectedBarcodes : [],
        notes: item.notes
      };
    });

    try {
      await createBulkDamageTransactions({
        fromEntityType: fromType,
        fromEntityId: fromId || null,
        transactionType: reportType,
        items: itemsPayload
      });
      const label = reportType === 'LOST' ? 'loss' : 'damage';
      setSuccessMsg(`Logged ${label} of ${items.length} product(s) successfully!`);
      setTimeout(() => {
        router.push('/dashboard/damage');
      }, 1500);
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
        <AlertCircle size={250} />
      </div>
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link
          href={lockedType === 'LOST' ? '/dashboard/loss' : '/dashboard/damage'}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            {lockedType === 'LOST' ? 'Report Loss / Missing' : 'Report Damage & Wastage'}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {lockedType === 'LOST'
              ? 'Log items that are missing, stolen, or cannot be accounted for.'
              : 'Log damaged items or serial numbers to discard them from Central Warehouse stock.'}
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
          <span>{successMsg}</span>
        </div>
      )}

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
                      onChange={(e) => { setFromId(e.target.value); setShowDirectSellerSuggestions(true); }}
                      onFocus={() => setShowDirectSellerSuggestions(true)}
                    onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); const next = e.target.nextElementSibling; if (next && next.tagName === 'DIV') { const btns = next.querySelectorAll('button'); if (btns.length > 0) btns[0].focus(); } } }}
                      onBlur={(e) => { if (e.relatedTarget && e.relatedTarget.getAttribute('data-smart') === 'true') return; setTimeout(() => setShowDirectSellerSuggestions(false), 250); }}
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
                            type="button" data-smart="true" onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const btns = Array.from(e.target.parentElement.querySelectorAll('button')); const idx = btns.indexOf(e.target); if (e.key === 'ArrowDown' && idx < btns.length - 1) btns[idx + 1].focus(); else if (e.key === 'ArrowUp') { if (idx > 0) btns[idx - 1].focus(); else e.target.parentElement.previousElementSibling?.focus(); } } }} 
                            className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary transition-colors border-b border-border last:border-0 font-medium"
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
                          disabled: items.filter((_, i) => i !== index).map(it => it.productId).filter(Boolean).includes(p.id)
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
                           className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                           min={1} 
                           max={item.currentStock || 0}
                           value={item.quantity}
                           onChange={(e) => handleFieldChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                           required 
                         />
                         {item.quantity > (item.currentStock || 0) && (
                           <span className="text-[10px] font-semibold text-danger mt-1 animate-pulse block">
                             ⚠️ Warning: Quantity exceeds available stock ({item.currentStock || 0})!
                           </span>
                         )}
                         {item.quantity <= 0 && (
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
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
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
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                    value={item.notes}
                    onChange={(e) => handleFieldChange(index, 'notes', e.target.value)}
                    placeholder="e.g. Scratched panel, Damaged packaging..."
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-5 border-t border-border">
          <button 
            type="button" 
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" 
            onClick={handleAddRow}
          >
            <Plus size={15} /> 
            <span>Add Product Row</span>
          </button>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/damage" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
              Cancel
            </Link>
            <button 
              type="submit" 
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
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

      {/* Webcam Scanning Modal Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] sm:max-w-[850px] max-h-[90vh] shadow-lg flex flex-col gap-4 animate-slide-down overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
              <h3 className="font-display font-bold text-sm text-text-primary">Scan Damaged Barcode</h3>
              
              <div className="flex items-center gap-3">
                {/* Bulk Scan Toggle */}
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
                  className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
                  onClick={() => { setIsCameraOpen(false); setActiveCameraRow(null); }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {cameraPermissionStatus !== 'granted' ? (
              // Full-screen modal content for prompt/denied states
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
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
                      <h4 className="font-display font-extrabold text-base text-text-primary">Camera Permissions Blocked</h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Camera permissions are required to scan barcodes. Please click the button below to request access or adjust your browser address bar settings.
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
                          alert("Camera access is still blocked. Please enable it in your browser address bar site settings.");
                        }
                      }}
                      className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Enable Camera Access
                    </button>
                  </>
                )}
              </div>
            ) : (
              // Responsive Split Grid when granted
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch overflow-y-auto sm:overflow-hidden min-h-[300px]">
                
                {/* Left Column: Camera Viewport */}
                <div className="flex flex-col gap-2 min-h-[260px] sm:min-h-0 justify-center">
                  <div className="relative w-full rounded-lg overflow-hidden border border-border bg-surface flex items-center justify-center">
                    {/* The html5-qrcode element */}
                    <div id="camera-reader-element" className="w-full"></div>
                  </div>
                </div>

                {/* Right Column: Scanned list status logs */}
                <div className="flex flex-col gap-3 min-h-[160px] sm:min-h-0 sm:overflow-hidden">
                  {isBulkScan ? (
                    <div className="flex-1 flex flex-col gap-2 p-3 bg-surface-elevated border border-border/65 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-text-secondary uppercase">
                          Scanned Barcodes ({currentScannedCount})
                        </span>
                        {currentScannedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange(activeCameraRow, 'selectedBarcodes', [])}
                            className="text-[10px] text-danger hover:underline font-semibold"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto pr-1">
                        {currentScannedCount === 0 ? (
                          <span className="text-[11px] text-text-muted italic block py-4 text-center">
                            Ready to scan... Position code in video container overlay.
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 p-1.5 bg-surface rounded border border-border/40">
                            {scannedBarcodesList.map((code, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center gap-1 bg-danger/10 text-danger border border-danger/20 text-[10px] font-mono px-2 py-0.5 rounded font-semibold animate-pulse-once"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-2 p-4 bg-surface-elevated rounded-lg border border-border text-center text-text-secondary justify-center">
                      <QrCode className="mx-auto text-text-muted mb-2" size={32} />
                      <span className="text-xs font-bold text-text-primary">Single Scan Mode</span>
                      <p className="text-[11px] text-text-secondary leading-relaxed px-2">
                        Align a barcode inside the target box. The scanner will register the code and close the window automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
