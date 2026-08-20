'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, Save, Users, Building2, Calendar, FileText, CheckCircle, AlertCircle, Camera, QrCode, X, Smartphone, Edit2, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBulkProducts, getProductById, updateProduct } from '@/app/actions/products';
import CustomSelect from '@/components/CustomSelect';
import { getClientScanCompanionUrl } from '@/lib/scan-companion-url';
import DashboardLoading from '@/app/dashboard/loading';

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

export default function NewProductClient({ brands, stores = [], editId: propEditId = null, existingCategories = [], recentSuppliers = [], recentReceivers = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId') || propEditId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Webcam scanning state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);

  // Active target slot for webcam/companion barcode scans: { itemIdx, inboundIdx }
  const [activeScanTarget, setActiveScanTarget] = useState(null);
  
  // Custom suggestions active targets
  const [activeCategorySuggestionsTarget, setActiveCategorySuggestionsTarget] = useState(null); // idx
  const [activeSupplierSuggestionsTarget, setActiveSupplierSuggestionsTarget] = useState(null); // { itemIdx, inboundIdx }
  const [activeReceiverSuggestionsTarget, setActiveReceiverSuggestionsTarget] = useState(null); // { itemIdx, inboundIdx }

  // Cooldown refs to prevent double-scanning same barcode within 2 seconds
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Sync isBulkScan to Ref
  const isBulkScanRef = useRef(isBulkScan);
  useEffect(() => {
    isBulkScanRef.current = isBulkScan;
  }, [isBulkScan]);

  // Image Cropping Modal states
  const [croppingIdx, setCroppingIdx] = useState(null);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropDimensions, setCropDimensions] = useState({ width: 320, height: 320 });
  const [originalFile, setOriginalFile] = useState(null);
  const cropImageRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }

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
    if (croppingIdx === null || !originalFile || !cropImageRef.current) return;

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

        updateItemField(croppingIdx, 'imageFile', croppedFile);
        updateItemField(croppingIdx, 'imagePreview', URL.createObjectURL(croppedFile));

        setCroppingIdx(null);
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

  // Helper to construct empty inbound entry details
  const createEmptyInboundEntry = (index = 0) => ({
    id: `inb-${Date.now()}-${index}`,
    fromId: 'Initial Import',
    receivedBy: '',
    initialQty: '',
    initialBarcodes: '',
    deliveryNote: '',
    notes: '',
    rangeMode: false,
    rangeStart: '',
    rangeEnd: '',
  });

  // Helper to construct a blank product item configuration for bulk creation
  const createEmptyProductItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    brandId: searchParams.get('brandId') || brands[0]?.id || '',
    itemCode: '',
    category: 'Stands',
    size: '', // For uniforms: XS, S, M, L, XL, XXL, XXXL
    productType: 'NORMAL', // 'NORMAL', 'SIM', 'ROUTER'
    stockCap: '',
    isReturnable: false,
    isDisposable: false,
    isPublic: true,
    includeInbound: false, // Default is false (catalog details only)
    inbounds: [createEmptyInboundEntry(0)], // List of inbound shipments
    imageFile: null,
    imagePreview: '',
    imageUrl: '',
    rack: '',
    shelf: '',
    isExpanded: true,
    error: '',
    simStoreId: stores[0]?.id || '',
    simStoreCode: '',
    autoGenName: true,
  });

  // State array for products queue
  const [items, setItems] = useState([createEmptyProductItem(0)]);

  // Filtering helpers for custom suggestions dropdowns
  const getFilteredCategories = (query) => {
    const list = ['Stands', 'Uniforms', 'Gifts', 'Disposables', ...existingCategories];
    const unique = Array.from(new Set(list));
    if (!query) return unique;
    return unique.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  };

  const getFilteredSuppliers = (query) => {
    if (!query) return recentSuppliers;
    return recentSuppliers.filter(s => s.toLowerCase().includes(query.toLowerCase()));
  };

  const getFilteredReceivers = (query) => {
    if (!query) return recentReceivers;
    return recentReceivers.filter(r => r.toLowerCase().includes(query.toLowerCase()));
  };

  // Edit Mode state (if editId is set, we only handle one single product item)
  useEffect(() => {
    if (editId) {
      const loadProduct = async () => {
        setLoading(true);
        try {
          const product = await getProductById(editId);
          if (product) {
            let pType = 'NORMAL';
            if (product.isSerialized) {
              pType = product.category?.toUpperCase().includes('ROUTER') ? 'ROUTER' : 'SIM';
            }
             setItems([{
              id: product.id,
              name: product.name,
              brandId: product.brandId,
              itemCode: product.itemCode || '',
              category: product.category || 'Stands',
              productType: pType,
              stockCap: product.stockCap ? product.stockCap.toString() : '',
              isReturnable: product.isReturnable,
              isDisposable: product.isDisposable,
              isPublic: product.isPublic,
              includeInbound: false,
              inbounds: [createEmptyInboundEntry(0)],
              imageFile: null,
              imagePreview: '',
              imageUrl: product.imageUrl || '',
              rack: product.rack || '',
              shelf: product.shelf || '',
              isExpanded: true,
              error: '',
              simStoreId: stores[0]?.id || '',
              simStoreCode: '',
              autoGenName: false,
            }]);
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
  }, [editId, stores]);

  // Handle single item field update
  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      
      // Auto-category helpers
      if (field === 'productType') {
        if (value === 'SIM') {
          updated.category = 'SIM';
        } else if (value === 'ROUTER') {
          updated.category = 'Router';
        } else {
          updated.category = 'Stands';
        }
        // Force rangeMode to false for Routers
        updated.inbounds = updated.inbounds.map(inb => ({
          ...inb,
          rangeMode: false,
          rangeStart: '',
          rangeEnd: '',
          initialBarcodes: '',
          initialQty: ''
        }));
      }

      // SIM Name Auto-Generation logic
      if (updated.productType === 'SIM' && updated.autoGenName) {
        const bObj = brands.find(b => b.id === updated.brandId);
        const sObj = stores.find(s => s.id === updated.simStoreId);
        if (bObj && sObj && updated.simStoreCode.trim()) {
          updated.name = `${bObj.name} ${updated.simStoreCode.trim()} ${sObj.name}`;
        } else {
          updated.name = '';
        }
      }

      return updated;
    }));
  };

  // Handle specific sub-inbound field updates
  const updateInboundField = (itemIdx, inboundIdx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      const updatedInbounds = item.inbounds.map((inb, j) => {
        if (j !== inboundIdx) return inb;
        return { ...inb, [field]: value };
      });
      return { ...item, inbounds: updatedInbounds };
    }));
  };

  const handleAddInboundEntry = (itemIdx) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      return {
        ...item,
        inbounds: [...item.inbounds, createEmptyInboundEntry(item.inbounds.length)]
      };
    }));
  };

  const handleRemoveInboundEntry = (itemIdx, inboundIdx) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== itemIdx) return item;
      if (item.inbounds.length === 1) return item;
      return {
        ...item,
        inbounds: item.inbounds.filter((_, j) => j !== inboundIdx)
      };
    }));
  };

  const addBarcodeToActiveItem = (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    let added = false;
    setItems(prev => {
      if (!activeScanTarget) return prev;
      const { itemIdx, inboundIdx, field } = activeScanTarget;

      const targetItem = prev[itemIdx];
      if (!targetItem) return prev;

      const targetInbound = targetItem.inbounds[inboundIdx];
      if (!targetInbound) return prev;

      if (field === 'rangeStart') {
        added = true;
        const updatedInbounds = targetItem.inbounds.map((inb, j) => {
          if (j !== inboundIdx) return inb;
          return { ...inb, rangeStart: cleanCode };
        });
        return prev.map((item, i) => i === itemIdx ? { ...item, inbounds: updatedInbounds } : item);
      } else if (field === 'rangeEnd') {
        added = true;
        const updatedInbounds = targetItem.inbounds.map((inb, j) => {
          if (j !== inboundIdx) return inb;
          return { ...inb, rangeEnd: cleanCode };
        });
        return prev.map((item, i) => i === itemIdx ? { ...item, inbounds: updatedInbounds } : item);
      } else {
        const currentList = targetInbound.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          added = true;

          const updatedInbounds = targetItem.inbounds.map((inb, j) => {
            if (j !== inboundIdx) return inb;
            return {
              ...inb,
              initialBarcodes: newList.join('\n')
            };
          });
          return prev.map((item, i) => i === itemIdx ? { ...item, inbounds: updatedInbounds } : item);
        }
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

  const handleApplyRange = (itemIdx, inboundIdx) => {
    const targetItem = items[itemIdx];
    if (!targetItem) return;
    const targetInbound = targetItem.inbounds[inboundIdx];
    if (!targetInbound) return;

    const start = targetInbound.rangeStart.trim();
    const end = targetInbound.rangeEnd.trim();
    if (!start || !end) {
      alert("Please enter both starting and ending barcodes.");
      return;
    }

    try {
      const generated = generateSeries(start, end);
      const currentList = targetInbound.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      const mergedList = Array.from(new Set([...currentList, ...generated]));

      setItems(prev => prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const updatedInbounds = item.inbounds.map((inb, j) => {
          if (j !== inboundIdx) return inb;
          return {
            ...inb,
            initialBarcodes: mergedList.join('\n'),
            rangeStart: '',
            rangeEnd: '',
          };
        });
        return { ...item, inbounds: updatedInbounds };
      }));
      playBeep();
    } catch (e) {
      alert(e.message || "Failed to generate range.");
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
        let attempts = 0;
        while (!document.getElementById('camera-reader-element') && attempts < 10) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }
        if (!document.getElementById('camera-reader-element')) {
          console.warn("Camera reader element target is not mounted yet.");
          return;
        }

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

              if (!isBulkScanRef.current || activeScanTarget?.field === 'rangeStart' || activeScanTarget?.field === 'rangeEnd') {
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
  }, [isCameraOpen, cameraPermissionStatus, activeScanTarget]);

  // Inject scan laser UI
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

  // Poll mobile scans
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
                const added = addBarcodeToActiveItem(code);
                if (added) {
                  playBeep();
                  if (activeScanTarget?.field === 'rangeStart' || activeScanTarget?.field === 'rangeEnd') {
                    setIsMobileModalOpen(false);
                  }
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
  }, [mobileSession, activeScanTarget, isCompanionActive]);

  // Add brand-new empty product configuration to queue
  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyProductItem(prev.length)));
  };

  // Expand target index and collapse others
  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  // Validate and collapse target index
  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (!item.name.trim()) {
      updateItemField(idx, 'error', 'Product name is required');
      return;
    }
    if (!item.brandId) {
      updateItemField(idx, 'error', 'Please select an associated brand owner');
      return;
    }

    if (item.includeInbound) {
      if (!item.inbounds || item.inbounds.length === 0) {
        updateItemField(idx, 'error', 'Please add at least one inbound stock entry or disable inbound logging');
        return;
      }
      for (let j = 0; j < item.inbounds.length; j++) {
        const inb = item.inbounds[j];
        if (!inb.fromId.trim()) {
          updateItemField(idx, 'error', `Inbound Entry #${j + 1}: Supplier name is required`);
          return;
        }
        const qty = item.productType === 'NORMAL' 
          ? parseInt(inb.initialQty, 10) 
          : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length;

        if (qty <= 0 || isNaN(qty)) {
          updateItemField(idx, 'error', `Inbound Entry #${j + 1}: Please enter a valid quantity / scan barcodes`);
          return;
        }
      }
    }

    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  // Remove target item from queue
  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyProductItem(0)];
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(item => item.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  // Global submit batch handler
  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // 1. Validation loop
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) {
        updateItemField(i, 'error', 'Product name is required');
        handleExpandItem(i);
        setLoading(false);
        return;
      }

      if (item.includeInbound) {
        if (!item.inbounds || item.inbounds.length === 0) {
          updateItemField(i, 'error', 'Please add at least one inbound stock entry or disable inbound logging');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        for (let j = 0; j < item.inbounds.length; j++) {
          const inb = item.inbounds[j];
          if (!inb.fromId.trim()) {
            updateItemField(i, 'error', `Inbound Entry #${j + 1}: Supplier name is required`);
            handleExpandItem(i);
            setLoading(false);
            return;
          }
          const qty = item.productType === 'NORMAL' 
            ? parseInt(inb.initialQty, 10) 
            : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length;

          if (qty <= 0 || isNaN(qty)) {
            updateItemField(i, 'error', `Inbound Entry #${j + 1}: Please enter a valid quantity / scan barcodes`);
            handleExpandItem(i);
            setLoading(false);
            return;
          }
        }
      }
    }

    try {
      if (editId) {
        // Edit mode (handles single item only)
        const item = items[0];
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('brandId', item.brandId);
        formData.append('itemCode', item.itemCode || '');
        formData.append('category', item.category);
        formData.append('size', item.size || '');
        formData.append('isSerialized', item.productType !== 'NORMAL' ? 'true' : 'false');
        formData.append('stockCap', item.stockCap || '');
        formData.append('isReturnable', item.isReturnable ? 'true' : 'false');
        formData.append('isDisposable', item.isDisposable ? 'true' : 'false');
        formData.append('isPublic', item.isPublic ? 'true' : 'false');
        formData.append('rack', item.rack || '');
        formData.append('shelf', item.shelf || '');
        if (item.imageFile) {
          formData.append('imageFile', item.imageFile);
        } else if (item.imageUrl) {
          formData.append('imageUrl', item.imageUrl);
        }
        await updateProduct(editId, formData);
        setSuccess(`Product "${item.name}" updated successfully!`);
      } else {
        // Create mode (Batch upload via FormData serialization)
        const formData = new FormData();
        formData.append('count', items.length.toString());
        items.forEach((item, idx) => {
          formData.append(`item_${idx}_name`, item.name);
          formData.append(`item_${idx}_brandId`, item.brandId);
          formData.append(`item_${idx}_itemCode`, item.itemCode || '');
          formData.append(`item_${idx}_category`, item.category);
          formData.append(`item_${idx}_size`, item.size || '');
          formData.append(`item_${idx}_productType`, item.productType);
          formData.append(`item_${idx}_stockCap`, item.stockCap || '');
          formData.append(`item_${idx}_isReturnable`, item.isReturnable ? 'true' : 'false');
          formData.append(`item_${idx}_isDisposable`, item.isDisposable ? 'true' : 'false');
          formData.append(`item_${idx}_isPublic`, item.isPublic ? 'true' : 'false');
          formData.append(`item_${idx}_rack`, item.rack || '');
          formData.append(`item_${idx}_shelf`, item.shelf || '');

          // Serialize optional multiple inbounds
          formData.append(`item_${idx}_inboundCount`, item.includeInbound ? item.inbounds.length.toString() : '0');
          if (item.includeInbound) {
            item.inbounds.forEach((inb, j) => {
              const inboundQty = item.productType === 'NORMAL' 
                ? (inb.initialQty || '0') 
                : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length.toString();

              formData.append(`item_${idx}_inbound_${j}_qty`, inboundQty);
              formData.append(`item_${idx}_inbound_${j}_barcodes`, inb.initialBarcodes || '');
              formData.append(`item_${idx}_inbound_${j}_fromId`, inb.fromId || 'Initial Import');
              formData.append(`item_${idx}_inbound_${j}_receivedBy`, inb.receivedBy || '');
              formData.append(`item_${idx}_inbound_${j}_deliveryNote`, inb.deliveryNote || 'INITIAL_STOCK');
              formData.append(`item_${idx}_inbound_${j}_notes`, inb.notes || 'Auto-received initial stock');
            });
          }

          if (item.imageFile) {
            formData.append(`item_${idx}_imageFile`, item.imageFile);
          } else if (item.imageUrl) {
            formData.append(`item_${idx}_imageUrl`, item.imageUrl);
          }
        });

        await createBulkProducts(formData);
        setSuccess(`Registered all ${items.length} products successfully!`);
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
      setError(err.message || 'Failed to submit products batch.');
      setLoading(false);
    }
  };

  if (editId && loading && items[0]?.name === '') {
    return <DashboardLoading />;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Plus size={250} />
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
              {editId ? 'Edit Product' : 'Register New Products'}
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {editId ? 'Modify product catalog details.' : 'Add items to the catalogue in a fast batch accordion queue.'}
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
      
      {success && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-sm font-semibold animate-slide-down flex items-center gap-2.5">
          <CheckCircle size={16} className="text-success" />
          <span>{success}</span>
        </div>
      )}

      {/* Accordion Queue List */}
      <form onSubmit={handleBatchSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const hasInbound = item.includeInbound && item.inbounds.some(inb => {
              const qty = item.productType === 'NORMAL' 
                ? parseInt(inb.initialQty, 10) 
                : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length;
              return qty > 0;
            });
            
            const totalQty = item.includeInbound ? item.inbounds.reduce((acc, inb) => {
              const qty = item.productType === 'NORMAL' 
                ? (parseInt(inb.initialQty, 10) || 0) 
                : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length;
              return acc + qty;
            }, 0) : 0;

            const brandObj = brands.find(b => b.id === item.brandId);

            return (
              <div 
                key={item.id} 
                className={`bg-surface border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden
                  ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
                `}
              >
                {/* 1. COLLAPSED VIEW CARD */}
                {!item.isExpanded && (
                  <div 
                    onClick={() => handleExpandItem(idx)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.imagePreview || item.imageUrl ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                          <img src={item.imagePreview || item.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                          <Camera size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-primary truncate">
                            {item.name || <span className="text-text-muted italic">Unnamed Product Entry</span>}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-text-secondary uppercase">
                            {item.productType}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          Brand: <strong>{brandObj?.name || 'Unknown'}</strong> | Code: <strong>{item.itemCode || '---'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Total Inbound Stock</span>
                        <span className={`text-xs font-bold ${hasInbound ? 'text-primary' : 'text-text-muted'}`}>
                          {totalQty} items ({item.inbounds.length} Shipments)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleExpandItem(idx)}
                          className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          title="Expand Form"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!editId && items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                            title="Remove Item"
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
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Item Details Entry #{idx + 1}</span>
                      {!editId && items.length > 1 && (
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

                    {/* Section 1: Classification & Brand */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60">1. Classification</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Product Type</label>
                          <CustomSelect
                            options={[
                              { value: 'NORMAL', label: 'Bulk Product (Stands, Shirts, etc.)' },
                              { value: 'SIM', label: 'SIM Card (Serialized Barcode)' },
                              { value: 'ROUTER', label: 'Router Device (Serialized Barcode)' },
                            ]}
                            value={item.productType}
                            onChange={(val) => updateItemField(idx, 'productType', val)}
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Associated Brand</label>
                          <CustomSelect
                            options={brands.map(b => ({ value: b.id, label: b.name }))}
                            value={item.brandId}
                            onChange={(val) => updateItemField(idx, 'brandId', val)}
                            placeholder="-- Select Brand --"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Metadata */}
                    <div className="flex flex-col gap-4">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60">2. Metadata</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {item.productType === 'SIM' && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2 bg-primary/5 p-4 rounded-xl border border-primary/10 animate-slide-down">
                            <div className="flex flex-col gap-1.5 sm:col-span-3">
                              <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  className="custom-checkbox"
                                  checked={item.autoGenName}
                                  onChange={(e) => {
                                    updateItemField(idx, 'autoGenName', e.target.checked);
                                  }}
                                />
                                <span className="text-primary font-bold">Auto-Generate SIM Card Display Name</span>
                              </label>
                              <span className="text-[10px] text-text-secondary">Generates name layout: [Brand Name] [Store Code] [Store Name]</span>
                            </div>

                            {item.autoGenName && (
                              <>
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                  <label className="text-xs font-semibold text-text-secondary">Target Store</label>
                                  <CustomSelect
                                    options={stores.map(s => ({ value: s.id, label: s.name }))}
                                    value={item.simStoreId}
                                    onChange={(val) => updateItemField(idx, 'simStoreId', val)}
                                    placeholder="-- Select Store --"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-xs font-semibold text-text-secondary">Store Code</label>
                                  <input
                                    type="text"
                                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                    value={item.simStoreCode}
                                    onChange={(e) => updateItemField(idx, 'simStoreCode', e.target.value)}
                                    placeholder="e.g. 4001"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">
                            Display Name {item.productType === 'SIM' && item.autoGenName && <span className="text-[10px] text-primary italic">(Auto-Generated)</span>}
                          </label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-elevated/40"
                            value={item.name}
                            onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                            onBlur={(e) => {
                              if (item.category?.toUpperCase() === 'UNIFORM' && item.size && item.name) {
                                const baseName = item.name.replace(/\s*\((XS|S|M|L|XL|XXL|XXXL)\)\s*$/i, '').trim();
                                const newName = `${baseName} (${item.size})`;
                                if (item.name !== newName) updateItemField(idx, 'name', newName);
                              }
                            }}
                            disabled={item.productType === 'SIM' && item.autoGenName}
                            placeholder={item.productType === 'SIM' && item.autoGenName ? "Complete store fields above to generate name..." : "e.g. Promo Counter"}
                            required
                          />
                          {(() => {
                            const brandObj = brands.find(b => b.id === item.brandId);
                            const bName = brandObj?.name || '';
                            let previewName = item.name.trim();
                            if (bName && previewName) {
                              const lowerName = previewName.toLowerCase();
                              const lowerBrand = bName.toLowerCase();
                              if (!lowerName.startsWith(lowerBrand)) {
                                previewName = `${bName} - ${previewName}`;
                              }
                            }
                            return previewName ? (
                              <p className="text-[11px] text-text-muted mt-1 font-semibold flex items-center gap-1 bg-surface-elevated/45 px-2 py-1 rounded border border-border/40 w-fit">
                                📝 Preview Registered Name: <strong className="text-primary">{previewName}</strong>
                              </p>
                            ) : null;
                          })()}
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">SKU / Item Code</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            value={item.itemCode}
                            onChange={(e) => updateItemField(idx, 'itemCode', e.target.value)}
                            placeholder="Auto-generated if empty (e.g. SAD-UNI-0001)"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-xs font-semibold text-text-secondary">Category Group</label>
                          <div className="relative">
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:bg-surface-elevated/40"
                              value={item.category}
                              onChange={(e) => {
                                updateItemField(idx, 'category', e.target.value);
                                setActiveCategorySuggestionsTarget(idx);
                              }}
                              onFocus={() => setActiveCategorySuggestionsTarget(idx)}
                              onBlur={() => setTimeout(() => setActiveCategorySuggestionsTarget(null), 250)}
                              disabled={item.productType !== 'NORMAL' || item.category?.toUpperCase() === 'UNIFORM'}
                              placeholder="e.g. Stands"
                            />
                            {activeCategorySuggestionsTarget === idx && getFilteredCategories(item.category).length > 0 && (
                              <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                                {getFilteredCategories(item.category).map((cat, catIdx) => (
                                  <button
                                    key={catIdx}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium font-semibold"
                                    onClick={() => {
                                      updateItemField(idx, 'category', cat);
                                      setActiveCategorySuggestionsTarget(null);
                                    }}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Warehouse Stock Cap (Threshold)</label>
                          <input
                            type="number"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.stockCap}
                            onChange={(e) => updateItemField(idx, 'stockCap', e.target.value)}
                            placeholder="e.g. 50 (Optional)"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Warehouse Rack (Optional)</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.rack || ''}
                            onChange={(e) => updateItemField(idx, 'rack', e.target.value)}
                            placeholder="e.g. Rack A"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Warehouse Shelf (Optional)</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.shelf || ''}
                            onChange={(e) => updateItemField(idx, 'shelf', e.target.value)}
                            placeholder="e.g. Shelf 3"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5 sm:col-span-2 mt-4">
                          <label className="text-xs font-semibold text-text-secondary">Returnable / Disposable Status</label>
                          <div className="flex items-center gap-6 mt-1 flex-wrap">
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`status-${idx}`}
                                className="custom-radio"
                                checked={!item.isReturnable && !item.isDisposable && item.category?.toUpperCase() !== 'UNIFORM'}
                                onChange={() => {
                                  updateItemField(idx, 'isReturnable', false);
                                  updateItemField(idx, 'isDisposable', false);
                                  if (item.category?.toUpperCase() === 'UNIFORM') {
                                    updateItemField(idx, 'category', 'Stands');
                                  }
                                }}
                              />
                              <span>Standard (Neither)</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`status-${idx}`}
                                className="custom-radio"
                                checked={item.isReturnable && item.category?.toUpperCase() !== 'UNIFORM'}
                                onChange={() => {
                                  updateItemField(idx, 'isReturnable', true);
                                  updateItemField(idx, 'isDisposable', false);
                                  if (item.category?.toUpperCase() === 'UNIFORM') {
                                    updateItemField(idx, 'category', 'Stands');
                                  }
                                }}
                              />
                              <span>Returnable</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`status-${idx}`}
                                className="custom-radio"
                                checked={item.isDisposable && item.category?.toUpperCase() !== 'UNIFORM'}
                                onChange={() => {
                                  updateItemField(idx, 'isReturnable', false);
                                  updateItemField(idx, 'isDisposable', true);
                                  if (item.category?.toUpperCase() === 'UNIFORM') {
                                    updateItemField(idx, 'category', 'Stands');
                                  }
                                }}
                              />
                              <span>Disposable (Single Use)</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                              <input 
                                type="radio" 
                                name={`status-${idx}`}
                                className="custom-radio"
                                checked={item.category?.toUpperCase() === 'UNIFORM'}
                                onChange={() => {
                                  updateItemField(idx, 'isReturnable', true);
                                  updateItemField(idx, 'isDisposable', false);
                                  updateItemField(idx, 'category', 'UNIFORM');
                                }}
                              />
                              <span>Uniform (Always Returnable)</span>
                            </label>
                          </div>

                          {/* Uniform Size Selector */}
                          {item.category?.toUpperCase() === 'UNIFORM' && (
                            <div className="flex flex-col gap-1.5 mt-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                              <label className="text-xs font-semibold text-text-secondary">Uniform Size *</label>
                              <select
                                value={item.size || ''}
                                onChange={(e) => {
                                  const newSize = e.target.value;
                                  updateItemField(idx, 'size', newSize);
                                  // Auto-update product name
                                  if (item.name) {
                                    const baseName = item.name.replace(/\s*\((XS|S|M|L|XL|XXL|XXXL)\)\s*$/i, '').trim();
                                    const newName = newSize ? `${baseName} (${newSize})` : baseName;
                                    updateItemField(idx, 'name', newName);
                                  }
                                }}
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                                required={item.category?.toUpperCase() === 'UNIFORM'}
                              >
                                <option value="">Select Size</option>
                                <option value="XS">X-Small (XS)</option>
                                <option value="S">Small (S)</option>
                                <option value="M">Medium (M)</option>
                                <option value="L">Large (L)</option>
                                <option value="XL">X-Large (XL)</option>
                                <option value="XXL">XX-Large (XXL)</option>
                                <option value="XXXL">XXX-Large (XXXL)</option>
                              </select>
                              <span className="text-[10px] text-accent mt-0.5">Size will be automatically added to product name</span>
                            </div>
                          )}
                        </div>

                        {/* Image Upload */}
                        <div className="flex flex-col gap-1.5 sm:col-span-2 mt-1">
                          <label className="text-xs font-semibold text-text-secondary">Product Image</label>
                          <div className="flex items-center gap-4 border border-border border-dashed p-4 rounded-xl bg-surface-elevated/20">
                            {item.imagePreview || item.imageUrl ? (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                                <img 
                                  src={item.imagePreview || item.imageUrl} 
                                  alt="Preview" 
                                  className="w-full h-full object-contain cursor-zoom-in hover:brightness-95 transition-all duration-200" 
                                  onClick={() => setLightboxImage({ url: item.imagePreview || item.imageUrl, name: item.name || 'Cropped Preview' })}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateItemField(idx, 'imageFile', null);
                                    updateItemField(idx, 'imagePreview', '');
                                    updateItemField(idx, 'imageUrl', '');
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
                              <span className="text-xs text-text-secondary">Upload product picture for catalogs</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setOriginalFile(file);
                                    setCropSrc(URL.createObjectURL(file));
                                    setCroppingIdx(idx);
                                    setCropZoom(1);
                                    setCropX(0);
                                    setCropY(0);
                                  }
                                }}
                                className="hidden"
                                id={`image-file-${item.id}`}
                              />
                              <label
                                htmlFor={`image-file-${item.id}`}
                                className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-1.5 w-fit"
                              >
                                <span>Browse Picture</span>
                              </label>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section 3 Toggle Selection (Inbound stock option) */}
                    {!editId && (
                      <div className="flex flex-col gap-4">
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60">3. Initial Stock Configuration</h4>
                        <div className="flex items-center gap-6 pb-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                            <input
                              type="radio"
                              name={`includeInbound-${item.id}`}
                              checked={!item.includeInbound}
                              onChange={() => updateItemField(idx, 'includeInbound', false)}
                              className="accent-primary"
                            />
                            <span>Register Catalog details only (No initial stock)</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                            <input
                              type="radio"
                              name={`includeInbound-${item.id}`}
                              checked={item.includeInbound}
                              onChange={() => updateItemField(idx, 'includeInbound', true)}
                              className="accent-primary"
                            />
                            <span className="text-primary font-bold">Log Initial Inbound Stock</span>
                          </label>
                        </div>

                        {item.includeInbound && (
                          <div className="flex flex-col gap-4 mt-4 bg-surface-elevated/10 p-4 rounded-xl border border-border animate-slide-down">
                            {item.inbounds.map((inb, subIdx) => {
                              const parsedQty = item.productType === 'NORMAL' 
                                ? (parseInt(inb.initialQty, 10) || 0) 
                                : inb.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean).length;

                              return (
                                <div key={inb.id} className="flex flex-col gap-4 border-b border-border/60 last:border-0 pb-4 last:pb-0">
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-xs font-extrabold text-text-primary">Inbound Shipment #{subIdx + 1}</span>
                                    {item.inbounds.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveInboundEntry(idx, subIdx)}
                                        className="text-[11px] font-bold text-danger hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                      >
                                        <Trash2 size={11} /> Remove Shipment
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5 relative">
                                      <label className="text-xs font-bold text-text-secondary">Inbound Supplier / Source</label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                          value={inb.fromId}
                                          onChange={(e) => {
                                            updateInboundField(idx, subIdx, 'fromId', e.target.value);
                                            setActiveSupplierSuggestionsTarget({ itemIdx: idx, inboundIdx: subIdx });
                                          }}
                                          onFocus={() => setActiveSupplierSuggestionsTarget({ itemIdx: idx, inboundIdx: subIdx })}
                                          onBlur={() => setTimeout(() => setActiveSupplierSuggestionsTarget(null), 250)}
                                          placeholder="Supplier Name"
                                          required
                                        />
                                        {activeSupplierSuggestionsTarget?.itemIdx === idx && activeSupplierSuggestionsTarget?.inboundIdx === subIdx && getFilteredSuppliers(inb.fromId).length > 0 && (
                                          <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                                            {getFilteredSuppliers(inb.fromId).map((sup, sIdx) => (
                                              <button
                                                key={sIdx}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium font-semibold"
                                                onClick={() => {
                                                  updateInboundField(idx, subIdx, 'fromId', sup);
                                                  setActiveSupplierSuggestionsTarget(null);
                                                }}
                                              >
                                                {sup}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5 relative">
                                      <label className="text-xs font-bold text-text-secondary">Received By (Staff)</label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                          value={inb.receivedBy}
                                          onChange={(e) => {
                                            updateInboundField(idx, subIdx, 'receivedBy', e.target.value);
                                            setActiveReceiverSuggestionsTarget({ itemIdx: idx, inboundIdx: subIdx });
                                          }}
                                          onFocus={() => setActiveReceiverSuggestionsTarget({ itemIdx: idx, inboundIdx: subIdx })}
                                          onBlur={() => setTimeout(() => setActiveReceiverSuggestionsTarget(null), 250)}
                                          placeholder="e.g. John Doe"
                                        />
                                        {activeReceiverSuggestionsTarget?.itemIdx === idx && activeReceiverSuggestionsTarget?.inboundIdx === subIdx && getFilteredReceivers(inb.receivedBy).length > 0 && (
                                          <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                                            {getFilteredReceivers(inb.receivedBy).map((name, nameIdx) => (
                                              <button
                                                key={nameIdx}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary transition-colors border-b border-border last:border-0 font-medium font-semibold"
                                                onClick={() => {
                                                  updateInboundField(idx, subIdx, 'receivedBy', name);
                                                  setActiveReceiverSuggestionsTarget(null);
                                                }}
                                              >
                                                {name}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {item.productType === 'NORMAL' ? (
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-text-secondary">Initial Quantity</label>
                                        <input
                                          type="number"
                                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                          value={inb.initialQty}
                                          onChange={(e) => updateInboundField(idx, subIdx, 'initialQty', e.target.value)}
                                          placeholder="e.g. 50"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                                        <div className="flex items-center justify-between pb-1">
                                          <label className="text-xs font-bold text-text-secondary flex items-center gap-1">
                                            <QrCode size={13} className="text-primary" />
                                            <span>Scan/Enter Serial Numbers (Barcodes)</span>
                                          </label>
                                          <div className="flex items-center gap-2">
                                            {item.productType === 'SIM' && (
                                              <button
                                                type="button"
                                                onClick={() => updateInboundField(idx, subIdx, 'rangeMode', !inb.rangeMode)}
                                                className="text-[10px] text-primary font-bold hover:underline"
                                              >
                                                {inb.rangeMode ? "Switch to Manual Scan List" : "Switch to Serial Range Builder"}
                                              </button>
                                            )}
                                            {!inb.rangeMode && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'list' });
                                                    handleOpenMobileScanner();
                                                  }}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated text-text-primary rounded text-[10px] font-bold cursor-pointer transition-all"
                                                >
                                                  <Smartphone size={11} /> <span>Companion Sync</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'list' });
                                                    setIsCameraOpen(true);
                                                  }}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded text-[10px] font-bold cursor-pointer transition-all"
                                                >
                                                  <Camera size={11} /> <span>Webcam Scan</span>
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {inb.rangeMode && item.productType === 'SIM' ? (
                                          /* RANGE BUILDER CONTAINER */
                                          <div className="p-4 bg-surface-elevated/20 border border-border border-dashed rounded-xl flex flex-col gap-3.5 animate-slide-down">
                                            <div className="flex items-center gap-2 text-text-secondary text-[11px] font-medium leading-relaxed">
                                              <span>Enter starting and ending package serial numbers to auto-generate the list.</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                              <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                  <label className="text-xs font-semibold text-text-secondary">Range Start Barcode</label>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'rangeStart' });
                                                        handleOpenMobileScanner();
                                                      }}
                                                      className="text-[10px] text-text-secondary hover:text-text-primary font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                                                      title="Sync via companion scanner"
                                                    >
                                                      <Smartphone size={10} /> <span>Sync</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'rangeStart' });
                                                        setIsCameraOpen(true);
                                                      }}
                                                      className="text-[10px] text-primary hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                                    >
                                                      <Camera size={10} /> <span>Scan</span>
                                                    </button>
                                                  </div>
                                                </div>
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                                                  placeholder="e.g. SIM001"
                                                  value={inb.rangeStart}
                                                  onChange={(e) => updateInboundField(idx, subIdx, 'rangeStart', e.target.value)}
                                                />
                                              </div>
                                              <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                  <label className="text-xs font-semibold text-text-secondary">Range End Barcode</label>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'rangeEnd' });
                                                        handleOpenMobileScanner();
                                                      }}
                                                      className="text-[10px] text-text-secondary hover:text-text-primary font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                                                      title="Sync via companion scanner"
                                                    >
                                                      <Smartphone size={10} /> <span>Sync</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx, field: 'rangeEnd' });
                                                        setIsCameraOpen(true);
                                                      }}
                                                      className="text-[10px] text-primary hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                                    >
                                                      <Camera size={10} /> <span>Scan</span>
                                                    </button>
                                                  </div>
                                                </div>
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                                                  placeholder="e.g. SIM100"
                                                  value={inb.rangeEnd}
                                                  onChange={(e) => updateInboundField(idx, subIdx, 'rangeEnd', e.target.value)}
                                                />
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleApplyRange(idx, subIdx)}
                                              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer w-fit"
                                            >
                                              Apply Range
                                            </button>
                                          </div>
                                        ) : (
                                          /* STANDARD MANUAL SCAN INPUT */
                                          <>
                                            <textarea
                                              rows={4}
                                              className="w-full bg-surface text-text-primary font-mono placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none resize-none leading-relaxed"
                                              placeholder="Scan barcodes or type them (one per line)..."
                                              value={inb.initialBarcodes}
                                              onChange={(e) => updateInboundField(idx, subIdx, 'initialBarcodes', e.target.value)}
                                            />
                                            <div className="text-[10px] text-text-secondary mt-0.5">
                                              Barcodes parsed: <strong className="text-primary">{parsedQty}</strong>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}


                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                      <label className="text-xs font-bold text-text-secondary">Inbound Notes / Remarks</label>
                                      <input
                                        type="text"
                                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                        value={inb.notes}
                                        onChange={(e) => updateInboundField(idx, subIdx, 'notes', e.target.value)}
                                        placeholder="e.g. Initial stock import"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => handleAddInboundEntry(idx)}
                              className="w-fit mt-2 px-4 py-2 border-2 border-dashed border-border hover:border-primary/50 text-text-secondary hover:text-primary rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all bg-surface hover:bg-surface-elevated duration-200 cursor-pointer"
                            >
                              <Plus size={14} />
                              <span>Add Another Inbound Stock Shipment</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border mt-3">
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

        {/* Add item trigger */}
        {!editId && (
          <button
            type="button"
            onClick={handleAddNewItem}
            className="w-full py-4 border-2 border-dashed border-border hover:border-primary/50 text-text-secondary hover:text-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all bg-surface/50 hover:bg-surface duration-200 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Another Product Catalog Entry</span>
          </button>
        )}

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-border">
          <Link href="/dashboard/products" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200">
            Cancel
          </Link>
          <button 
            type="submit" 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
            disabled={loading}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{editId ? 'Save Changes' : 'Confirm Registration'}</span>
          </button>
        </div>
      </form>

      {/* Webcam scan overlay modal */}
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

      {/* Wireless companion scanner modal */}
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
              <div className="p-3 bg-white border border-border rounded-lg shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(getClientScanCompanionUrl(mobileSession.sessionId, mobileSession.localIp, mobileSession.port))}`}
                  alt="Scan QR to pair phone"
                  className="w-[200px] h-[200px] block"
                />
              </div>
              <div className="flex flex-col gap-1.5 max-w-sm">
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mx-auto font-mono">
                  Pairing Code: {mobileSession.sessionId}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed px-4 mt-2">
                  1. Scan this QR code with your phone's camera.<br />
                  2. Keep both phone and PC on the same Wi-Fi.<br />
                  3. Scan barcodes with your phone to sync instantly!
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 py-1.5 px-4 bg-surface-elevated rounded-lg border border-border">
                <Loader2 size={14} className="animate-spin text-primary" />
                <span className="text-[11px] font-bold text-text-secondary uppercase">Waiting for mobile scans...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Image Cropping Modal */}
      {croppingIdx !== null && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-extrabold text-sm text-text-primary uppercase tracking-wider">Crop Product Image</h3>
              <button
                type="button"
                onClick={() => {
                  setCroppingIdx(null);
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
                  setCroppingIdx(null);
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

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-pointer select-none"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X size={20} />
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[80vh] flex flex-col items-center gap-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-white/15 animate-scale-up"
            />
            <span className="text-white text-sm font-semibold tracking-wide text-center">
              {lightboxImage.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
