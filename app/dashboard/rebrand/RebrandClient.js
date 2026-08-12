'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, RefreshCw, AlertCircle, Camera, QrCode, X, Smartphone, CheckCircle, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { createBulkRebrandTransactions } from '@/app/actions/transactions';
import { getAvailableBarcodes } from '@/app/actions/products';
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

export default function RebrandClient({ products }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Source product selection (only show serialized SIM / ROUTER)
  const sourceProducts = products.filter(p => p.isSerialized);

  const [sourceProductId, setSourceProductId] = useState(sourceProducts[0]?.id || '');
  const [targetProductId, setTargetProductId] = useState(products[0]?.id || '');
  const [remarks, setRemarks] = useState('');

  // Target product replacement image state
  const [targetProductImage, setTargetProductImage] = useState(null);
  const [targetProductImagePreview, setTargetProductImagePreview] = useState('');

  // Available barcodes in warehouse for selected source product
  const [availableBarcodes, setAvailableBarcodes] = useState([]);
  
  // Mappings of selected source barcodes to new target barcodes
  const [mappings, setMappings] = useState([]);

  // Scanning barcode input
  const [scanInput, setScanInput] = useState('');

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }

  // Sync isBulkScan to Ref
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

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

  // Fetch available warehouse barcodes for the selected source product
  useEffect(() => {
    if (sourceProductId) {
      setAvailableBarcodes([]);
      setMappings([]);
      getAvailableBarcodes(sourceProductId, 'WAREHOUSE', null)
        .then(res => {
          setAvailableBarcodes(res || []);
        })
        .catch(err => console.error(err));
    }
  }, [sourceProductId]);

  // Reset target product image on product change
  useEffect(() => {
    setTargetProductImage(null);
    setTargetProductImagePreview('');
  }, [targetProductId]);

  const sourceSelectedProduct = products.find(p => p.id === sourceProductId);
  const targetSelectedProduct = products.find(p => p.id === targetProductId);

  const handleAddMapping = (sourceBarcode = '', targetBarcode = '') => {
    let added = false;
    setMappings(prev => {
      const alreadyMapped = prev.some(m => m.sourceBarcode.toLowerCase() === sourceBarcode.toLowerCase());
      if (!alreadyMapped) {
        added = true;
        // Expand the newly added row and collapse the rest
        return prev.map(m => ({ ...m, isExpanded: false })).concat({ 
          sourceBarcode, 
          targetBarcode, 
          isExpanded: true,
          error: ''
        });
      }
      return prev;
    });
    return added;
  };

  const handleRemoveMapping = (index) => {
    setMappings(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length > 0 && !updated.some(m => m.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  const handleMappingFieldChange = (index, field, value) => {
    setMappings(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
  };

  const handleExpandMapping = (index) => {
    setMappings(prev => prev.map((item, idx) => ({ ...item, isExpanded: idx === index })));
  };

  const handleFinishMapping = (index) => {
    const item = mappings[index];
    if (!item.targetBarcode.trim()) {
      handleMappingFieldChange(index, 'error', 'Target barcode is required');
      return;
    }
    setMappings(prev => prev.map((it, i) => i === index ? { ...it, isExpanded: false, error: '' } : it));
  };

  // Keyboard barcode scan handler
  const handleScanInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInput.trim().toLowerCase();
      if (!code) return;

      const matched = availableBarcodes.find(b => b.barcode.toLowerCase() === code);
      if (matched) {
        const added = handleAddMapping(matched.barcode, '');
        if (added) playBeep();
      } else {
        alert(`Barcode "${scanInput}" is not available in the Warehouse for this source product.`);
      }
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

  // Camera scanned barcode
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
              const lowercaseCode = code.toLowerCase();
              const now = Date.now();
              
              // Cooldown checks
              if (lowercaseCode === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
                return;
              }
              lastScannedBarcodeRef.current = lowercaseCode;
              lastScannedTimeRef.current = now;

              const matched = availableBarcodes.find(b => b.barcode.toLowerCase() === lowercaseCode);
              if (matched) {
                const added = handleAddMapping(matched.barcode, '');
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
              } else {
                alert(`Barcode "${decodedText}" is not available in the Warehouse.`);
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
  }, [isCameraOpen, cameraPermissionStatus, availableBarcodes]);

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
                const cleanCode = code.trim();
                const lowercaseCode = cleanCode.toLowerCase();
                
                const matched = availableBarcodes.find(b => b.barcode.toLowerCase() === lowercaseCode);
                if (matched) {
                  const added = handleAddMapping(matched.barcode, '');
                  if (added) playBeep();
                } else {
                  alert(`Mobile Scanned Barcode "${cleanCode}" is not available in the Warehouse.`);
                }
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
  }, [isMobileModalOpen, mobileSession, availableBarcodes]);

  // Get current session barcodes for bulk list view
  const scannedBarcodesList = mappings.map(m => m.sourceBarcode).filter(Boolean);
  const currentScannedCount = scannedBarcodesList.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Validation Loop
    for (let i = 0; i < mappings.length; i++) {
      if (!mappings[i].targetBarcode.trim()) {
        handleMappingFieldChange(i, 'error', 'Target barcode is required');
        handleExpandMapping(i);
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('sourceProductId', sourceProductId);
      formData.append('targetProductId', targetProductId);
      formData.append('remarks', remarks);
      formData.append('mappings', JSON.stringify(mappings.map(m => ({ sourceBarcode: m.sourceBarcode, targetBarcode: m.targetBarcode }))));
      if (targetProductImage) {
        formData.append('targetProductImage', targetProductImage);
      }

      await createBulkRebrandTransactions(formData);
      setSuccessMsg('Logged rebranding mapping successfully!');
      setTimeout(() => {
        router.push('/dashboard/rebrand');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to complete rebranding transaction.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link href="/dashboard/rebrand" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Rebrand Stock Items
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Convert existing central warehouse serial numbers from one catalog item to another
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

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-6 shadow-sm">
        {/* Destination Header */}
        <h3 className="font-display font-bold text-lg text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <RefreshCw size={20} className="text-warning animate-spin-slow" />
          <span>Rebrand Direction</span>
        </h3>

        {/* Direction Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Source Product (Convert From)</label>
            <CustomSelect
              options={sourceProducts.map(p => ({ value: p.id, label: `${p.name} (${p.brand?.name || 'No Brand'})`, imageUrl: p.imageUrl }))}
              value={sourceProductId}
              onChange={(val) => setSourceProductId(val)}
              placeholder="Select Source Product..."
              required
            />
            {sourceSelectedProduct?.imageUrl && (
              <div className="mt-2 flex items-center gap-2 bg-surface-elevated/40 p-2 border border-border rounded-lg max-w-fit">
                <img src={sourceSelectedProduct.imageUrl} alt="Source Preview" className="w-10 h-10 rounded border border-border bg-white object-contain flex-shrink-0" />
                <span className="text-[10px] text-text-secondary font-medium">Source Product Picture</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Target Product (Convert To)</label>
            <CustomSelect
              options={products.map(p => ({ value: p.id, label: `${p.name} (${p.brand?.name || 'No Brand'})`, imageUrl: p.imageUrl }))}
              value={targetProductId}
              onChange={(val) => setTargetProductId(val)}
              placeholder="Select Target Product..."
              required
            />
            {targetSelectedProduct?.imageUrl && (
              <div className="mt-2 flex items-center gap-2 bg-surface-elevated/40 p-2 border border-border rounded-lg max-w-fit">
                <img src={targetSelectedProduct.imageUrl} alt="Target Preview" className="w-10 h-10 rounded border border-border bg-white object-contain flex-shrink-0" />
                <span className="text-[10px] text-text-secondary font-medium">Target Product Picture</span>
              </div>
            )}
          </div>

          {/* Replacement image configuration for target product */}
          <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2 bg-surface-elevated/10 p-4 border border-border border-dashed rounded-xl">
            <label className="text-xs font-bold text-text-primary">Target Product Image Replacement (Optional)</label>
            <div className="flex items-center gap-4">
              {targetProductImagePreview || targetSelectedProduct?.imageUrl ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <img src={targetProductImagePreview || targetSelectedProduct?.imageUrl} alt="Target Product Preview" className="w-full h-full object-contain" />
                  {targetProductImagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetProductImage(null);
                        setTargetProductImagePreview('');
                      }}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-1 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                  <Camera size={24} />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs text-text-secondary">Upload a new picture to replace target product's current catalog image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setTargetProductImage(file);
                      setTargetProductImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className="hidden"
                  id="target-product-image"
                />
                <label
                  htmlFor="target-product-image"
                  className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-1.5 w-fit border-dashed"
                >
                  <span>Replace Catalog Picture</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Scanner Barcode Section */}
        <div className="flex flex-col gap-2 p-4 bg-surface-elevated/40 border border-border rounded-xl">
          <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <QrCode size={15} className="text-primary" />
            <span>Scan / Search Source Barcode</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScanInputKeyDown}
              placeholder="Scan source barcode, then press Enter..."
            />
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                className="px-3 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={() => setIsCameraOpen(true)}
                title="Scan via PC Webcam"
              >
                <Camera size={16} />
                <span className="text-[10px] font-bold uppercase hidden sm:inline">Camera</span>
              </button>
              <button
                type="button"
                className="px-3 bg-surface border border-border hover:bg-surface-elevated rounded-lg text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={handleOpenMobileScanner}
                title="Pair Wireless Mobile phone camera"
              >
                <Smartphone size={16} className="text-primary" />
                <span className="text-[10px] font-bold uppercase hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>
          <span className="text-[10px] text-text-secondary">Available barcodes inside warehouse: {availableBarcodes.length}</span>
        </div>

        {/* Ledger Header */}
        <h3 className="font-display font-bold text-lg text-text-primary pb-3 border-b border-border mt-2">
          Barcodes Conversion Mapping Queue
        </h3>

        {/* Mappings Accordion List */}
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-xs border border-dashed border-border rounded-xl">
            No barcodes selected. Scan source barcodes above to populate the mapping queue.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {mappings.map((m, index) => (
              <div 
                key={index} 
                className={`bg-surface border rounded-xl shadow-sm transition-all duration-200 overflow-hidden
                  ${m.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
                `}
              >
                {/* 1. COLLAPSED VIEW CARD */}
                {!m.isExpanded && (
                  <div 
                    onClick={() => handleExpandMapping(index)}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-mono font-bold text-text-primary">
                          Source: {m.sourceBarcode}
                        </span>
                        <span className="text-[10px] text-text-secondary block mt-0.5">
                          Target: {m.targetBarcode ? <strong className="text-primary font-mono">{m.targetBarcode}</strong> : <span className="text-text-muted italic">Not set</span>}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleExpandMapping(index)}
                        className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                        title="Expand Entry"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMapping(index)}
                        className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                        title="Remove Entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. EXPANDED VIEW CARD */}
                {m.isExpanded && (
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Mapping Entry #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMapping(index)}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                      >
                        <Trash2 size={12} />
                        <span>Remove Mapping</span>
                      </button>
                    </div>

                    {m.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2.5 text-xs font-semibold">
                        {m.error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Source Barcode (Original)</label>
                        <input
                          type="text"
                          className="w-full bg-surface-elevated text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                          value={m.sourceBarcode}
                          disabled
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Target Barcode (New Rebranded)</label>
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono focus:border-primary"
                          value={m.targetBarcode}
                          onChange={(e) => handleMappingFieldChange(index, 'targetBarcode', e.target.value)}
                          placeholder="Scan or enter new serial barcode..."
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => handleFinishMapping(index)}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow cursor-pointer"
                      >
                        Finish &amp; Collapse Mapping
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Remarks Section */}
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-semibold text-text-secondary">Rebrand Operation Remarks / Notes</label>
          <input 
            type="text" 
            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 duration-200" 
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Swapped batch SIM cards due to network carrier update..."
          />
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-border">
          <Link href="/dashboard/rebrand" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
            Cancel
          </Link>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-warning hover:bg-warning/90 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
            disabled={loading || mappings.length === 0}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Rebrand Stock</span>
          </button>
        </div>
      </form>

      {/* Webcam Scanning Modal Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[450px] sm:max-w-[850px] max-h-[90vh] shadow-lg flex flex-col gap-4 animate-slide-down overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border flex-shrink-0">
              <h3 className="font-display font-bold text-sm text-text-primary">Scan Rebrand Source Barcode</h3>
              
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
