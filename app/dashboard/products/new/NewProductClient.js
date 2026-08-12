'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Camera, QrCode, X, ArrowDownLeft, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { createProduct, updateProduct } from '@/app/actions/products';
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

export default function NewProductClient({ brands, recentReceivers = [], recentSuppliers = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (editId) {
      const loadProduct = async () => {
        setLoading(true);
        try {
          const { getProductById } = await import('@/app/actions/products');
          const product = await getProductById(editId);
          if (product) {
            setName(product.name);
            setBrandId(product.brandId);
            setItemCode(product.itemCode || '');
            setCategory(product.category || 'Stands');
            setStockCap(product.stockCap ? product.stockCap.toString() : '');
            setIsReturnable(product.isReturnable);
            setIsPublic(product.isPublic);
            if (!product.isSerialized) {
              setProductType('NORMAL');
            } else if (product.category?.toUpperCase().includes('ROUTER')) {
              setProductType('ROUTER');
            } else {
              setProductType('SIM');
            }
          } else {
            setError('Product not found.');
          }
        } catch (err) {
          setError('Failed to load product details: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      loadProduct();
    }
  }, [editId]);

  // Form states
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(searchParams.get('brandId') || brands[0]?.id || '');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState('Stands');
  const [productType, setProductType] = useState('NORMAL'); // 'NORMAL', 'SIM', 'ROUTER'
  const [stockCap, setStockCap] = useState('');
  const [isReturnable, setIsReturnable] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  // Initial stock states
  const [initialQty, setInitialQty] = useState('');
  const [initialBarcodes, setInitialBarcodes] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [notes, setNotes] = useState('');

  // Received By details - Receiver is locked to WAREHOUSE
  const [receivedBy, setReceivedBy] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Source (From) states for initial inbound - Locked to SUPPLIER
  const [fromId, setFromId] = useState('Initial Import');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  // Scanning input state
  const [scanInput, setScanInput] = useState('');

  // Webcam camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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

  // Handle automatic changes when productType is adjusted
  useEffect(() => {
    if (productType === 'SIM') {
      setCategory('SIM');
    } else if (productType === 'ROUTER') {
      setCategory('Router');
    } else {
      setCategory('Stands');
    }
  }, [productType]);

  const addBarcode = (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;
    
    let added = false;
    const currentList = initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
    if (!currentList.includes(cleanCode)) {
      const newList = [...currentList, cleanCode];
      setInitialBarcodes(newList.join('\n'));
      added = true;
    }
    return added;
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const added = addBarcode(scanInput);
      if (added) playBeep();
      setScanInput('');
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

  // Webcam scanning hook
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
              
              // Cooldown checks
              if (code.toLowerCase() === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = code.toLowerCase();
              lastScannedTimeRef.current = now;

              const added = addBarcode(code);
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
        html5QrcodeScanner.clear().catch(e => console.error(e));
      }
    };
  }, [isCameraOpen, cameraPermissionStatus]);

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
  const handleOpenMobileScanner = async () => {
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
    if (isMobileModalOpen && mobileSession?.sessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              data.barcodes.forEach(code => {
                const added = addBarcode(code);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Product name is required');
      setLoading(false);
      return;
    }

    if (!brandId) {
      setError('Please select an associated brand');
      setLoading(false);
      return;
    }

    const hasInboundStock = productType === 'NORMAL' 
      ? (parseInt(initialQty, 10) > 0)
      : (initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length > 0);

    if (!editId && hasInboundStock) {
      if (!fromId.trim()) {
        setError('Please enter a valid source supplier name for initial stock');
        setLoading(false);
        return;
      }
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('brandId', brandId);
    formData.append('itemCode', itemCode);
    formData.append('category', category);
    formData.append('isSerialized', productType !== 'NORMAL' ? 'true' : 'false');
    formData.append('stockCap', stockCap);
    formData.append('isReturnable', isReturnable ? 'true' : 'false');
    formData.append('isPublic', isPublic ? 'true' : 'false');

    // Initial stock parameters
    if (productType === 'NORMAL') {
      formData.append('initialQty', initialQty || '0');
    } else {
      formData.append('initialBarcodes', initialBarcodes);
    }
    formData.append('deliveryNote', deliveryNote || 'INITIAL_STOCK');
    formData.append('notes', notes || 'Auto-received initial stock on product registration');
    formData.append('receivedBy', receivedBy || '');

    // Supplier / Receiver parameters - Locked to SUPPLIER / WAREHOUSE (only for new products)
    if (!editId) {
      formData.append('fromEntityType', 'SUPPLIER');
      formData.append('fromEntityId', fromId.trim());
      formData.append('toEntityType', 'WAREHOUSE');
      formData.append('toEntityId', '');
    }

    try {
      if (editId) {
        await updateProduct(editId, formData);
        setSuccess(`Product "${name}" updated successfully!`);
      } else {
        await createProduct(formData);
        setSuccess(`Product "${name}" registered successfully with initial stock!`);
      }
      setTimeout(() => {
        const redirectBrandId = searchParams.get('brandId');
        if (redirectBrandId) {
          router.push(`/dashboard/brands/${redirectBrandId}`);
        } else {
          router.push('/dashboard/products');
        }
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit product.');
      setLoading(false);
    }
  };

  // Autocomplete suggestions for Receiver
  const filteredSuggestions = recentReceivers.filter(r => 
    r.toLowerCase().includes(receivedBy.toLowerCase()) && 
    r.toLowerCase() !== receivedBy.toLowerCase()
  );

  // Autocomplete suggestions for Supplier
  const filteredSupplierSuggestions = recentSuppliers.filter(s => 
    s.toLowerCase().includes(fromId.toLowerCase()) && 
    s.toLowerCase() !== fromId.toLowerCase()
  );

  // Get current session barcodes for bulk list view
  const scannedBarcodesList = initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
  const currentScannedCount = scannedBarcodesList.length;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 font-sans">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <button 
          onClick={() => router.back()} 
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            {editId ? 'Edit Product' : 'Register New Product'}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {editId ? 'Modify product catalog details.' : 'Add a new item to the catalogue and optionally receive initial stock.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-4 text-sm font-semibold flex items-center gap-2.5 animate-slide-down">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-sm font-semibold animate-slide-down">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
        {/* Section 1: Classification */}
        <div>
          <h3 className="font-display font-bold text-base text-text-primary pb-2 border-b border-border">
            1. Classification &amp; Brand
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Product Tracking Type</label>
              <CustomSelect
                options={[
                  { value: 'NORMAL', label: 'Bulk Product (Stands, T-Shirts, etc.)' },
                  { value: 'SIM', label: 'SIM Card (Serialized Barcode)' },
                  { value: 'ROUTER', label: 'Router Device (Serialized Barcode)' },
                ]}
                value={productType}
                onChange={(val) => setProductType(val)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Associated Brand Owner</label>
              <CustomSelect
                options={brands.map(b => ({ value: b.id, label: b.name }))}
                value={brandId}
                onChange={(val) => setBrandId(val)}
                placeholder="-- Select Brand --"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Metadata */}
        <div>
          <h3 className="font-display font-bold text-base text-text-primary pb-2 border-b border-border">
            2. Product Metadata
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-text-secondary">Product Display Name</label>
              <input
                type="text"
                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sadia Promo Counter"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">SKU / Item Code</label>
              <input
                type="text"
                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="e.g. SKU-12345 (Optional)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Category Group</label>
              <input
                type="text"
                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Stands"
                disabled={productType !== 'NORMAL'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Warehouse Stock Cap (Threshold)</label>
              <input
                type="number"
                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={stockCap}
                onChange={(e) => setStockCap(e.target.value)}
                placeholder="e.g. 50 (Optional)"
              />
            </div>
            
            <div className="flex items-center gap-6 mt-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-border text-primary focus:ring-primary/20"
                  checked={isReturnable}
                  onChange={(e) => setIsReturnable(e.target.checked)}
                />
                <span>Returnable Item</span>
              </label>
              
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-border text-primary focus:ring-primary/20"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>Show in Public Catalogs</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Initial Inbound Stock */}
        {!editId && (
          <div>
            <h3 className="font-display font-bold text-base text-text-primary pb-2 border-b border-border">
              3. Initial Inbound Warehouse Stock (Optional)
            </h3>
            
            <div className="flex flex-col gap-6 mt-4 bg-surface-elevated/40 border border-black/5 p-5 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-text-secondary">Inbound Supplier / Source</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                      value={fromId}
                      onChange={(e) => {
                        setFromId(e.target.value);
                        setShowSupplierSuggestions(true);
                      }}
                      onFocus={() => setShowSupplierSuggestions(true)}
                      placeholder="e.g. Supplier Name"
                    />
                    {showSupplierSuggestions && filteredSupplierSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded mt-1 shadow-lg max-h-32 overflow-y-auto z-[100] animate-fade-in">
                        {filteredSupplierSuggestions.map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium"
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

                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-text-secondary">Received By (Staff)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                      value={receivedBy}
                      onChange={(e) => {
                        setReceivedBy(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="e.g. John Doe"
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded mt-1 shadow-lg max-h-32 overflow-y-auto z-[100] animate-fade-in">
                        {filteredSuggestions.map((name, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {productType === 'NORMAL' ? (
                  <div className="flex flex-col gap-1.5 sm:col-span-1">
                    <label className="text-xs font-bold text-text-secondary">Quantity to Receive</label>
                    <input
                      type="number"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={initialQty}
                      onChange={(e) => setInitialQty(e.target.value)}
                      placeholder="e.g. 100"
                      min={1}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:col-span-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                        <QrCode size={15} className="text-primary" />
                        <span>Scan / Enter Barcode to Add</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={handleScanInputKeyDown}
                          placeholder="Type barcode or scan, then press Enter..."
                        />
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            className="px-3 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                            onClick={() => setIsCameraOpen(true)}
                            title="Scan via PC Webcam"
                          >
                            <Camera size={16} />
                            <span className="text-[10px] font-bold uppercase hidden sm:inline">Camera</span>
                          </button>
                          <button
                            type="button"
                            className="px-3 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
                            onClick={handleOpenMobileScanner}
                            title="Pair Wireless Mobile phone camera"
                          >
                            <Smartphone size={16} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase hidden sm:inline">Mobile</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary">
                        Initial Serial Barcodes List (one per line)
                      </label>
                      <textarea
                        className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        rows={4}
                        value={initialBarcodes}
                        onChange={(e) => setInitialBarcodes(e.target.value)}
                        placeholder="e.g. SN-98127391&#10;SN-98127392"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-text-secondary">Inbound Delivery Note #</label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="e.g. DN-90172"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-text-secondary">Remarks / Transaction Notes</label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Initial import of SIM lot from supplier"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
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
            <span>{editId ? 'Save Product Details' : 'Create & Receive Product'}</span>
          </button>
        </div>
      </form>

      {/* Webcam Scanning Modal Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] sm:max-w-[850px] max-h-[90vh] shadow-lg flex flex-col gap-4 animate-slide-down overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
              <h3 className="font-display font-bold text-sm text-text-primary">Scan Initial Stock Barcode</h3>
              
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
                  onClick={() => setIsCameraOpen(false)}
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
                      <p className="text-xs text-text-secondary text-sm leading-relaxed">
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
                            onClick={() => setInitialBarcodes('')}
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
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono px-2 py-0.5 rounded font-semibold animate-pulse-once"
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
                onClick={() => setIsMobileModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              {/* QR Code Container */}
              <div className="p-3 bg-white border border-border rounded-lg shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`http://${mobileSession.localIp}:${mobileSession.port}/scan-companion?session=${mobileSession.sessionId}`)}`}
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
