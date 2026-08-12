'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, ArrowDownLeft, AlertCircle, Camera, QrCode, X, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { createBulkReceiveTransactions } from '@/app/actions/transactions';

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

function InboundFormContent({ products, recentReceivers = [], recentSuppliers = [] }) {
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
  
  // State for bulk receive items
  const [items, setItems] = useState([]);

  // Scanning inputs states (one per row index)
  const [scanInputs, setScanInputs] = useState({});

  // Barcode Range Select States
  const [rangeStart, setRangeStart] = useState({});
  const [rangeEnd, setRangeEnd] = useState({});
  const [rangeMode, setRangeMode] = useState({}); // key: rowIndex, value: boolean (true = range, false = scan)

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeCameraRow, setActiveCameraRow] = useState(null);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }

  // Sync isBulkScan to Ref to prevent stale closures without re-triggering camera instantiations
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Initialize selected products from URL search parameter "productIds"
  useEffect(() => {
    const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
    if (urlIds.length > 0) {
      const initialItems = urlIds.map(id => {
        const prod = products.find(p => p.id === id);
        return {
          productId: id,
          quantity: prod?.isSerialized ? 0 : 1,
          barcodesInput: '',
          notes: ''
        };
      });
      setItems(initialItems);
    } else {
      // Add one empty product row by default
      setItems([{ productId: products[0]?.id || '', quantity: 1, barcodesInput: '', notes: '' }]);
    }
  }, [searchParams, products]);

  const handleAddRow = () => {
    setItems(prev => [...prev, { productId: products[0]?.id || '', quantity: 1, barcodesInput: '', notes: '' }]);
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
        if (field === 'barcodesInput') {
          const prod = products.find(p => p.id === item.productId);
          if (prod?.isSerialized) {
            const barcodes = value.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
            updated.quantity = barcodes.length;
          }
        }
        return updated;
      }
      return item;
    }));
  };

  // Scopes barcode addition (avoids duplicate adds)
  const addBarcodeToRow = (index, code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    let added = false;
    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const currentList = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          added = true;
          return {
            ...item,
            barcodesInput: newList.join('\n'),
            quantity: newList.length
          };
        }
      }
      return item;
    }));
    return added;
  };

  const handleScannedBarcode = (index, code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    if (rangeMode[index]) {
      // Smart range input population
      const focusedId = document.activeElement?.id;
      if (focusedId === `range-start-${index}`) {
        setRangeStart(prev => ({ ...prev, [index]: cleanCode }));
        return true;
      } else if (focusedId === `range-end-${index}`) {
        setRangeEnd(prev => ({ ...prev, [index]: cleanCode }));
        return true;
      } else {
        // Autofill empty starting then ending sequentially
        let updated = false;
        setRangeStart(prevStart => {
          const currentStart = prevStart[index] || '';
          if (!currentStart) {
            updated = true;
            return { ...prevStart, [index]: cleanCode };
          } else {
            setRangeEnd(prevEnd => {
              const currentEnd = prevEnd[index] || '';
              if (!currentEnd) {
                updated = true;
                return { ...prevEnd, [index]: cleanCode };
              }
              return prevEnd;
            });
            return prevStart;
          }
        });
        return updated;
      }
    } else {
      // Standard single scan mode
      return addBarcodeToRow(index, cleanCode);
    }
  };

  const handleScanInputKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInputs[index] || '';
      const added = addBarcodeToRow(index, code);
      if (added) playBeep();
      setScanInputs(prev => ({ ...prev, [index]: '' }));
    }
  };

  const generateSeries = (start, end) => {
    const matchStart = start.match(/^(.*?)(\d+)$/);
    const matchEnd = end.match(/^(.*?)(\d+)$/);
    if (!matchStart || !matchEnd || matchStart[1] !== matchEnd[1]) {
      throw new Error("Start and End barcodes must have the same alphanumeric prefix and end with a number.");
    }
    
    const prefix = matchStart[1];
    const startNumStr = matchStart[2];
    const endNumStr = matchEnd[2];
    const paddingLength = startNumStr.length;

    const startVal = BigInt(startNumStr);
    const endVal = BigInt(endNumStr);
    
    if (startVal > endVal) {
      throw new Error("Starting barcode number must be less than or equal to the ending barcode number.");
    }
    
    if (endVal - startVal > 10000n) {
      throw new Error("Range is too large. Maximum 10,000 serials per batch entry.");
    }

    const generated = [];
    for (let val = startVal; val <= endVal; val++) {
      const valStr = val.toString().padStart(paddingLength, '0');
      generated.push(`${prefix}${valStr}`);
    }
    return generated;
  };

  const handleApplyRange = (index) => {
    const start = (rangeStart[index] || '').trim();
    const end = (rangeEnd[index] || '').trim();
    if (!start || !end) {
      alert("Please enter both starting and ending barcodes.");
      return;
    }

    try {
      const generated = generateSeries(start, end);
      
      setItems(prev => prev.map((item, idx) => {
        if (idx === index) {
          const currentList = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
          const mergedList = Array.from(new Set([...currentList, ...generated]));
          return {
            ...item,
            barcodesInput: mergedList.join('\n'),
            quantity: mergedList.length
          };
        }
        return item;
      }));
      playBeep();
      
      // Clear inputs
      setRangeStart(prev => ({ ...prev, [index]: '' }));
      setRangeEnd(prev => ({ ...prev, [index]: '' }));
    } catch (e) {
      alert(e.message || "Failed to generate barcode series.");
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
              const now = Date.now();
              
              // Cooldown checks
              if (code.toLowerCase() === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = code.toLowerCase();
              lastScannedTimeRef.current = now;

              const added = handleScannedBarcode(activeCameraRow, code);
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
        html5QrcodeScanner.clear().catch(e => console.error("Failed to clear scanner:", e));
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
    try {
      setActiveCameraRow(rowIndex);
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
    if (isMobileModalOpen && mobileSession?.sessionId && activeCameraRow !== null) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              data.barcodes.forEach(code => {
                const added = handleScannedBarcode(activeCameraRow, code);
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
  }, [isMobileModalOpen, mobileSession, activeCameraRow, rangeMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Verify entity fields
    if (!fromId.trim()) {
      setError('Please enter a valid source supplier name');
      setLoading(false);
      return;
    }

    // Construct backend payload
    const itemsPayload = items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      let barcodes = [];
      if (prod?.isSerialized) {
        barcodes = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        barcodes,
        notes: item.notes
      };
    });

    try {
      await createBulkReceiveTransactions({
        fromEntityType: 'SUPPLIER',
        fromEntityId: fromId.trim(),
        toEntityType: 'WAREHOUSE',
        toEntityId: null,
        receivedBy: receivedBy || null,
        items: itemsPayload
      });
      setSuccessMsg(`Logged inbound receive of ${items.length} products successfully!`);
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

  // Get current session barcodes for bulk list view
  const currentItem = items[activeCameraRow];
  const scannedBarcodesList = currentItem?.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean) || [];
  const currentScannedCount = scannedBarcodesList.length;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link href="/dashboard/inbound" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Inbound Stock Receive
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Log supplier shipments into the warehouse
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
        {/* Source & Destination Header */}
        <h3 className="font-display font-bold text-lg text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ArrowDownLeft size={20} className="text-success" />
          <span>Source &amp; Receiver Configuration</span>
        </h3>

        {/* Source and Target Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FROM SECTION (Supplier) */}
          <div className="p-4 bg-surface-elevated/40 border border-border rounded-xl flex flex-col gap-4">
            <h4 className="font-bold text-sm text-text-primary">Source Supplier (From)</h4>
            
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-text-secondary">Supplier Name</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={fromId}
                  onChange={(e) => { setFromId(e.target.value); setShowSupplierSuggestions(true); }}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                  placeholder="e.g. Sadia Factory"
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
          </div>

          {/* TO SECTION (Warehouse Receiver) */}
          <div className="p-4 bg-surface-elevated/40 border border-border rounded-xl flex flex-col gap-4">
            <h4 className="font-bold text-sm text-text-primary">Receiver (To Warehouse)</h4>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Receiver Location</label>
              <input
                type="text"
                className="w-full bg-surface-elevated text-text-secondary border border-border rounded-lg px-3 py-2 text-sm font-semibold"
                value="Main Warehouse"
                disabled
              />
            </div>

            {/* Received By Field (Smart Assist) */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-semibold text-text-secondary">Received By (Person Name)</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  value={receivedBy}
                  onChange={(e) => { setReceivedBy(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                  placeholder="e.g. John Doe"
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

        {/* Ledger Header */}
        <h3 className="font-display font-bold text-lg text-text-primary pb-3 border-b border-border mt-2">
          Products Receipt Ledger
        </h3>

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
                    <select 
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                      value={item.productId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const prod = products.find(p => p.id === id);
                        setItems(prev => prev.map((x, idx) => idx === index ? { ...x, productId: id, quantity: prod?.isSerialized ? 0 : 1, barcodesInput: '', notes: '' } : x));
                      }}
                      required
                    >
                      <option value="" disabled>Choose product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.brand?.name || 'No Brand'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-1">
                    <label className="text-xs font-semibold text-text-secondary">
                      {!selectedProd?.isSerialized ? 'Quantity to Receive' : 'Quantity (Serial Count)'}
                    </label>
                    {!selectedProd?.isSerialized ? (
                      <input 
                        type="number" 
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                        min={1} 
                        value={item.quantity}
                        onChange={(e) => handleFieldChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                        required 
                      />
                    ) : (
                      <input 
                        type="number" 
                        className="w-full bg-surface-elevated text-success border border-border rounded-lg px-3 py-2.5 text-sm font-bold font-mono"
                        value={item.quantity}
                        disabled
                      />
                    )}
                  </div>
                </div>

                {selectedProd?.isSerialized && (() => {
                  const isSim = selectedProd?.category?.toUpperCase().includes('SIM');
                  const showRange = isSim && rangeMode[index];
                  return (
                    <div className="flex flex-col gap-3 mt-2 bg-surface p-4 border border-border rounded-lg">
                      {isSim && (
                        /* Selection Method Tabs & Global Scanner Action Controls */
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border mb-3 pb-1.5 gap-2">
                          <div className="flex">
                            <button
                              type="button"
                              className={`pb-1.5 text-xs font-bold mr-4 transition-all ${!rangeMode[index] ? 'border-b-2 border-primary text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                              onClick={() => setRangeMode(prev => ({ ...prev, [index]: false }))}
                            >
                              Single Scan / Type
                            </button>
                            <button
                              type="button"
                              className={`pb-1.5 text-xs font-bold transition-all ${rangeMode[index] ? 'border-b-2 border-primary text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                              onClick={() => setRangeMode(prev => ({ ...prev, [index]: true }))}
                            >
                              Generate Series Range (Start-to-Stop)
                            </button>
                          </div>
                          
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-1"
                              onClick={() => { setActiveCameraRow(index); setIsCameraOpen(true); }}
                              title="Scan via PC Webcam"
                            >
                              <Camera size={13} className="text-primary" />
                              <span className="text-[10px] font-bold uppercase">Webcam</span>
                            </button>
                            
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-1"
                              onClick={() => handleOpenMobileScanner(index)}
                              title="Pair Wireless Mobile phone camera"
                            >
                              <Smartphone size={13} className="text-primary animate-pulse" />
                              <span className="text-[10px] font-bold uppercase">Mobile</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {!showRange ? (
                        <div className="flex flex-col gap-1.5 mb-2">
                          <label className="text-[10px] font-bold text-text-primary flex items-center gap-1">
                            <QrCode size={12} className="text-primary" />
                            <span>Scan / Enter Barcode to Add</span>
                          </label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            value={scanInputs[index] || ''}
                            onChange={(e) => setScanInputs(prev => ({ ...prev, [index]: e.target.value }))}
                            onKeyDown={(e) => handleScanInputKeyDown(e, index)}
                            placeholder="Type barcode or scan, then press Enter..."
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 mb-2 bg-surface-elevated/45 p-3 rounded-lg border border-border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">1st Barcode (Start)</label>
                              <input
                                id={`range-start-${index}`}
                                type="text"
                                className="bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
                                value={rangeStart[index] || ''}
                                onChange={(e) => setRangeStart(prev => ({ ...prev, [index]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const endInput = document.getElementById(`range-end-${index}`);
                                    if (endInput) endInput.focus();
                                  }
                                }}
                                placeholder="Scan or type 1st barcode..."
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase">Last Barcode (End)</label>
                              <input
                                id={`range-end-${index}`}
                                type="text"
                                className="bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
                                value={rangeEnd[index] || ''}
                                onChange={(e) => setRangeEnd(prev => ({ ...prev, [index]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleApplyRange(index);
                                  }
                                }}
                                placeholder="Scan or type last barcode..."
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyRange(index)}
                            className="self-start px-3 py-1.5 bg-success hover:bg-success-hover text-white text-xs font-semibold rounded-lg shadow-sm transition-colors duration-150"
                          >
                            Generate &amp; Append Barcodes
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">
                          Inbound Serial Barcodes List (one per line)
                        </label>
                        <textarea 
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                          rows={4} 
                          value={item.barcodesInput}
                          onChange={(e) => handleFieldChange(index, 'barcodesInput', e.target.value)}
                          placeholder="e.g. SN-892742918&#10;SN-892742919"
                          required
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Item Specific Remarks / Notes</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                    value={item.notes}
                    onChange={(e) => handleFieldChange(index, 'notes', e.target.value)}
                    placeholder="e.g. Supplier Lot B-2, Checked expiry..."
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-5 border-t border-border">
          <button 
            type="button" 
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" 
            onClick={handleAddRow}
          >
            <Plus size={15} /> 
            <span>Add Product Row</span>
          </button>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/inbound" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
              Cancel
            </Link>
            <button 
              type="submit" 
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-success hover:bg-success-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
              disabled={loading || items.length === 0}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>Submit Inbound Receipt</span>
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
              <h3 className="font-display font-bold text-sm text-text-primary">Scan Inbound Barcode</h3>
              
              <div className="flex items-center gap-3">
                {/* Bulk Scan Toggle */}
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="rounded border-border text-primary focus:ring-primary/20"
                    checked={isBulkScan}
                    onChange={(e) => setIsBulkScan(e.target.checked)}
                  />
                  <span className="text-[10px] font-bold text-text-secondary uppercase">Bulk Scan</span>
                </label>

                <button 
                  type="button" 
                  className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" 
                  onClick={() => { setIsCameraOpen(false); setActiveCameraRow(null); }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {cameraPermissionStatus !== 'granted' ? (
              // Full-screen modal content for prompt/denied states
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch overflow-y-auto sm:overflow-hidden flex-1 min-h-0">
                
                {/* Left Column: Camera Viewport */}
                <div className="flex flex-col gap-2 min-h-[260px] sm:min-h-0 justify-center">
                  <div className="relative w-full rounded-lg overflow-hidden border border-border bg-surface flex items-center justify-center">
                    {/* The html5-qrcode element */}
                    <div id="camera-reader-element" className="w-full"></div>
                  </div>
                </div>

                {/* Right Column: Scanned list status logs */}
                <div className="flex flex-col gap-3 min-h-[160px] sm:min-h-0 sm:overflow-hidden flex-1">
                  {isBulkScan ? (
                    <div className="flex-1 flex flex-col gap-2 p-3 bg-surface-elevated border border-border/65 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-text-secondary uppercase">
                          Scanned Barcodes ({currentScannedCount})
                        </span>
                        {currentScannedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange(activeCameraRow, 'barcodesInput', '')}
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
                                className="inline-flex items-center gap-1 bg-success/10 text-success border border-success/20 text-[10px] font-mono px-2 py-0.5 rounded font-semibold animate-pulse-once"
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
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" 
                onClick={() => { setIsMobileModalOpen(false); setActiveCameraRow(null); }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              {/* QR Code Container */}
              <div className="p-3 bg-white border border-border rounded-lg shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(
                    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                      ? `http://${mobileSession.localIp}:${mobileSession.port}/scan-companion?session=${mobileSession.sessionId}`
                      : `${typeof window !== 'undefined' ? window.location.origin : ''}/scan-companion?session=${mobileSession.sessionId}`
                  )}`}
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

export default function InboundClient({ products, recentReceivers, recentSuppliers }) {
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
      />
    </Suspense>
  );
}
