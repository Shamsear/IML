'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, RefreshCw, AlertCircle, Camera, QrCode, X, Smartphone, CheckCircle, Edit2, Info } from 'lucide-react';
import Link from 'next/link';
import { createBulkRebrandTransactions } from '@/app/actions/transactions';
import { getAvailableBarcodes } from '@/app/actions/products';
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

export default function RebrandClient({ products, brands = [], stores = [] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Source product selection (only allow non-serialized products per user request)
  const sourceProducts = products.filter(p => !p.isSerialized);

  const [sourceProductId, setSourceProductId] = useState(sourceProducts[0]?.id || '');
  const [targetProductId, setTargetProductId] = useState(products[0]?.id || '');
  const [remarks, setRemarks] = useState('');

  // Brand filter for source product selection
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Inline product registration states for rebranding target product
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodBrandId, setProdBrandId] = useState(brands[0]?.id || '');
  const [prodItemCode, setProdItemCode] = useState('');
  const [prodLowStockAlert, setProdLowStockAlert] = useState('10');
  const [prodIsReturnable, setProdIsReturnable] = useState(false);
  const [prodImageFile, setProdImageFile] = useState(null);
  const [prodImagePreview, setProdImagePreview] = useState('');
  const [prodSimStoreId, setProdSimStoreId] = useState(stores[0]?.id || '');
  const [prodSimStoreCode, setProdSimStoreCode] = useState('');
  const [prodAutoGenName, setProdAutoGenName] = useState(false);

  // Target product replacement image state for existing catalog product
  const [targetProductImage, setTargetProductImage] = useState(null);
  const [targetProductImagePreview, setTargetProductImagePreview] = useState('');

  // Available barcodes in warehouse for selected source product
  const [availableBarcodes, setAvailableBarcodes] = useState([]);
  
  // Mappings of selected source barcodes to new target barcodes
  const [mappings, setMappings] = useState([]);

  // Range Mapping states (for SIM items only)
  const [rangeSrcStart, setRangeSrcStart] = useState('');
  const [rangeSrcEnd, setRangeSrcEnd] = useState('');
  const [rangeTgtStart, setRangeTgtStart] = useState('');
  const [rebrandActiveScanTarget, setRebrandActiveScanTarget] = useState('queue'); // 'queue', 'srcStart', 'srcEnd', 'tgtStart'
  const [useRangeRebrand, setUseRangeRebrand] = useState(false);
  const [nonSerializedQty, setNonSerializedQty] = useState('1');

  // Scanning barcode input
  const [scanInput, setScanInput] = useState('');

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);

  // Sync isBulkScan to Ref
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Image Cropping Modal states
  const [cropTarget, setCropTarget] = useState(null); // 'NEW_PRODUCT', 'REPLACEMENT', null
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropDimensions, setCropDimensions] = useState({ width: 320, height: 320 });
  const [originalFile, setOriginalFile] = useState(null);
  const cropImageRef = useRef(null);

  const handleDrag = (dx, dy) => {
    setCropX(prev => {
      const next = prev + dx;
      const maxOffset = Math.max(0, (cropDimensions.width * cropZoom - 320) / 2);
      return Math.min(maxOffset, Math.max(-maxOffset, next));
    });
    setCropY(prev => {
      const next = prev + dy;
      const maxOffset = Math.max(0, (cropDimensions.height * cropZoom - 320) / 2);
      return Math.min(maxOffset, Math.max(-maxOffset, next));
    });
  };

  const handleSaveCrop = () => {
    if (!cropTarget || !originalFile || !cropImageRef.current) return;

    const img = cropImageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const centerX = (320 - cropDimensions.width * cropZoom) / 2;
    const centerY = (320 - cropDimensions.height * cropZoom) / 2;

    const sx = - (centerX + cropX) / (cropDimensions.width * cropZoom) * imgWidth;
    const sy = - (centerY + cropY) / (cropDimensions.height * cropZoom) * imgHeight;
    const sw = (320 / (cropDimensions.width * cropZoom)) * imgWidth;
    const sh = (320 / (cropDimensions.height * cropZoom)) * imgHeight;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 500, 500);

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], originalFile.name, {
          type: originalFile.type,
          lastModified: Date.now()
        });

        if (cropTarget === 'NEW_PRODUCT') {
          setProdImageFile(croppedFile);
          setProdImagePreview(URL.createObjectURL(croppedFile));
        } else if (cropTarget === 'REPLACEMENT') {
          setTargetProductImage(croppedFile);
          setTargetProductImagePreview(URL.createObjectURL(croppedFile));
        }

        setCropTarget(null);
        setCropSrc('');
        setOriginalFile(null);
      }
    }, originalFile.type || 'image/jpeg', 0.95);
  };

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
      setUseRangeRebrand(false);
      setRangeSrcStart('');
      setRangeSrcEnd('');
      setRangeTgtStart('');
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

  // Check if source product is a SIM card
  const isSourceSim = sourceSelectedProduct?.category?.toUpperCase().includes('SIM') || 
                      sourceSelectedProduct?.name?.toUpperCase().includes('SIM');

  // Auto-set the inline target product's brand default matching the source product's brand
  useEffect(() => {
    if (sourceSelectedProduct?.brandId) {
      setProdBrandId(sourceSelectedProduct.brandId);
    }
  }, [sourceProductId, sourceSelectedProduct]);

  // Auto-generate name layout: [Brand Name] [Store Code] [Store Name] for SIM targets
  useEffect(() => {
    const isSim = sourceSelectedProduct?.category?.toUpperCase().includes('SIM');
    if (isNewProduct && isSim && prodAutoGenName) {
      const bObj = brands.find(b => b.id === prodBrandId);
      const sObj = stores.find(s => s.id === prodSimStoreId);
      if (bObj && sObj && prodSimStoreCode.trim()) {
        setProdName(`${bObj.name} ${prodSimStoreCode.trim()} ${sObj.name}`);
      } else {
        setProdName('');
      }
    }
  }, [isNewProduct, prodAutoGenName, prodBrandId, prodSimStoreId, prodSimStoreCode, sourceSelectedProduct, brands, stores]);

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

  const generateLengthSeries = (startCode, count) => {
    const numMatch = startCode.match(/\d+$/);
    if (!numMatch) throw new Error("Starting target barcode must end with a number.");
    const numStr = numMatch[0];
    const startNum = parseInt(numStr, 10);
    const prefix = startCode.substring(0, startCode.length - numStr.length);
    const paddingLength = numStr.length;
    
    const generated = [];
    for (let i = 0; i < count; i++) {
      const valStr = (startNum + i).toString().padStart(paddingLength, '0');
      generated.push(`${prefix}${valStr}`);
    }
    return generated;
  };

  const handleApplyRangeMapping = () => {
    const srcStart = rangeSrcStart.trim();
    const srcEnd = rangeSrcEnd.trim();
    const tgtStart = rangeTgtStart.trim();

    if (!srcStart || !srcEnd || !tgtStart) {
      alert("Please fill in all range boundaries (Source Start, Source End, and Target Start).");
      return;
    }

    try {
      const oldBarcodes = generateSeries(srcStart, srcEnd);
      const newBarcodes = generateLengthSeries(tgtStart, oldBarcodes.length);

      // Verify that all generated source barcodes are available in Warehouse stock
      const unavailable = oldBarcodes.filter(
        code => !availableBarcodes.some(b => b.barcode.toLowerCase() === code.toLowerCase())
      );

      if (unavailable.length > 0) {
        alert(`Some barcodes in the source range are not available in the Warehouse (e.g. ${unavailable.slice(0, 3).join(', ')}).`);
        return;
      }

      // Merge into mappings
      const newMappings = oldBarcodes.map((oldCode, idx) => ({
        sourceBarcode: oldCode,
        targetBarcode: newBarcodes[idx],
        isExpanded: false,
        error: ''
      }));

      setMappings(prev => {
        const filteredPrev = prev.filter(m => !oldBarcodes.includes(m.sourceBarcode));
        return [...filteredPrev, ...newMappings];
      });

      setRangeSrcStart('');
      setRangeSrcEnd('');
      setRangeTgtStart('');
      playBeep();
    } catch (e) {
      alert(e.message || "Failed to generate range mappings.");
    }
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

              if (rebrandActiveScanTarget === 'srcStart') {
                setRangeSrcStart(code);
                playBeep();
                setIsCameraOpen(false);
                return;
              }
              if (rebrandActiveScanTarget === 'srcEnd') {
                setRangeSrcEnd(code);
                playBeep();
                setIsCameraOpen(false);
                return;
              }
              if (rebrandActiveScanTarget === 'tgtStart') {
                setRangeTgtStart(code);
                playBeep();
                setIsCameraOpen(false);
                return;
              }

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
    setIsCompanionActive(true);
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
    if (mobileSession?.sessionId && isCompanionActive) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.barcodes && data.barcodes.length > 0) {
              data.barcodes.forEach(code => {
                const cleanCode = code.trim();

                if (rebrandActiveScanTarget === 'srcStart') {
                  setRangeSrcStart(cleanCode);
                  playBeep();
                  setIsMobileModalOpen(false);
                  return;
                }
                if (rebrandActiveScanTarget === 'srcEnd') {
                  setRangeSrcEnd(cleanCode);
                  playBeep();
                  setIsMobileModalOpen(false);
                  return;
                }
                if (rebrandActiveScanTarget === 'tgtStart') {
                  setRangeTgtStart(cleanCode);
                  playBeep();
                  setIsMobileModalOpen(false);
                  return;
                }

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
  }, [mobileSession, availableBarcodes, isCompanionActive]);

  // Get current session barcodes for bulk list view
  const scannedBarcodesList = mappings.map(m => m.sourceBarcode).filter(Boolean);
  const currentScannedCount = scannedBarcodesList.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Validation Loop
    if (sourceSelectedProduct?.isSerialized) {
      if (mappings.length === 0) {
        setError('Please scan or select at least one barcode to rebrand');
        setLoading(false);
        return;
      }
      for (let i = 0; i < mappings.length; i++) {
        if (!mappings[i].targetBarcode.trim()) {
          handleMappingFieldChange(i, 'error', 'Target barcode is required');
          handleExpandMapping(i);
          setLoading(false);
          return;
        }
      }
    } else {
      const qty = parseInt(nonSerializedQty, 10);
      if (!qty || qty <= 0) {
        setError('Quantity must be greater than 0');
        setLoading(false);
        return;
      }
      if (qty > (sourceSelectedProduct?.warehouseStock || 0)) {
        setError(`Quantity exceeds available warehouse stock (${sourceSelectedProduct?.warehouseStock || 0})`);
        setLoading(false);
        return;
      }
    }

    if (isNewProduct) {
      if (!prodName.trim()) {
        setError('Display name is required for target product registration');
        setLoading(false);
        return;
      }
      if (!prodBrandId) {
        setError('Brand selection is required for target product registration');
        setLoading(false);
        return;
      }
    } else {
      if (!targetProductId) {
        setError('Target product selection is required');
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('sourceProductId', sourceProductId);
      formData.append('remarks', remarks);
      formData.append('mappings', JSON.stringify(mappings.map(m => ({ sourceBarcode: m.sourceBarcode, targetBarcode: m.targetBarcode }))));
      if (!sourceSelectedProduct?.isSerialized) {
        formData.append('nonSerializedQty', nonSerializedQty);
      }
      
      formData.append('isNewProduct', isNewProduct.toString());
      if (isNewProduct) {
        formData.append('prodName', prodName);
        formData.append('prodBrandId', prodBrandId);
        formData.append('prodItemCode', prodItemCode || '');
        formData.append('prodCategory', sourceSelectedProduct?.category || 'SIM');
        formData.append('prodLowStockAlert', prodLowStockAlert);
        formData.append('prodIsReturnable', prodIsReturnable ? 'true' : 'false');
        if (prodImageFile) {
          formData.append('targetProductImage', prodImageFile);
        }
      } else {
        formData.append('targetProductId', targetProductId);
        if (targetProductImage) {
          formData.append('targetProductImage', targetProductImage);
        }
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
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <RefreshCw size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/rebrand" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
              Rebrand Stock Items
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Convert existing central warehouse serial numbers from one catalog item to another
            </p>
          </div>
        </div>
        {/* Companion Scanner Status Badge */}
        <div className="flex items-center">
          {isCompanionActive && mobileSession?.sessionId ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
              options={sourceProducts
                .filter(p => brandFilter === 'ALL' || p.brand?.id === brandFilter)
                .map(p => ({ value: p.id, label: p.name, imageUrl: p.imageUrl, warehouseStock: p.warehouseStock }))}
              value={sourceProductId}
              onChange={(val) => setSourceProductId(val)}
              placeholder="Select Source Product..."
              required
            />
            {sourceSelectedProduct?.imageUrl && (
              <div className="mt-2 flex items-center gap-2 bg-surface-elevated/40 p-2 border border-border rounded-lg max-w-fit animate-fade-in">
                <img src={sourceSelectedProduct.imageUrl} alt="Source Preview" className="w-10 h-10 rounded border border-border bg-white object-contain flex-shrink-0" />
                <span className="text-[10px] text-text-secondary font-medium">Source Product Picture</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 justify-end pb-3">
            <span className="text-xs text-text-secondary leading-relaxed">
              Source category: <strong className="text-primary font-bold uppercase">{sourceSelectedProduct?.category || 'SIM'}</strong>
            </span>
          </div>
        </div>

        {/* Radio toggle for existing vs inline product creation */}
        <div className="flex items-center gap-6 pb-4 border-b border-border/60">
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
            <input
              type="radio"
              name="targetProductSource"
              checked={!isNewProduct}
              onChange={() => setIsNewProduct(false)}
              className="accent-primary"
            />
            <span>Rebrand to Existing Catalog Product</span>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
            <input
              type="radio"
              name="targetProductSource"
              checked={isNewProduct}
              onChange={() => setIsNewProduct(true)}
              className="accent-primary"
            />
            <span className="text-primary font-bold">Register &amp; Rebrand to New Product</span>
          </label>
        </div>

        {!isNewProduct ? (
          /* EXISTING PRODUCT dropdown & replacement image */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-down">
            <div className="flex flex-col gap-1.5 relative sm:col-span-2">
              <label className="text-xs font-semibold text-text-secondary">Target Product (Convert To)</label>
              <CustomSelect
                options={products.filter(p => 
                  p.isSerialized && 
                  p.brandId === sourceSelectedProduct?.brandId && (
                    p.category?.toUpperCase().includes('SIM') ||
                    p.category?.toUpperCase().includes('ROUTER') ||
                    p.name?.toUpperCase().includes('SIM') ||
                    p.name?.toUpperCase().includes('ROUTER')
                  )
                ).map(p => ({ value: p.id, label: p.name, imageUrl: p.imageUrl, warehouseStock: p.warehouseStock }))}
                value={targetProductId}
                onChange={(val) => setTargetProductId(val)}
                placeholder="Select Target Product..."
                required
              />
              {targetSelectedProduct?.imageUrl && (
                <div className="mt-2 flex items-center gap-2 bg-surface-elevated/40 p-2 border border-border rounded-lg max-w-fit animate-fade-in">
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
                        setOriginalFile(file);
                        setCropSrc(URL.createObjectURL(file));
                        setCropTarget('REPLACEMENT');
                        setCropZoom(1);
                        setCropX(0);
                        setCropY(0);
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
        ) : (
          /* NEW INLINE PRODUCT form details */
          <div className="flex flex-col gap-4 animate-slide-down">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60 flex items-center gap-1.5">
              <Info size={13} className="text-primary" />
              <span>Target Product Catalog Details</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Associated Brand</label>
                <input
                  type="text"
                  className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none disabled:bg-surface-elevated/40 font-semibold"
                  value={brands.find(b => b.id === prodBrandId)?.name || '---'}
                  disabled
                />
              </div>

              {sourceSelectedProduct?.category?.toUpperCase().includes('SIM') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2 bg-primary/5 p-4 rounded-xl border border-primary/10 animate-slide-down">
                  <div className="flex flex-col gap-1.5 sm:col-span-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        className="custom-checkbox"
                        checked={prodAutoGenName}
                        onChange={(e) => {
                          setProdAutoGenName(e.target.checked);
                        }}
                      />
                      <span className="text-primary font-bold">Auto-Generate SIM Card Display Name</span>
                    </label>
                    <span className="text-[10px] text-text-secondary">Generates name layout: [Brand Name] [Store Code] [Store Name]</span>
                  </div>

                  {prodAutoGenName && (
                    <>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-text-secondary">Target Store</label>
                        <CustomSelect
                          options={stores.map(s => ({ value: s.id, label: s.name }))}
                          value={prodSimStoreId}
                          onChange={(val) => setProdSimStoreId(val)}
                          placeholder="-- Select Store --"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary">Store Code</label>
                        <input
                          type="text"
                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                          value={prodSimStoreCode}
                          onChange={(e) => setProdSimStoreCode(e.target.value)}
                          placeholder="e.g. 4001"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Display Name {sourceSelectedProduct?.category?.toUpperCase().includes('SIM') && prodAutoGenName && <span className="text-[10px] text-primary italic">(Auto-Generated)</span>}
                </label>
                <input
                  type="text"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-elevated/40"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  disabled={sourceSelectedProduct?.category?.toUpperCase().includes('SIM') && prodAutoGenName}
                  placeholder={sourceSelectedProduct?.category?.toUpperCase().includes('SIM') && prodAutoGenName ? "Complete store fields above to generate name..." : "e.g. Ooredoo Gold SIM 2026"}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">SKU / Item Code</label>
                <input
                  type="text"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  value={prodItemCode}
                  onChange={(e) => setProdItemCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Low Stock Threshold</label>
                <input
                  type="number"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  value={prodLowStockAlert}
                  onChange={(e) => setProdLowStockAlert(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>

              <div className="flex items-center gap-6 mt-4">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="custom-checkbox"
                    checked={prodIsReturnable}
                    onChange={(e) => setProdIsReturnable(e.target.checked)}
                  />
                  <span>Returnable Item</span>
                </label>
              </div>

              {/* Image Upload Area */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                <label className="text-xs font-semibold text-text-secondary">Product Image</label>
                <div className="flex items-center gap-4 border border-border border-dashed p-4 rounded-xl bg-surface-elevated/10">
                  {prodImagePreview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <img src={prodImagePreview} alt="Preview" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setProdImageFile(null);
                          setProdImagePreview('');
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
                          setOriginalFile(file);
                          setCropSrc(URL.createObjectURL(file));
                          setCropTarget('NEW_PRODUCT');
                          setCropZoom(1);
                          setCropX(0);
                          setCropY(0);
                        }
                      }}
                      className="hidden"
                      id="inline-target-image"
                    />
                    <label
                      htmlFor="inline-target-image"
                      className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-1.5 w-fit border-dashed"
                    >
                      <span>Browse Picture</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanner Barcode Section */}
        <div className="flex flex-col gap-2 p-4 bg-surface-elevated/40 border border-border rounded-xl">
          <div className="flex items-center justify-between pb-1">
            <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <QrCode size={15} className="text-primary" />
              <span>{useRangeRebrand ? "Rebrand Serial Range Builder" : "Scan / Search Source Barcode"}</span>
            </label>
            {isSourceSim && (
              <button
                type="button"
                onClick={() => {
                  setUseRangeRebrand(!useRangeRebrand);
                  setRebrandActiveScanTarget('queue');
                }}
                className="text-[10px] text-primary font-bold hover:underline"
              >
                {useRangeRebrand ? "Switch to Manual Scan List" : "Switch to Serial Range Builder"}
              </button>
            )}
          </div>

          {useRangeRebrand && isSourceSim ? (
            /* RANGE REBRAND BUILDER CONTAINER */
            <div className="p-4 bg-surface-elevated/20 border border-border border-dashed rounded-xl flex flex-col gap-3.5 animate-slide-down">
              <div className="flex items-center gap-2 text-text-secondary text-[11px] font-medium leading-relaxed">
                <span>Enter source start/end range and the beginning target serial number to generate mapped pairs.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                    <span>Source Start Barcode</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRebrandActiveScanTarget('srcStart');
                        setIsCameraOpen(true);
                      }}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Scan
                    </button>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    placeholder="e.g. SIM001"
                    value={rangeSrcStart}
                    onChange={(e) => setRangeSrcStart(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                    <span>Source End Barcode</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRebrandActiveScanTarget('srcEnd');
                        setIsCameraOpen(true);
                      }}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Scan
                    </button>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    placeholder="e.g. SIM100"
                    value={rangeSrcEnd}
                    onChange={(e) => setRangeSrcEnd(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                    <span>Target Start Barcode</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRebrandActiveScanTarget('tgtStart');
                        setIsCameraOpen(true);
                      }}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Scan
                    </button>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    placeholder="e.g. NEW_SIM001"
                    value={rangeTgtStart}
                    onChange={(e) => setRangeTgtStart(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyRangeMapping}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer w-fit"
              >
                Generate Range Mappings
              </button>
            </div>
          ) : (
            /* STANDARD SINGLE BARCODE SCAN INPUT */
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleScanInputKeyDown}
                  placeholder="Scan or type barcode, then press Enter..."
                />
                
                <button
                  type="button"
                  onClick={() => {
                    setRebrandActiveScanTarget('queue');
                    handleOpenMobileScanner();
                  }}
                  className="px-4 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  title="Pair companion scanner"
                >
                  <Smartphone size={16} />
                  <span className="text-xs font-semibold hidden sm:inline">Mobile Companion</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRebrandActiveScanTarget('queue');
                    setIsCameraOpen(true);
                  }}
                  className="px-4 bg-primary hover:bg-primary-hover text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  title="Webcam scan camera"
                >
                  <Camera size={16} />
                  <span className="text-xs font-semibold hidden sm:inline">Webcam Scanner</span>
                </button>
              </div>
              <div className="text-[10px] text-text-secondary">
                Warehouse available stock serials: <strong className="text-primary">{availableBarcodes.length}</strong> items available.
              </div>
            </>
          )}
        </div>

        {/* Mappings Queue Card List */}
        {sourceSelectedProduct?.isSerialized && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Serials to Rebrand ({currentScannedCount} items selected)</span>
            {mappings.length > 0 && (
              <button
                type="button"
                onClick={() => setMappings([])}
                className="text-xs text-danger font-bold hover:underline"
              >
                Clear All mappings
              </button>
            )}
          </div>

          {mappings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl bg-surface-elevated/10">
              <QrCode size={36} className="text-text-muted mb-2 animate-pulse" />
              <span className="text-xs font-semibold text-text-secondary">No barcodes scanned yet</span>
              <p className="text-[10px] text-text-muted max-w-[280px] leading-relaxed mt-1">
                Scan source barcodes using the webcam, pair code sync, or search input above.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mappings.map((item, idx) => (
                <div 
                  key={idx}
                  className={`bg-surface border rounded-xl shadow-sm overflow-hidden transition-all duration-200
                    ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border'}
                  `}
                >
                  {/* Collapsed state row */}
                  {!item.isExpanded && (
                    <div 
                      onClick={() => handleExpandMapping(idx)}
                      className="p-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-mono font-bold text-text-primary block truncate">
                          {item.sourceBarcode} ➔ <span className={item.targetBarcode ? 'text-primary' : 'text-text-muted font-normal italic'}>{item.targetBarcode || 'Needs mapping...'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleExpandMapping(idx)}
                          className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface-elevated transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMapping(idx)}
                          className="p-1 text-text-secondary hover:text-danger rounded hover:bg-surface-elevated transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded state form block */}
                  {item.isExpanded && (
                    <div className="p-4 sm:p-5 flex flex-col gap-4 animate-slide-down">
                      {item.error && (
                        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2.5 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle size={14} />
                          <span>{item.error}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-text-secondary uppercase">Source Serial Barcode</label>
                          <input
                            type="text"
                            className="w-full bg-surface-elevated/40 border border-border text-text-primary font-mono text-xs rounded-lg px-3 py-2"
                            value={item.sourceBarcode}
                            disabled
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-text-secondary uppercase">New Target Barcode (Rebranded ID)</label>
                          <input
                            type="text"
                            className="w-full bg-surface border border-border text-text-primary font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            placeholder="Scan/Type target barcode mapping..."
                            value={item.targetBarcode}
                            onChange={(e) => handleMappingFieldChange(idx, 'targetBarcode', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <button
                          type="button"
                          onClick={() => handleFinishMapping(idx)}
                          className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                        >
                          Save &amp; Collapse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )}
        {!sourceSelectedProduct?.isSerialized && sourceSelectedProduct && (
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm mt-4 animate-fade-in">
            <div className="flex flex-col gap-1.5 max-w-xs">
              <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                <span>Quantity to Rebrand</span>
                <span className="text-[10px] text-text-muted font-mono">
                  In Stock: <strong className="text-primary">{sourceSelectedProduct.warehouseStock || 0}</strong>
                </span>
              </label>
              <input
                type="number"
                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                min={1}
                value={nonSerializedQty}
                onChange={(e) => setNonSerializedQty(e.target.value)}
                placeholder="e.g. 10"
                required
              />
              {parseInt(nonSerializedQty, 10) > sourceSelectedProduct.warehouseStock && (
                <span className="text-[10px] font-semibold text-danger mt-1 animate-pulse">
                  ⚠️ Warning: Quantity exceeds available stock ({sourceSelectedProduct.warehouseStock})!
                </span>
              )}
              {parseInt(nonSerializedQty, 10) <= 0 && (
                <span className="text-[10px] font-semibold text-danger mt-1">
                  ⚠️ Warning: Quantity must be greater than 0.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Global Remarks */}
        <div className="flex flex-col gap-1.5 pt-4 border-t border-border">
          <label className="text-xs font-semibold text-text-secondary">Rebranding Batch Remarks / Notes</label>
          <input
            type="text"
            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Conversion of SIM batches to new brand campaign catalog..."
          />
        </div>

        {/* Action Triggers */}
        <div className="flex justify-end gap-3 pt-4">
          <Link href="/dashboard/rebrand" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
            Cancel
          </Link>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-warning hover:bg-warning/90 text-text-primary font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
            disabled={loading}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Log Rebranding Mapping</span>
          </button>
        </div>
      </form>

      {/* Webcam camera scanner overlay modal */}
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
                      className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md transition-colors"
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

      {/* Wireless companion sync modal pairing */}
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
      {/* Image Cropping Modal */}
      {cropTarget !== null && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-extrabold text-sm text-text-primary uppercase tracking-wider">Crop Product Image</h3>
              <button
                type="button"
                onClick={() => {
                  setCropTarget(null);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Viewport container */}
            <div className="flex justify-center items-center py-2 bg-surface-elevated/40 rounded-xl border border-border/60">
              <div 
                className="w-[320px] h-[320px] overflow-hidden relative border border-border rounded-lg bg-black cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => {
                  setIsDragging(true);
                  setDragStart({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => {
                  if (!isDragging) return;
                  const dx = e.clientX - dragStart.x;
                  const dy = e.clientY - dragStart.y;
                  setDragStart({ x: e.clientX, y: e.clientY });
                  handleDrag(dx, dy);
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    setIsDragging(true);
                    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                  }
                }}
                onTouchMove={(e) => {
                  if (!isDragging || !e.touches[0]) return;
                  const dx = e.touches[0].clientX - dragStart.x;
                  const dy = e.touches[0].clientY - dragStart.y;
                  setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                  handleDrag(dx, dy);
                }}
                onTouchEnd={() => setIsDragging(false)}
              >
                <img
                  ref={cropImageRef}
                  src={cropSrc}
                  alt="Crop Target"
                  className="max-w-none pointer-events-none absolute"
                  style={{
                    width: `${cropDimensions.width * cropZoom}px`,
                    height: `${cropDimensions.height * cropZoom}px`,
                    left: `calc(50% + ${cropX}px)`,
                    top: `calc(50% + ${cropY}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  onLoad={(e) => {
                    const img = e.target;
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    let renderW, renderH;
                    if (w > h) {
                      renderH = 320;
                      renderW = (w / h) * 320;
                    } else {
                      renderW = 320;
                      renderH = (h / w) * 320;
                    }
                    setCropDimensions({ width: renderW, height: renderH });
                  }}
                />
                {/* Viewport Frame Guidelines overlay */}
                <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none rounded-lg">
                  {/* Grid guidelines */}
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/20 border-dashed"></div>
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
                <span>Zoom Level</span>
                <span className="font-mono text-primary font-bold">x{cropZoom.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = parseFloat(e.target.value);
                  setCropZoom(nextZoom);
                  // Readjust offsets if they exceed new bounds
                  const maxOffsetX = Math.max(0, (cropDimensions.width * nextZoom - 320) / 2);
                  const maxOffsetY = Math.max(0, (cropDimensions.height * nextZoom - 320) / 2);
                  setCropX(prev => Math.min(maxOffsetX, Math.max(-maxOffsetX, prev)));
                  setCropY(prev => Math.min(maxOffsetY, Math.max(-maxOffsetY, prev)));
                }}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <span className="text-[10px] text-text-muted text-center leading-relaxed">
              Drag the image to position and adjust the slider to zoom. The final picture will be saved as a square 1:1 catalog image.
            </span>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setCropTarget(null);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors shadow-sm"
              >
                Crop &amp; Save Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






