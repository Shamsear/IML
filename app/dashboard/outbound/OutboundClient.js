'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, ArrowUpRight, AlertCircle, QrCode, Camera, X, Smartphone, CheckCircle, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { createBulkIssueTransactions } from '@/app/actions/transactions';
import CustomSelect from '@/components/CustomSelect';
import { getAvailableBarcodes, findProductByBarcode } from '@/app/actions/products';

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

function OutboundFormContent({ products, stores, supervisors, staff }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Destination states
  const [toType, setToType] = useState('STORE');
  const [toId, setToId] = useState('');

  // Default toType initial destination selection
  useEffect(() => {
    if (toType === 'STORE') {
      setToId(stores[0]?.id || '');
    } else if (toType === 'STAFF') {
      setToId(staff[0]?.id || '');
    } else if (toType === 'SUPERVISOR') {
      setToId(supervisors[0]?.id || '');
    } else {
      setToId('');
    }
  }, [toType, stores, supervisors, staff]);

  // Global Scan Input State (for fast scanning)
  const [globalScanInput, setGlobalScanInput] = useState('');
  const [isGlobalScanExpanded, setIsGlobalScanExpanded] = useState(true);

  // Webcam scanning modal state
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

  // Helper to construct empty dispatch item configuration
  const createEmptyOutboundItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    productId: products[0]?.id || '',
    quantity: products[0]?.isSerialized ? 0 : 1,
    selectedBarcodes: [],
    availableBarcodes: [],
    notes: '',
    rangeStart: '',
    rangeEnd: '',
    rangeMode: false,
    isExpanded: true,
    error: '',
  });

  // State array for outbound items queue
  const [items, setItems] = useState([]);

  // Initialize selected products from URL search parameter "productIds"
  useEffect(() => {
    const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
    const initRows = async () => {
      let initialItems = [];
      if (urlIds.length > 0) {
        initialItems = urlIds.map((id, idx) => {
          const prod = products.find(p => p.id === id);
          return {
            id: `temp-${Date.now()}-${idx}`,
            productId: id,
            quantity: prod?.isSerialized ? 0 : 1,
            selectedBarcodes: [],
            availableBarcodes: [],
            notes: '',
            rangeStart: '',
            rangeEnd: '',
            rangeMode: false,
            isExpanded: idx === 0,
            error: '',
          };
        });

        // Auto-select store if the first product is a SIM matching a store name
        const firstProd = products.find(p => p.id === urlIds[0]);
        if (firstProd && (firstProd.category?.toUpperCase().includes('SIM') || firstProd.name?.toUpperCase().includes('SIM'))) {
          const matchedStore = stores.find(s => firstProd.name.toLowerCase().includes(s.name.toLowerCase()));
          if (matchedStore) {
            setToType('STORE');
            setToId(matchedStore.id);
          }
        }
      } else {
        initialItems = [createEmptyOutboundItem(0)];
      }
      setItems(initialItems);

      // Load available barcodes for serialized items on mount
      for (let i = 0; i < initialItems.length; i++) {
        const item = initialItems[i];
        const prod = products.find(p => p.id === item.productId);
        if (prod?.isSerialized) {
          try {
            const available = await getAvailableBarcodes(item.productId, 'WAREHOUSE', null);
            setItems(prev => prev.map((x, idx) => idx === i ? { ...x, availableBarcodes: available || [] } : x));
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    initRows();
  }, [searchParams, products, stores]);

  // Helper to update specific fields on item
  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  const handleProductChange = async (idx, val) => {
    const prod = products.find(p => p.id === val);
    
    // Auto-select store if this is a SIM product matching a store name
    if (prod && (prod.category?.toUpperCase().includes('SIM') || prod.name?.toUpperCase().includes('SIM'))) {
      const matchedStore = stores.find(s => prod.name.toLowerCase().includes(s.name.toLowerCase()));
      if (matchedStore) {
        setToType('STORE');
        setToId(matchedStore.id);
      }
    }

    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        productId: val,
        quantity: prod?.isSerialized ? 0 : 1,
        selectedBarcodes: [],
        availableBarcodes: [],
        rangeStart: '',
        rangeEnd: '',
      };
    }));

    if (prod?.isSerialized) {
      try {
        const available = await getAvailableBarcodes(val, 'WAREHOUSE', null);
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, availableBarcodes: available || [] } : item));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const addBarcodeToActiveItem = (code) => {
    const cleanCode = code.trim().toLowerCase();
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
          return prev.map((item, i) => i === activeIdx ? { ...item, rangeStart: code.trim() } : item);
        } else if (!end) {
          added = true;
          return prev.map((item, i) => i === activeIdx ? { ...item, rangeEnd: code.trim() } : item);
        }
        return prev;
      } else {
        // Standard scan mode
        const matched = activeItem.availableBarcodes.find(b => b.barcode.toLowerCase() === cleanCode);
        if (matched) {
          if (!activeItem.selectedBarcodes.includes(matched.barcode)) {
            added = true;
            const newSelected = [...activeItem.selectedBarcodes, matched.barcode];
            return prev.map((item, i) => i === activeIdx ? { 
              ...item, 
              selectedBarcodes: newSelected,
              quantity: newSelected.length
            } : item);
          }
        } else {
          alert(`Scanned Barcode "${code.trim()}" is not available in the Warehouse.`);
        }
        return prev;
      }
    });
    return added;
  };

  const processGlobalBarcode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    try {
      const serial = await findProductByBarcode(cleanCode);
      if (serial) {
        if (serial.status !== 'AVAILABLE') {
          alert(`Serial "${cleanCode}" is registered but currently has status "${serial.status}". It cannot be issued.`);
          return;
        }

        // Auto-select store if this is a SIM product matching a store name
        if (serial.product && (serial.product.category?.toUpperCase().includes('SIM') || serial.product.name?.toUpperCase().includes('SIM'))) {
          const matchedStore = stores.find(s => serial.product.name.toLowerCase().includes(s.name.toLowerCase()));
          if (matchedStore) {
            setToType('STORE');
            setToId(matchedStore.id);
          }
        }

        // Find if this product is already in our list
        const existingIdx = items.findIndex(item => item.productId === serial.product.id);
        if (existingIdx !== -1) {
          const item = items[existingIdx];
          if (!item.selectedBarcodes.includes(serial.barcode)) {
            // Check availability if not loaded
            let available = item.availableBarcodes;
            if (available.length === 0) {
              available = await getAvailableBarcodes(serial.product.id, 'WAREHOUSE', null);
            }
            setItems(prev => prev.map((x, idx) => idx === existingIdx ? {
              ...x,
              availableBarcodes: available,
              selectedBarcodes: [...x.selectedBarcodes, serial.barcode],
              quantity: x.selectedBarcodes.length + 1,
              isExpanded: true, // expand so user sees it
            } : { ...x, isExpanded: false }));
            playBeep();
          }
        } else {
          // Add product to list
          const available = await getAvailableBarcodes(serial.product.id, 'WAREHOUSE', null);
          setItems(prev => prev.map(x => ({ ...x, isExpanded: false })).concat({
            id: `temp-${Date.now()}-${prev.length}`,
            productId: serial.product.id,
            quantity: 1,
            selectedBarcodes: [serial.barcode],
            availableBarcodes: available || [],
            notes: '',
            rangeStart: '',
            rangeEnd: '',
            rangeMode: false,
            isExpanded: true,
            error: '',
          }));
          playBeep();
        }
      } else {
        alert(`Scanned Barcode "${cleanCode}" was not found in the catalogue.`);
      }
    } catch (err) {
      console.error("Global scan query failed:", err);
      alert("Error fetching barcode from server.");
    }
  };

  const handleGlobalScanSubmit = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = globalScanInput.trim();
      if (code) {
        await processGlobalBarcode(code);
        setGlobalScanInput('');
      }
    }
  };

  // Webcam scanning permissions
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
            async (decodedText) => {
              const code = decodedText.trim();
              const now = Date.now();
              
              if (code.toLowerCase() === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = code.toLowerCase();
              lastScannedTimeRef.current = now;

              const activeIdx = items.findIndex(item => item.isExpanded);
              if (activeIdx === -1) {
                // If no active item expanded, process as global scan!
                playBeep();
                await processGlobalBarcode(code);
              } else {
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

  // Poll mobile scans
  useEffect(() => {
    let interval = null;
    const activeIdx = items.findIndex(item => item.isExpanded);
    if (mobileSession?.sessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              for (const code of data.barcodes) {
                const cleanCode = code.trim();
                if (activeIdx === -1) {
                  playBeep();
                  await processGlobalBarcode(cleanCode);
                } else {
                  const added = addBarcodeToActiveItem(cleanCode);
                  if (added) playBeep();
                }
              }
            }
          }
        } catch (e) {
          console.error("Failed polling mobile scans:", e);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMobileModalOpen, mobileSession, items]);

  const handleApplyRange = (idx) => {
    const item = items[idx];
    const start = item.rangeStart.trim().toLowerCase();
    const end = item.rangeEnd.trim().toLowerCase();
    if (!start || !end) {
      alert("Please enter both starting and ending barcodes.");
      return;
    }

    const matched = item.availableBarcodes
      .map(b => b.barcode)
      .filter(bc => bc.toLowerCase() >= start && bc.toLowerCase() <= end);

    if (matched.length === 0) {
      alert("No available barcodes found in this range.");
      return;
    }

    setItems(prev => prev.map((x, i) => i === idx ? {
      ...x,
      selectedBarcodes: matched,
      quantity: matched.length
    } : x));
    
    playBeep();
  };

  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyOutboundItem(prev.length)));
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (!item.productId) {
      updateItemField(idx, 'error', 'Product selection is required');
      return;
    }
    const prod = products.find(p => p.id === item.productId);
    if (!prod?.isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
      updateItemField(idx, 'error', 'Quantity must be greater than 0');
      return;
    }
    if (prod?.isSerialized && item.selectedBarcodes.length === 0) {
      updateItemField(idx, 'error', 'Please select at least one barcode');
      return;
    }

    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyOutboundItem(0)];
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(item => item.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!toId && toType !== 'CLIENT') {
      setError('Please select a valid destination');
      setLoading(false);
      return;
    }

    // Validation Loop
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
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
      if (prod?.isSerialized && item.selectedBarcodes.length === 0) {
        updateItemField(i, 'error', `Please select at least one barcode for ${prod.name}`);
        handleExpandItem(i);
        setLoading(false);
        return;
      }
    }

    const itemsPayload = items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        quantity: prod?.isSerialized ? item.selectedBarcodes.length : parseInt(item.quantity, 10),
        barcodes: prod?.isSerialized ? item.selectedBarcodes : [],
        notes: item.notes
      };
    });

    try {
      await createBulkIssueTransactions({
        fromEntityType: 'WAREHOUSE',
        fromEntityId: null,
        toEntityType: toType,
        toEntityId: toId,
        items: itemsPayload
      });
      setSuccessMsg(`Dispatched all ${items.length} items successfully!`);
      setTimeout(() => {
        router.push('/dashboard/outbound');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to complete outbound transaction.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link href="/dashboard/outbound" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Outbound Stock Dispatch
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Dispatch inventory items to stores or staff in a batch accordion queue.
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

      {/* Destination Selection Header */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ArrowUpRight size={18} className="text-primary" />
          <span>Dispatch Destination Details</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Destination Category</label>
            <CustomSelect
              options={[
                { value: 'STORE', label: 'Retail Store / Placement' },
                { value: 'STAFF', label: 'Field Promoter (Direct)' },
                { value: 'SUPERVISOR', label: 'Field Supervisor' },
              ]}
              value={toType}
              onChange={(val) => setToType(val)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Assigned Target</label>
            {toType === 'STORE' && (
              <CustomSelect
                options={stores.map(s => ({ value: s.id, label: s.name }))}
                value={toId}
                onChange={(val) => setToId(val)}
                placeholder="-- Select Retail Store --"
                required
              />
            )}
            {toType === 'STAFF' && (
              <CustomSelect
                options={staff.map(s => ({ value: s.id, label: `${s.name} (${s.phone || 'No phone'})` }))}
                value={toId}
                onChange={(val) => setToId(val)}
                placeholder="-- Select Promoter --"
                required
              />
            )}
            {toType === 'SUPERVISOR' && (
              <CustomSelect
                options={supervisors.map(s => ({ value: s.id, label: s.name }))}
                value={toId}
                onChange={(val) => setToId(val)}
                placeholder="-- Select Supervisor --"
                required
              />
            )}
          </div>
        </div>
      </div>

      {/* Global Quick Scan Bar */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <div 
          onClick={() => setIsGlobalScanExpanded(!isGlobalScanExpanded)}
          className="p-4 bg-surface-elevated/40 flex items-center justify-between border-b border-border cursor-pointer"
        >
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
            <QrCode size={15} className="text-primary" />
            <span>Fast Global Barcode Scanner (Webcam/Wedge)</span>
          </span>
          <span className="text-[10px] text-text-secondary">Click to toggle panel</span>
        </div>

        {isGlobalScanExpanded && (
          <div className="p-5 flex flex-col sm:flex-row items-center gap-4 bg-surface animate-slide-down">
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary transition-all font-mono"
              placeholder="Focus here to scan or type a serial number..."
              value={globalScanInput}
              onChange={(e) => setGlobalScanInput(e.target.value)}
              onKeyDown={handleGlobalScanSubmit}
            />
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/scan-companion', { method: 'POST' });
                    if (res.ok) {
                      const data = await res.json();
                      setMobileSession(data);
                      setIsMobileModalOpen(true);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-primary rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                <Smartphone size={13} />
                <span>Pair Phone Companion</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                <Camera size={13} />
                <span>Camera Scan</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Accordion Form Cards Queue */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const selectedProd = products.find(p => p.id === item.productId);
            
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
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-text-primary block truncate">
                          {selectedProd ? `${selectedProd.brand.name} - ${selectedProd.name}` : <span className="text-text-muted italic">Select product...</span>}
                        </span>
                        <span className="text-[10px] text-text-secondary block mt-0.5">
                          {selectedProd?.isSerialized ? 'Serialized Tracking' : 'Bulk/Normal Product'} {item.notes && `| Remarks: ${item.notes}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Dispatch Qty</span>
                        <span className="text-xs font-extrabold text-primary">{item.quantity} units</span>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleExpandItem(idx)}
                          className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          title="Expand Entry"
                        >
                          <Edit2 size={14} />
                        </button>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                            title="Remove Entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. EXPANDED FORM CARD */}
                {item.isExpanded && (
                  <div className="p-6 sm:p-8 flex flex-col gap-6">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Dispatch Item Entry #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                        >
                          <Trash2 size={13} />
                          <span>Remove Item</span>
                        </button>
                      )}
                    </div>

                    {item.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{item.error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Product Selector */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-text-secondary">Product to Dispatch</label>
                        <CustomSelect
                          options={products.map(p => ({ value: p.id, label: `${p.brand.name} - ${p.name} (${p.category})`, imageUrl: p.imageUrl }))}
                          value={item.productId}
                          onChange={(val) => handleProductChange(idx, val)}
                          placeholder="-- Select Product --"
                          required
                        />
                      </div>

                      {/* Quantity Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Quantity to Dispatch</label>
                        <input
                          type="number"
                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:bg-surface-elevated/40"
                          value={item.quantity}
                          onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                          disabled={selectedProd?.isSerialized}
                          placeholder={selectedProd?.isSerialized ? 'Select serial numbers below' : 'e.g. 50'}
                          required
                        />
                        {selectedProd?.isSerialized && (
                          <span className="text-[10px] text-text-muted mt-0.5">Quantity is computed automatically from selected serial numbers.</span>
                        )}
                      </div>

                      {/* Notes / Remarks */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Item Notes / Remarks</label>
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                          value={item.notes}
                          onChange={(e) => updateItemField(idx, 'notes', e.target.value)}
                          placeholder="e.g. For marketing stands (Optional)"
                        />
                      </div>

                      {/* Serial selection section (only for serialized items) */}
                      {selectedProd?.isSerialized && (
                        <div className="sm:col-span-2 flex flex-col gap-3 mt-2 bg-surface-elevated/20 p-4 border border-border rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Select Serial Barcodes ({item.selectedBarcodes.length} chosen)</span>
                            <div className="flex items-center gap-2">
                              {/* Range mode toggle */}
                              <button
                                type="button"
                                onClick={() => updateItemField(idx, 'rangeMode', !item.rangeMode)}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border
                                  ${item.rangeMode 
                                    ? 'bg-primary text-white border-primary' 
                                    : 'bg-surface border-border hover:bg-surface-elevated text-text-primary'}
                                `}
                              >
                                {item.rangeMode ? 'Switch to Barcode Picker' : 'Switch to Range Select'}
                              </button>
                            </div>
                          </div>

                          {/* Range Builder Mode */}
                          {item.rangeMode ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-3 bg-surface border border-border rounded-lg animate-fade-in">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Start Barcode</label>
                                <input
                                  type="text"
                                  className="w-full bg-surface text-text-primary border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                                  value={item.rangeStart}
                                  onChange={(e) => updateItemField(idx, 'rangeStart', e.target.value)}
                                  placeholder="e.g. SN-0001"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">End Barcode</label>
                                <input
                                  type="text"
                                  className="w-full bg-surface text-text-primary border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
                                  value={item.rangeEnd}
                                  onChange={(e) => updateItemField(idx, 'rangeEnd', e.target.value)}
                                  placeholder="e.g. SN-0100"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplyRange(idx)}
                                className="w-full py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-md transition-all cursor-pointer border border-primary h-fit"
                              >
                                Apply Range
                              </button>
                            </div>
                          ) : (
                            /* Serial selector grid */
                            <div className="flex flex-col gap-2">
                              {item.availableBarcodes.length === 0 ? (
                                <div className="p-4 text-center text-xs text-text-muted">
                                  No available serials in WAREHOUSE for this product.
                                </div>
                              ) : (
                                <div className="max-h-48 overflow-y-auto border border-border bg-surface rounded-lg p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {item.availableBarcodes.map((bc) => {
                                    const isSel = item.selectedBarcodes.includes(bc.barcode);
                                    return (
                                      <button
                                        key={bc.id}
                                        type="button"
                                        onClick={() => {
                                          const nextSel = isSel 
                                            ? item.selectedBarcodes.filter(b => b !== bc.barcode) 
                                            : [...item.selectedBarcodes, bc.barcode];
                                          updateItemField(idx, 'selectedBarcodes', nextSel);
                                          updateItemField(idx, 'quantity', nextSel.length);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-left transition-all border cursor-pointer
                                          ${isSel 
                                            ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                                            : 'bg-surface border-border text-text-secondary hover:bg-surface-elevated/40'}
                                        `}
                                      >
                                        {bc.barcode}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <button
                        type="button"
                        onClick={() => handleFinishItem(idx)}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow transition-all cursor-pointer"
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

        {/* Dynamic Add / Action Panel */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAddNewItem}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
          >
            <Plus size={14} className="text-primary" />
            <span>Add Another Item to Dispatch</span>
          </button>
        </div>

        {/* Bottom Save Bar */}
        <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-border">
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
            disabled={loading}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Confirm Outbound Batch ({items.length})</span>
          </button>
        </div>
      </form>

      {/* Webcam Scanning Modal Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] sm:max-w-[850px] max-h-[90vh] shadow-lg flex flex-col gap-4 animate-slide-down overflow-hidden">
            <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
              <h3 className="font-display font-bold text-sm text-text-primary">Scan Outbound Barcode</h3>
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

      {/* Wireless companion pairing modal */}
      {isMobileModalOpen && mobileSession && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] shadow-lg flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-extrabold text-sm text-text-primary flex items-center gap-1.5">
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
                <span className="text-xs font-extrabold text-text-primary font-mono font-semibold">Pair code: {mobileSession.sessionId}</span>
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

export default function OutboundClient({ products, stores, supervisors, staff }) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    }>
      <OutboundFormContent 
        products={products} 
        stores={stores}
        supervisors={supervisors}
        staff={staff}
      />
    </Suspense>
  );
}
