'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, Save, Users, Building2, Calendar, FileText, CheckCircle, AlertCircle, Camera, QrCode, X, Smartphone, Edit2, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBulkProducts } from '@/app/actions/products';
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

export default function NewProductClient({ brands, editId = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Active target slot for webcam/companion barcode scans: { itemIdx, inboundIdx }
  const [activeScanTarget, setActiveScanTarget] = useState(null);

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

  // Helper to construct empty inbound entry details
  const createEmptyInboundEntry = (index = 0) => ({
    id: `inb-${Date.now()}-${index}`,
    fromId: 'Initial Import',
    receivedBy: '',
    initialQty: '',
    initialBarcodes: '',
    deliveryNote: '',
    notes: '',
  });

  // Helper to construct a blank product item configuration for bulk creation
  const createEmptyProductItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    brandId: searchParams.get('brandId') || brands[0]?.id || '',
    itemCode: '',
    category: 'Stands',
    productType: 'NORMAL', // 'NORMAL', 'SIM', 'ROUTER'
    stockCap: '',
    isReturnable: false,
    isPublic: true,
    includeInbound: false, // Default is false (catalog details only)
    inbounds: [createEmptyInboundEntry(0)], // List of inbound shipments
    imageFile: null,
    imagePreview: '',
    imageUrl: '',
    isExpanded: true,
    error: '',
  });

  // State array for products queue
  const [items, setItems] = useState([createEmptyProductItem(0)]);

  // Edit Mode state (if editId is set, we only handle one single product item)
  useEffect(() => {
    if (editId) {
      const loadProduct = async () => {
        setLoading(true);
        try {
          const { getProductById } = await import('@/app/actions/products');
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
              isPublic: product.isPublic,
              includeInbound: false,
              inbounds: [createEmptyInboundEntry(0)],
              imageFile: null,
              imagePreview: '',
              imageUrl: product.imageUrl || '',
              isExpanded: true,
              error: '',
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
  }, [editId]);

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
      const { itemIdx, inboundIdx } = activeScanTarget;

      const targetItem = prev[itemIdx];
      if (!targetItem) return prev;

      const targetInbound = targetItem.inbounds[inboundIdx];
      if (!targetInbound) return prev;

      const currentList = targetInbound.initialBarcodes.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      if (!currentList.includes(cleanCode)) {
        const newList = [...currentList, cleanCode];
        added = true;

        return prev.map((item, i) => {
          if (i !== itemIdx) return item;
          const updatedInbounds = item.inbounds.map((inb, j) => {
            if (j !== inboundIdx) return inb;
            return {
              ...inb,
              initialBarcodes: newList.join('\n')
            };
          });
          return { ...item, inbounds: updatedInbounds };
        });
      }
      return prev;
    });
    return added;
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
        html5QrcodeScanner.clear().catch(e => console.error(e));
      }
    };
  }, [isCameraOpen, cameraPermissionStatus]);

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
        formData.append('isSerialized', item.productType !== 'NORMAL' ? 'true' : 'false');
        formData.append('stockCap', item.stockCap || '');
        formData.append('isReturnable', item.isReturnable ? 'true' : 'false');
        formData.append('isPublic', item.isPublic ? 'true' : 'false');
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
          formData.append(`item_${idx}_productType`, item.productType);
          formData.append(`item_${idx}_stockCap`, item.stockCap || '');
          formData.append(`item_${idx}_isReturnable`, item.isReturnable ? 'true' : 'false');
          formData.append(`item_${idx}_isPublic`, item.isPublic ? 'true' : 'false');

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

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <header className="flex items-center gap-4 pb-5 border-b border-border">
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
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Initial Stock</span>
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
                          <label className="text-xs font-semibold text-text-secondary">Tracking Type</label>
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
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">Display Name</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            value={item.name}
                            onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                            placeholder="e.g. Sadia Promo Counter"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">SKU / Item Code</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            value={item.itemCode}
                            onChange={(e) => updateItemField(idx, 'itemCode', e.target.value)}
                            placeholder="e.g. SKU-12345 (Optional)"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Category Group</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:bg-surface-elevated/40"
                            value={item.category}
                            onChange={(e) => updateItemField(idx, 'category', e.target.value)}
                            disabled={item.productType !== 'NORMAL'}
                            placeholder="e.g. Stands"
                          />
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

                        <div className="flex items-center gap-6 mt-4">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              className="custom-checkbox"
                              checked={item.isReturnable}
                              onChange={(e) => updateItemField(idx, 'isReturnable', e.target.checked)}
                            />
                            <span>Returnable Item</span>
                          </label>
                        </div>

                        {/* Image Upload */}
                        <div className="flex flex-col gap-1.5 sm:col-span-2 mt-1">
                          <label className="text-xs font-semibold text-text-secondary">Product Image</label>
                          <div className="flex items-center gap-4 border border-border border-dashed p-4 rounded-xl bg-surface-elevated/20">
                            {item.imagePreview || item.imageUrl ? (
                              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                                <img src={item.imagePreview || item.imageUrl} alt="Preview" className="w-full h-full object-contain" />
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
                                    updateItemField(idx, 'imageFile', file);
                                    updateItemField(idx, 'imagePreview', URL.createObjectURL(file));
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
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-xs font-bold text-text-secondary">Inbound Supplier / Source</label>
                                      <input
                                        type="text"
                                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                        value={inb.fromId}
                                        onChange={(e) => updateInboundField(idx, subIdx, 'fromId', e.target.value)}
                                        placeholder="Supplier Name"
                                        required
                                      />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-xs font-bold text-text-secondary">Received By (Staff)</label>
                                      <input
                                        type="text"
                                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                        value={inb.receivedBy}
                                        onChange={(e) => updateInboundField(idx, subIdx, 'receivedBy', e.target.value)}
                                        placeholder="e.g. John Doe"
                                      />
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
                                          <label className="text-xs font-bold text-text-secondary">Scan/Enter Serial Numbers (Barcodes)</label>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx });
                                                handleOpenMobileScanner();
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated text-text-primary rounded text-[10px] font-bold cursor-pointer transition-all"
                                            >
                                              <Smartphone size={11} /> <span>Companion Sync</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveScanTarget({ itemIdx: idx, inboundIdx: subIdx });
                                                setIsCameraOpen(true);
                                              }}
                                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded text-[10px] font-bold cursor-pointer transition-all"
                                            >
                                              <Camera size={11} /> <span>Webcam Scan</span>
                                            </button>
                                          </div>
                                        </div>
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
