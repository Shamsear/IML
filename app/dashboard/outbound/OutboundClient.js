'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, ArrowUpRight, AlertCircle, QrCode, Camera, X, Smartphone, CheckCircle, Edit2, UserCheck, Tag, Copy, Shirt, Info } from 'lucide-react';
import Link from 'next/link';
import { createBulkIssueTransactions, updateBulkIssueTransactions } from '@/app/actions/transactions';
import { createStore } from '@/app/actions/stores';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';
import { getAvailableBarcodes, findProductByBarcode, getProductBatchesAtLocation } from '@/app/actions/products';
import { playBeep } from '@/lib/audio';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

function OutboundFormContent({ products, stores, supervisors, directSellers = [], initialItems = null, initialDestinationType = 'STORE', initialDestinationId = '', brands = [], initialDeliverySupervisorId = '', editMode = false, existingDn = '', staffList = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }
  const [transactionDate, setTransactionDate] = useState(() => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  // Destination (To) states - Default to STORE unless specified
  const [toType, setToType] = useState(initialDestinationType);
  const [toId, setToId] = useState(initialDestinationId || '');

  // Delivery supervisor (who carried goods to the store)
  const [deliverySupervisorId, setDeliverySupervisorId] = useState(initialDeliverySupervisorId || '');
  const [supervisorList, setSupervisorList] = useState(supervisors);

  // Inline store creation
  const [showNewStoreForm, setShowNewStoreForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreRegion, setNewStoreRegion] = useState('DXB');
  const [newStoreLocation, setNewStoreLocation] = useState('');
  const [storeList, setStoreList] = useState(stores);
  const [creatingStore, setCreatingStore] = useState(false);

  // Global brand filter — sets all items at once; per-item pills override individually
  const [globalBrand, setGlobalBrand] = useState('ALL');

  const handleGlobalBrandChange = (brandId) => {
    setGlobalBrand(brandId);
    const firstMatchedProduct = brandId === 'ALL' 
      ? null 
      : products.find(p => p.brand?.id === brandId);

    setItems(prev => prev.map(item => {
      const updated = { ...item, brandFilter: brandId };
      if (brandId !== 'ALL' && firstMatchedProduct) {
        updated.productId = firstMatchedProduct.id;
        updated.quantity = firstMatchedProduct.isSerialized ? 0 : 1;
        // Reset promoter assignment type if needed
        const isUniform = firstMatchedProduct.category?.toUpperCase() === 'UNIFORM';
        if (isUniform && !updated.promoterAssignment) {
          updated.promoterAssignment = {
            isNewPromoter: true,
            promoterName: '',
            promoterPhone: '',
            existingStaffId: '',
          };
        } else if (!isUniform) {
          updated.promoterAssignment = null;
        }
      }
      return updated;
    }));
  };

  // Default toType initial destination selection
  useEffect(() => {
    if (initialDestinationId && toType === initialDestinationType) {
      setToId(initialDestinationId);
    } else {
      if (toType === 'STORE') {
        setToId(stores[0]?.id || '');
      } else if (toType === 'DIRECT') {
        setToId(directSellers[0] || '');
      } else {
        setToId('');
      }
    }
  }, [toType, stores, supervisors, directSellers, initialDestinationId, initialDestinationType]);

  // Global Scan Input State (for fast scanning)
  const [globalScanInput, setGlobalScanInput] = useState('');
  const [isGlobalScanExpanded, setIsGlobalScanExpanded] = useState(true);

  // Webcam scanning modal state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [sessionScans, setSessionScans] = useState([]);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);
  const [showDirectSellerSuggestions, setShowDirectSellerSuggestions] = useState(false);
  const [highlightedSellerIdx, setHighlightedSellerIdx] = useState(-1);
  const [globalNotes, setGlobalNotes] = useState('');

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
  const createEmptyOutboundItem = (index = 0) => {
    const activeFilter = globalBrand || 'ALL';

    return {
      id: `temp-${Date.now()}-${index}`,
      productId: '',
      quantity: 1,
      selectedBarcodes: [],
      availableBarcodes: [],
      notes: '',
      rangeStart: '',
      rangeEnd: '',
      rangeMode: false,
      isExpanded: true,
      error: '',
      brandFilter: activeFilter,
      promoterAssignment: null,
      availableBatches: [],
      selectedBatches: []
    };
  };

  // State array for outbound items queue
  const [items, setItems] = useState(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(item => ({
        ...item,
        selectedBarcodes: item.selectedBarcodes || [],
        availableBarcodes: item.availableBarcodes || [],
        brandFilter: item.productId ? (products.find(p => p.id === item.productId)?.brandId || 'ALL') : 'ALL',
      }));
    }
    return [];
  });

  const initializedRef = useRef(false);

  // Warn before navigating away with unsaved items
  useUnsavedChanges(items.length > 0 && !loading);

  // Initialize selected products from URL search parameter "productIds"
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
    const initRows = async () => {
      let activeItems = [];
      if (urlIds.length > 0) {
        activeItems = urlIds.map((id, idx) => {
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
            availableBatches: [],
            selectedBatches: []
          };
        });
        setItems(activeItems);
      } else if (!initialItems || initialItems.length === 0) {
        activeItems = [createEmptyOutboundItem(0)];
        setItems(activeItems);
      } else {
        activeItems = initialItems.map((item, idx) => {
          const prod = products.find(p => p.id === item.productId);
          return {
            ...item,
            id: item.id || `temp-${Date.now()}-${idx}`,
            isExpanded: idx === 0,
            availableBatches: [],
            selectedBatches: prod?.trackExpiry && !prod?.isSerialized ? [{
              manufactureDate: item.manufactureDate,
              expiryDate: item.expiryDate,
              quantity: item.quantity
            }] : []
          };
        });
        setItems(activeItems);
      }

      // Load available barcodes / batches on mount
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const prod = products.find(p => p.id === item.productId);
        if (prod?.isSerialized) {
          try {
            const available = await getAvailableBarcodes(item.productId, 'WAREHOUSE', null);
            setItems(prev => prev.map((x, idx) => idx === i ? { ...x, availableBarcodes: available || [] } : x));
          } catch (e) {
            console.error(e);
          }
        } else if (prod?.trackExpiry && !prod?.isSerialized) {
          try {
            const batches = await getProductBatchesAtLocation(item.productId, 'WAREHOUSE', null);
            setItems(prev => prev.map((x, idx) => idx === i ? { ...x, availableBatches: batches || [] } : x));
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    initRows();
  }, [searchParams, products, initialItems]);

  // Prefill globalNotes from initialItems on edit or copy
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      if (initialItems[0].notes) {
        if (initialItems[0].notes.includes(' | ')) {
          setGlobalNotes(initialItems[0].notes.split(' | ')[0]);
        } else {
          setGlobalNotes(initialItems[0].notes);
        }
      }
      if (initialItems[0].timestamp) {
        const d = new Date(initialItems[0].timestamp);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setTransactionDate(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
    }
  }, [initialItems]);

  // Helper to update specific fields on item
  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  const updatePromoterAssignmentField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updatedAssignment = {
        ...item.promoterAssignment,
        [field]: value
      };
      // If we are updating allocatedItems, recalculate total quantity
      let nextQuantity = item.quantity;
      if (field === 'allocatedItems') {
        nextQuantity = value.reduce((sum, u) => sum + (parseInt(u.qty, 10) || 0), 0);
      }
      return {
        ...item,
        promoterAssignment: updatedAssignment,
        quantity: nextQuantity
      };
    }));
  };

  // Helper to handle product selection and load available barcodes
  const handleProductChange = async (idx, val) => {
    const prod = products.find(p => p.id === val);
    const isUniform = prod?.category?.toUpperCase() === 'UNIFORM';
    
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
        promoterAssignment: isUniform ? {
          isNewPromoter: true,
          promoterName: '',
          promoterPhone: '',
          existingStaffId: '',
        } : null,
        availableBatches: [],
        selectedBatches: []
      };
    }));

    if (prod?.isSerialized) {
      try {
        const available = await getAvailableBarcodes(val, 'WAREHOUSE', null);
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, availableBarcodes: available || [] } : item));
      } catch (e) {
        console.error(e);
      }
    } else if (prod?.trackExpiry) {
      try {
        const batches = await getProductBatchesAtLocation(val, 'WAREHOUSE', null);
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, availableBatches: batches || [], selectedBatches: [] } : item));
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
      setSessionScans([]);
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
                setSessionScans(prev => {
                  if (!prev.includes(code)) return [...prev, code];
                  return prev;
                });
              } else {
                const added = addBarcodeToActiveItem(code);
                if (added) {
                  playBeep();
                  setSessionScans(prev => {
                    if (!prev.includes(code)) return [...prev, code];
                    return prev;
                  });
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
    if (mobileSession?.sessionId && isCompanionActive) {
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
  }, [isCompanionActive, mobileSession, items]);

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
    if (!prod?.isSerialized) {
      const qty = parseInt(item.quantity, 10);
      const originalItem = (initialItems && editMode) ? initialItems.find(x => x.productId === item.productId) : null;
      const originalQty = originalItem ? originalItem.quantity : 0;
      const stock = (prod?.warehouseStock || 0) + originalQty;
      if (qty > stock) {
        updateItemField(idx, 'error', `Insufficient stock for product "${prod.name}". Current stock at WAREHOUSE is ${stock}, requested ${qty}.`);
        return;
      }
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
      if (prod?.trackExpiry && !prod?.isSerialized) {
        const selected = item.selectedBatches || [];
        const totalSelected = selected.reduce((sum, b) => sum + b.quantity, 0);
        if (totalSelected <= 0) {
          updateItemField(i, 'error', `Please specify quantities for at least one batch of ${prod.name}`);
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      } else if (!prod?.isSerialized) {
        if (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10))) {
          updateItemField(i, 'error', 'Quantity must be greater than 0');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        const qty = parseInt(item.quantity, 10);
        const originalItem = (initialItems && editMode) ? initialItems[i] : null;
        const originalQty = originalItem ? originalItem.quantity : 0;
        const stock = (prod?.warehouseStock || 0) + originalQty;
        if (qty > stock) {
          updateItemField(i, 'error', `Insufficient stock for product "${prod.name}". Current stock at WAREHOUSE is ${stock}, requested ${qty}.`);
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      } else if (prod?.isSerialized && item.selectedBarcodes.length === 0) {
        updateItemField(i, 'error', `Please select at least one barcode for ${prod.name}`);
        handleExpandItem(i);
        setLoading(false);
        return;
      }
      if (prod?.category?.toUpperCase() === 'UNIFORM') {
        const pa = item.promoterAssignment;
        if (!pa) {
          updateItemField(i, 'error', 'Promoter assignment details are missing');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (pa.isNewPromoter && !pa.promoterName.trim()) {
          updateItemField(i, 'error', 'Promoter name is required for registration');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (!pa.isNewPromoter && !pa.existingStaffId) {
          updateItemField(i, 'error', 'Please choose an existing promoter');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        // Auto-assign store from target
        pa.storeId = toId;
        if (!pa.storeId || toType !== 'STORE') {
          updateItemField(i, 'error', 'Please select a valid destination Store at the top of the page for this uniform dispatch.');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        // Auto-assign size from product
        pa.promoterShirtSize = prod.size || 'Medium';
      }
    }

    const itemsPayload = [];
    for (const item of items) {
      const prod = products.find(p => p.id === item.productId);
      const isUniform = prod?.category?.toUpperCase() === 'UNIFORM';

      if (prod?.trackExpiry && !prod?.isSerialized) {
        const selected = item.selectedBatches || [];
        selected.forEach(batch => {
          itemsPayload.push({
            productId: item.productId,
            quantity: batch.quantity,
            barcodes: [],
            manufactureDate: batch.manufactureDate,
            expiryDate: batch.expiryDate,
            notes: item.notes,
            ...(isUniform ? { promoterAssignment: item.promoterAssignment } : {})
          });
        });
      } else {
        itemsPayload.push({
          productId: item.productId,
          quantity: prod?.isSerialized ? item.selectedBarcodes.length : parseInt(item.quantity, 10),
          barcodes: prod?.isSerialized ? item.selectedBarcodes : [],
          notes: item.notes,
          ...(isUniform ? { promoterAssignment: item.promoterAssignment } : {})
        });
      }
    }

    const payload = {
      fromEntityType: 'WAREHOUSE',
      fromEntityId: null,
      toEntityType: toType,
      toEntityId: toId,
      deliverySupervisorId: deliverySupervisorId || null,
      globalNotes: globalNotes || '',
      transactionDate: transactionDate || null,
      items: itemsPayload
    };

    try {
      if (editMode && existingDn) {
        await updateBulkIssueTransactions(existingDn, payload);
        setConfirmData({ title: 'Delivery Note Updated', message: `Dispatch note ${existingDn} has been updated successfully.` });
        setConfirmOpen(true);
      } else {
        await createBulkIssueTransactions(payload);
        setConfirmData({ title: 'Stock Dispatched', message: `${items.length} item(s) dispatched successfully from warehouse.` });
        setConfirmOpen(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to complete outbound transaction.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <ArrowUpRight size={180} />
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/outbound" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors">
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
        </div>
        {/* Companion Scanner Status Badge */}
        <div className="flex items-center">
          {isCompanionActive && mobileSession?.sessionId ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
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

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/outbound'); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      {/* Destination Selection Header */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ArrowUpRight size={18} className="text-primary" />
          <span>Dispatch Destination Details</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Destination Category</label>
            <CustomSelect
              options={[
                { value: 'STORE', label: 'Retail Store / Placement' },
                { value: 'DIRECT', label: 'Direct Seller (Custom)' },
              ]}
              value={toType}
              onChange={(val) => setToType(val)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">Assigned Target</label>
              {toType === 'STORE' && (
                <button
                  type="button"
                  onClick={() => { setShowNewStoreForm(!showNewStoreForm); setNewStoreName(''); setNewStoreRegion('DXB'); setNewStoreLocation(''); }}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus size={11} />
                  {showNewStoreForm ? 'Cancel' : 'Create new store'}
                </button>
              )}
            </div>
            {toType === 'STORE' && (
              <>
                <CustomSelect
                  options={storeList.map(s => ({ value: s.id, label: s.name }))}
                  value={toId}
                  onChange={(val) => setToId(val)}
                  placeholder="-- Select Retail Store --"
                  required
                />
                {showNewStoreForm && (
                  <div className="bg-surface-elevated/60 border border-border rounded-lg p-4 flex flex-col gap-3 animate-slide-down">
                    <p className="text-[11px] text-text-muted">Create a new store and it will be auto-selected for this dispatch.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Store Name *</label>
                        <input
                          type="text"
                          value={newStoreName}
                          onChange={e => setNewStoreName(e.target.value)}
                          placeholder="e.g. Carrefour MOE"
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Region</label>
                        <select
                          value={newStoreRegion}
                          onChange={e => setNewStoreRegion(e.target.value)}
                          className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary appearance-none"
                        >
                          {['AUH', 'DXB', 'SHJ', 'ALN', 'RAK', 'FUJ', 'UAQ'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Location</label>
                        <input
                          type="text"
                          value={newStoreLocation}
                          onChange={e => setNewStoreLocation(e.target.value)}
                          placeholder="e.g. Sheikh Zayed Rd"
                          className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={creatingStore || !newStoreName.trim()}
                      onClick={async () => {
                        if (!newStoreName.trim()) return;
                        setCreatingStore(true);
                        try {
                          const fd = new FormData();
                          fd.set('name', newStoreName.trim());
                          fd.set('region', newStoreRegion);
                          fd.set('location', newStoreLocation.trim());
                          fd.set('isPublic', 'true');
                          const created = await createStore(fd);
                          // Refetch store list to get the full object with id
                          const { getStores } = await import('@/app/actions/stores');
                          const updatedStores = await getStores();
                          setStoreList(updatedStores);
                          const newStore = updatedStores.find(s => s.name === newStoreName.trim());
                          if (newStore) setToId(newStore.id);
                          setShowNewStoreForm(false);
                          setNewStoreName(''); setNewStoreRegion('DXB'); setNewStoreLocation('');
                        } catch (err) {
                          setError(err.message || 'Failed to create store');
                        } finally {
                          setCreatingStore(false);
                        }
                      }}
                      className="self-start inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {creatingStore ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      <span>{creatingStore ? 'Creating...' : 'Create & Select Store'}</span>
                    </button>
                  </div>
                )}
              </>
            )}
            {toType === 'DIRECT' && (
              <div className="flex flex-col gap-1.5 relative">
                <div className="relative">
                  <input
                    type="text"
                    value={toId}
                    onChange={(e) => {
                      setToId(e.target.value);
                      setShowDirectSellerSuggestions(true);
                      setHighlightedSellerIdx(0);
                    }}
                    onFocus={() => {
                      setShowDirectSellerSuggestions(true);
                      setHighlightedSellerIdx(0);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowDirectSellerSuggestions(false);
                        setHighlightedSellerIdx(-1);
                      }, 250);
                    }}
                    onKeyDown={(e) => {
                      const filtered = toId ? directSellers.filter(ds => ds.toLowerCase().includes(toId.toLowerCase())) : directSellers;
                      if (filtered.length === 0) return;

                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedSellerIdx(prev => Math.min(prev + 1, filtered.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedSellerIdx(prev => Math.max(prev - 1, 0));
                      } else if (e.key === 'Enter') {
                        if (highlightedSellerIdx >= 0 && highlightedSellerIdx < filtered.length) {
                          e.preventDefault();
                          setToId(filtered[highlightedSellerIdx]);
                          setShowDirectSellerSuggestions(false);
                          setHighlightedSellerIdx(-1);
                        }
                      } else if (e.key === 'Escape') {
                        setShowDirectSellerSuggestions(false);
                        setHighlightedSellerIdx(-1);
                      }
                    }}
                    placeholder="Type or select direct seller name"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                  {showDirectSellerSuggestions && (() => {
                    const filtered = toId ? directSellers.filter(ds => ds.toLowerCase().includes(toId.toLowerCase())) : directSellers;
                    return filtered.length > 0;
                  })() && (
                    <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                      {(() => {
                        return toId ? directSellers.filter(ds => ds.toLowerCase().includes(toId.toLowerCase())) : directSellers;
                      })().map((ds, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-0 font-medium font-semibold ${
                            idx === highlightedSellerIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-elevated text-text-primary'
                          }`}
                          onClick={() => {
                            setToId(ds);
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
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Transaction Date</label>
            <input
              type="datetime-local"
              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-3 mt-2">
            <label className="text-xs font-semibold text-text-secondary">Delivery Note Global Remarks</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              placeholder="Global remark visible at the top of the Delivery Note PDF..."
            />
          </div>
        </div>

        {/* Delivery Supervisor — shown when dispatching to a store */}        {toType === 'STORE' && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <UserCheck size={13} />
                Delivered By (Supervisor) <span className="text-text-muted font-normal">— optional</span>
              </label>
              <Link
                href="/dashboard/supervisors/new"
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={11} />
                Create new supervisor
              </Link>
            </div>

            <CustomSelect
              options={[
                { value: '', label: 'No supervisor (skip)' },
                ...supervisorList.map(s => ({ value: s.id, label: `${s.name}${s.phone ? ' · ' + s.phone : ''}` }))
              ]}
              value={deliverySupervisorId}
              onChange={val => setDeliverySupervisorId(val)}
              placeholder="-- Select delivering supervisor --"
            />
          </div>
        )}
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
                    console.error(e);
                  }
                }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Smartphone size={13} />
                <span>Pair Phone Companion</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Camera size={13} />
                <span>Camera Scan</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Brand Filter */}
      {brands.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-primary" />
            <span className="text-sm font-bold text-text-primary">Global Brand Filter</span>
            <span className="text-xs text-text-muted">— sets all items at once, override per-item below</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleGlobalBrandChange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                globalBrand === 'ALL'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface border-border text-text-secondary hover:border-primary/50'
              }`}
            >
              All Brands
            </button>
            {brands.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleGlobalBrandChange(b.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  globalBrand === b.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          {globalBrand !== 'ALL' && (
            <p className="text-[11px] text-primary font-semibold">
              Showing only <strong>{brands.find(b => b.id === globalBrand)?.name}</strong> products · {products.filter(p => p.brand?.id === globalBrand).length} products available
            </p>
          )}
        </div>
      )}

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
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none/10 transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-3.5">
                      {selectedProd?.imageUrl ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                          <img src={selectedProd.imageUrl} alt="Product" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                          <Camera size={18} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-sm text-text-primary block truncate">
                          {selectedProd ? `${selectedProd.brand.name} - ${selectedProd.name}` : <span className="text-text-muted italic">Select product...</span>}
                        </span>
                        <span className="text-[10px] text-text-secondary block mt-0.5">
                          {selectedProd?.isSerialized ? 'Serialized Tracking' : 'Bulk/Normal Product'}
                          {selectedProd && (
                            <>
                              {' | '}
                              <span className={`font-bold ${selectedProd.isReturnable ? 'text-success' : 'text-text-secondary'}`}>
                                {selectedProd.isReturnable ? 'Returnable' : 'Non-Returnable'}
                              </span>
                              {' | '}
                              <span className={`font-bold ${selectedProd.isDisposable ? 'text-warning' : 'text-text-secondary'}`}>
                                {selectedProd.isDisposable ? 'Disposable' : 'Non-Disposable'}
                              </span>
                            </>
                          )}
                          {item.notes && ` | Remarks: ${item.notes}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Dispatch Qty</span>
                        <span className="text-xs font-extrabold text-primary">{item.quantity} units</span>
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="has-tooltip">
                          <button
                            type="button"
                            onClick={() => handleExpandItem(idx)}
                            className="p-1.5 hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <span className="tooltip-box">Expand dispatch item details</span>
                        </div>
                        {items.length > 1 && (
                          <div className="has-tooltip">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                            <span className="tooltip-box">Remove entry</span>
                          </div>
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
                      {/* Product Selector with per-item brand override */}
                      <div className="sm:col-span-2 flex flex-col gap-2.5">
                        {/* Per-item brand pills */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
                            <Tag size={10} /> Brand:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateItemField(idx, 'brandFilter', 'ALL')}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${item.brandFilter === 'ALL' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                            >All</button>
                            {brands.map(b => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => updateItemField(idx, 'brandFilter', b.id)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${item.brandFilter === b.id ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                              >{b.name}</button>
                            ))}
                          </div>
                        </div>
                        {/* Product selector filtered by this item's brandFilter */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Product to Dispatch</label>
                          <CustomSelect
                            options={products
                              .filter(p => (item.brandFilter || 'ALL') === 'ALL' || p.brand?.id === item.brandFilter)
                              .map(p => ({
                                value: p.id,
                                label: `${p.name} (${p.category})`,
                                imageUrl: p.imageUrl,
                                warehouseStock: p.warehouseStock,
                                disabled: p.isSerialized && items.filter((_, i) => i !== idx).map(it => it.productId).filter(Boolean).includes(p.id)
                              }))}
                            value={item.productId}
                            onChange={(val) => handleProductChange(idx, val)}
                            placeholder={
                              (item.brandFilter || 'ALL') === 'ALL'
                                ? '-- Select Product --'
                                : `-- Select ${brands.find(b => b.id === item.brandFilter)?.name || ''} Product --`
                            }
                            />
                        </div>
                        {selectedProd && (
                          <div className="flex flex-col gap-2.5 mt-1 animate-fade-in">
                            {selectedProd.imageUrl && (
                              <div className="flex items-center gap-3 border border-border p-2 rounded-xl bg-surface-elevated/20 w-fit">
                                <img 
                                  src={selectedProd.imageUrl} 
                                  alt={selectedProd.name} 
                                  className="w-12 h-12 rounded-lg object-contain bg-background border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200"
                                  onClick={() => setLightboxImage({ url: selectedProd.imageUrl, name: selectedProd.name })}
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold text-text-primary truncate max-w-[200px]">{selectedProd.name}</span>
                                  <span className="text-[10px] text-text-secondary mt-0.5 font-mono">SKU: {selectedProd.itemCode || '---'}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-text-secondary uppercase">Product Status:</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedProd.isReturnable ? 'bg-success/10 text-success border-success/20' : 'bg-surface-elevated/40 text-text-secondary border-border'}`}>
                                {selectedProd.isReturnable ? 'Returnable' : 'Non-Returnable'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${selectedProd.isDisposable ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-elevated/40 text-text-secondary border-border'}`}>
                                {selectedProd.isDisposable ? 'Disposable' : 'Non-Disposable'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedProd?.category?.toUpperCase() === 'UNIFORM' ? (
                        /* UNIFORM SIMPLIFIED FLOW */
                        item.promoterAssignment && (
                          <div className="sm:col-span-2 flex flex-col gap-5 mt-4 bg-primary/5 p-5 border border-primary/10 rounded-2xl animate-slide-down">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider pb-1 border-b border-primary/20 flex items-center gap-1.5">
                              <Shirt size={14} />
                              <span>Promoter Assignment</span>
                            </h4>
                            
                            {/* Choose promoter type: New or Existing */}
                            <div className="flex gap-4">
                              <label className="inline-flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer select-none">
                                <input 
                                  type="radio" 
                                  name={`promoter-type-${item.id}`}
                                  checked={item.promoterAssignment.isNewPromoter}
                                  onChange={() => updatePromoterAssignmentField(idx, 'isNewPromoter', true)}
                                  className="accent-primary"
                                />
                                <span>Register a New Promoter</span>
                              </label>
                              <label className="inline-flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer select-none">
                                <input 
                                  type="radio" 
                                  name={`promoter-type-${item.id}`}
                                  checked={!item.promoterAssignment.isNewPromoter}
                                  onChange={() => updatePromoterAssignmentField(idx, 'isNewPromoter', false)}
                                  className="accent-primary"
                                />
                                <span>Choose Existing Promoter</span>
                              </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {item.promoterAssignment.isNewPromoter ? (
                                <>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-text-secondary">Full Name *</label>
                                    <input
                                      type="text"
                                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                      value={item.promoterAssignment.promoterName}
                                      onChange={(e) => updatePromoterAssignmentField(idx, 'promoterName', e.target.value)}
                                      placeholder="e.g. Saima Ijaz"
                                      required
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                                    <input
                                      type="text"
                                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                      value={item.promoterAssignment.promoterPhone}
                                      onChange={(e) => updatePromoterAssignmentField(idx, 'promoterPhone', e.target.value)}
                                      placeholder="e.g. 0501234567"
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                  <label className="text-xs font-semibold text-text-secondary">Select Promoter *</label>
                                  <CustomSelect
                                    options={staffList.map(s => ({ 
                                      value: s.id, 
                                      label: `${s.name} (${s.phone || 'No phone'}) - Size: ${s.shirtSize || 'M'}` 
                                    }))}
                                    value={item.promoterAssignment.existingStaffId}
                                    onChange={(val) => {
                                      const selectedStaff = staffList.find(s => s.id === val);
                                      updateItemField(idx, 'promoterAssignment', {
                                        ...item.promoterAssignment,
                                        existingStaffId: val,
                                        promoterName: selectedStaff?.name || '',
                                        promoterPhone: selectedStaff?.phone || '',
                                      });
                                    }}
                                    placeholder="-- Choose Promoter --"
                                    required
                                  />
                                </div>
                              )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 flex items-start gap-2 text-xs">
                              <Info size={14} className="text-accent flex-shrink-0 mt-0.5" />
                              <div className="text-accent">
                                <p className="font-semibold mb-1">Auto-assigned information:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                                  <li><strong>Store:</strong> {stores.find(s => s.id === toId)?.name || 'Target store from outbound'}</li>
                                  <li><strong>Uniform Size:</strong> {selectedProd?.size || 'As per product'}</li>
                                  <li><strong>Quantity:</strong> As entered below</li>
                                </ul>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Campaign Start Date</label>
                                <input
                                  type="date"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                  value={item.promoterAssignment.startDate}
                                  onChange={(e) => updatePromoterAssignmentField(idx, 'startDate', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Campaign End Date</label>
                                <input
                                  type="date"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                  value={item.promoterAssignment.endDate}
                                  onChange={(e) => updatePromoterAssignmentField(idx, 'endDate', e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Remarks / Delivery Notes</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                value={item.promoterAssignment.notes}
                                onChange={(e) => updatePromoterAssignmentField(idx, 'notes', e.target.value)}
                                placeholder="e.g. Returned clean, special request notes..."
                              />
                            </div>
                          </div>
                        )
                      ) : (
                        /* STANDARD NON-UNIFORM FLOW */
                        <>
                          {/* Quantity Input */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Quantity to Dispatch</label>
                            <input
                              type="number"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none disabled:bg-surface-elevated/40"
                              value={item.quantity}
                              onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                              disabled={selectedProd?.isSerialized || selectedProd?.trackExpiry}
                              placeholder={selectedProd?.isSerialized ? 'Select serial numbers below' : selectedProd?.trackExpiry ? 'Select batches below' : 'e.g. 50'}
                              required
                            />
                            {selectedProd?.isSerialized && (
                              <span className="text-[10px] text-text-muted mt-0.5">Quantity is computed automatically from selected serial numbers.</span>
                            )}
                            {selectedProd?.trackExpiry && !selectedProd?.isSerialized && (
                              <span className="text-[10px] text-text-muted mt-0.5">Quantity is computed automatically from selected batch quantities below.</span>
                            )}
                            {!selectedProd?.isSerialized && !selectedProd?.trackExpiry && selectedProd && parseInt(item.quantity, 10) > selectedProd.warehouseStock && (
                              <span className="text-[10px] font-semibold text-danger mt-1 animate-pulse">
                                ⚠️ Warning: Quantity ({item.quantity}) exceeds available warehouse stock ({selectedProd.warehouseStock} units)!
                              </span>
                            )}
                            {!selectedProd?.isSerialized && selectedProd && parseInt(item.quantity, 10) <= 0 && (
                              <span className="text-[10px] font-semibold text-danger mt-1">
                                ⚠️ Warning: Quantity must be greater than 0.
                              </span>
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

                          {/* Expiry Batch selection section */}
                          {selectedProd?.trackExpiry && !selectedProd?.isSerialized && (
                            <div className="sm:col-span-2 flex flex-col gap-3 mt-2 bg-surface-elevated/20 p-4 border border-border rounded-xl">
                              <label className="text-xs font-bold text-text-primary uppercase tracking-wider">Select Quantities by Expiry Batch</label>
                              <div className="flex flex-col gap-2">
                                {(!item.availableBatches || item.availableBatches.length === 0) ? (
                                  <div className="text-xs text-text-muted italic p-2 bg-surface border border-border rounded-lg">
                                    No available non-expired stock batches found at WAREHOUSE for this product.
                                  </div>
                                ) : (
                                  item.availableBatches.map((batch, bIdx) => {
                                    const mDateStr = batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString() : 'N/A';
                                    const eDateStr = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A';
                                    const now = new Date();
                                    const isExpired = batch.expiryDate && new Date(batch.expiryDate) < now;
                                    
                                    if (isExpired) return null;

                                    const selectedQty = item.selectedBatches?.find(b => 
                                      b.manufactureDate === batch.manufactureDate && 
                                      b.expiryDate === batch.expiryDate
                                    )?.quantity || '';

                                    return (
                                      <div key={bIdx} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border rounded-xl shadow-sm">
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs font-bold text-text-primary">Expires: {eDateStr}</span>
                                          <span className="text-[10px] text-text-secondary">Mfg: {mDateStr} | Available: <strong className="text-primary">{batch.quantity} units</strong></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] font-bold text-text-secondary uppercase">Qty:</label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={batch.quantity}
                                            className="w-20 bg-surface border border-border rounded px-2.5 py-1 text-xs text-center focus:outline-none focus:border-primary font-bold text-text-primary"
                                            value={selectedQty}
                                            placeholder="0"
                                            onChange={(e) => {
                                              const enteredVal = e.target.value;
                                              const valInt = parseInt(enteredVal, 10) || 0;
                                              const cappedVal = Math.min(valInt, batch.quantity);
                                              
                                              const currentSelected = item.selectedBatches || [];
                                              const existingIdx = currentSelected.findIndex(b => 
                                                b.manufactureDate === batch.manufactureDate && 
                                                b.expiryDate === batch.expiryDate
                                              );

                                              let nextSelected = [...currentSelected];
                                              if (existingIdx !== -1) {
                                                if (cappedVal > 0) {
                                                  nextSelected[existingIdx] = { ...nextSelected[existingIdx], quantity: cappedVal };
                                                } else {
                                                  nextSelected = nextSelected.filter((_, i) => i !== existingIdx);
                                                }
                                              } else if (cappedVal > 0) {
                                                nextSelected.push({
                                                  manufactureDate: batch.manufactureDate,
                                                  expiryDate: batch.expiryDate,
                                                  quantity: cappedVal
                                                });
                                              }

                                              const totalQty = nextSelected.reduce((sum, b) => sum + b.quantity, 0);
                                              
                                              setItems(prev => prev.map((x, i) => i === idx ? {
                                                ...x,
                                                selectedBatches: nextSelected,
                                                quantity: totalQty
                                              } : x));
                                            }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}

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
                                        : 'bg-surface border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary'}
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
                                                : 'bg-surface border-border text-text-secondary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none/40'}
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
                        </>
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface border border-border border-dashed hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
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
            className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200"
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
            <span>{editMode ? `Update Outbound Batch (${items.length})` : `Confirm Outbound Batch (${items.length})`}</span>
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
                <div className="has-tooltip">
                  <button 
                    type="button" 
                    className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
                    onClick={() => setIsCameraOpen(false)}
                  >
                    <X size={16} />
                  </button>
                  <span className="tooltip-box">Close scanner</span>
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden min-h-[300px]">
                <div className="relative overflow-hidden rounded-xl border border-border bg-black flex items-center justify-center">
                  <div id="camera-reader-element" className="w-full h-full"></div>
                </div>
                
                {/* Live Session Scans list */}
                <div className="flex flex-col border border-border rounded-xl bg-surface-elevated/40 p-4 overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-border mb-3 flex-shrink-0">
                    <span className="text-xs font-bold text-text-primary uppercase">Scanned in this Session ({sessionScans.length})</span>
                    {sessionScans.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setSessionScans([]);
                          setItems(prev => {
                            const activeIdx = prev.findIndex(item => item.isExpanded);
                            if (activeIdx === -1) return prev;
                            return prev.map((x, i) => i === activeIdx ? { ...x, selectedBarcodes: [], quantity: 0 } : x);
                          });
                        }}
                        className="text-[10px] font-bold text-danger hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 font-mono text-xs max-h-[250px]">
                    {sessionScans.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-text-muted text-[11px] font-sans">
                        No barcodes scanned yet.
                      </div>
                    ) : (
                      sessionScans.map((bc, sIdx) => (
                        <div key={sIdx} className="flex justify-between items-center py-1.5 px-2 bg-surface border border-border rounded-lg shadow-sm">
                          <code className="text-text-primary text-[11px]">{bc}</code>
                          <button
                            type="button"
                            onClick={() => {
                              setSessionScans(prev => prev.filter((_, i) => i !== sIdx));
                              setItems(prev => {
                                const activeIdx = prev.findIndex(item => item.isExpanded);
                                if (activeIdx === -1) return prev;
                                const activeItem = prev[activeIdx];
                                const updatedSelected = activeItem.selectedBarcodes.filter(b => b.toLowerCase() !== bc.toLowerCase());
                                return prev.map((x, i) => i === activeIdx ? { ...x, selectedBarcodes: updatedSelected, quantity: updatedSelected.length } : x);
                              });
                            }}
                            className="text-[10px] font-bold text-danger hover:underline px-1 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
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

export default function OutboundClient({ products, stores, supervisors, directSellers = [], brands = [], initialItems, initialDestinationType, initialDestinationId, initialDeliverySupervisorId, editMode = false, existingDn = '', staffList = [] }) {
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
        directSellers={directSellers}
        brands={brands}
        initialItems={initialItems}
        initialDestinationType={initialDestinationType}
        initialDestinationId={initialDestinationId}
        initialDeliverySupervisorId={initialDeliverySupervisorId}
        editMode={editMode}
        existingDn={existingDn}
        staffList={staffList}
      />
    </Suspense>
  );
}

