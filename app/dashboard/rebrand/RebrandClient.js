'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, RefreshCw, AlertCircle, Camera, QrCode, X, Smartphone } from 'lucide-react';
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

  // Sync isBulkScan to Ref to prevent stale closures without re-triggering camera instantiations
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

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

  const handleAddMapping = (sourceBarcode = '', targetBarcode = '') => {
    let added = false;
    setMappings(prev => {
      const alreadyMapped = prev.some(m => m.sourceBarcode.toLowerCase() === sourceBarcode.toLowerCase());
      if (!alreadyMapped) {
        added = true;
        return [...prev, { sourceBarcode, targetBarcode }];
      }
      return prev;
    });
    return added;
  };

  const handleRemoveMapping = (index) => {
    setMappings(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleMappingFieldChange = (index, field, value) => {
    setMappings(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
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

    try {
      await createBulkRebrandTransactions({
        sourceProductId,
        targetProductId,
        remarks,
        mappings
      });
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Source Product (Convert From)</label>
            <CustomSelect
              options={sourceProducts.map(p => ({ value: p.id, label: `${p.name} (${p.brand?.name || 'No Brand'})` }))}
              value={sourceProductId}
              onChange={(val) => setSourceProductId(val)}
              placeholder="Select Source Product..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Target Product (Convert To)</label>
            <CustomSelect
              options={products.map(p => ({ value: p.id, label: `${p.name} (${p.brand?.name || 'No Brand'})` }))}
              value={targetProductId}
              onChange={(val) => setTargetProductId(val)}
              placeholder="Select Target Product..."
              required
            />
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
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScanInputKeyDown}
              placeholder="Scan source barcode, then press Enter..."
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
          <span className="text-[10px] text-text-secondary">Available barcodes inside warehouse: {availableBarcodes.length}</span>
        </div>

        {/* Ledger Header */}
        <h3 className="font-display font-bold text-lg text-text-primary pb-3 border-b border-border mt-2">
          Barcodes Conversion Mapping Table
        </h3>

        {/* Mappings Table */}
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-xs border border-dashed border-border rounded-xl">
            No barcodes selected. Scan source barcodes above to populate the mapping table.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {mappings.map((m, index) => (
              <div key={index} className="flex items-center gap-4 bg-surface-elevated/20 p-3 border border-border rounded-lg">
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-text-secondary block">Source Barcode</span>
                  <span className="text-xs font-mono font-bold text-text-primary">{m.sourceBarcode}</span>
                </div>
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-text-secondary block mb-1">New Target Barcode</span>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                    value={m.targetBarcode}
                    onChange={(e) => handleMappingFieldChange(index, 'targetBarcode', e.target.value)}
                    placeholder="Enter new barcode..."
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMapping(index)}
                  className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors mt-4"
                  title="Remove barcode mapping"
                >
                  <Trash2 size={15} />
                </button>
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
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-warning hover:bg-warning/90 text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
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
                            onClick={() => setMappings([])}
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
                                className="inline-flex items-center gap-1 bg-warning/10 text-warning border border-warning/20 text-[10px] font-mono px-2 py-0.5 rounded font-semibold animate-pulse-once"
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
