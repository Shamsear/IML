'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, ArrowDownLeft, AlertCircle, Camera, QrCode, X, Smartphone, CheckCircle, Edit2, Info, Tag, Copy } from 'lucide-react';
import Link from 'next/link';
import { createBulkReceiveTransactions, updateBulkReceiveTransactions } from '@/app/actions/transactions';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';
import FormFooter from '@/components/FormFooter';
import ImageLightbox from '@/components/ImageLightbox';
import { getClientScanCompanionUrl } from '@/lib/scan-companion-url';
import { playBeep } from '@/lib/audio';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

function InboundFormContent({ products, brands = [], stores = [], recentReceivers = [], recentSuppliers = [], initialItems = null, initialSupplier = '', editMode = false, existingDn = '' }) {
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

  // Brand filter for product selection
  const [brandFilter, setBrandFilter] = useState('ALL');
  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const handleGlobalBrandChange = (brandId) => {
    setBrandFilter(brandId);
    const firstMatchedProduct = brandId === 'ALL' 
      ? null 
      : products.find(p => p.brand?.id === brandId);

    setItems(prev => prev.map(item => {
      const updated = { ...item, brandFilter: brandId };
      if (brandId !== 'ALL') {
        if (item.isNewProduct) {
          updated.prodBrandId = brandId;
        } else if (firstMatchedProduct) {
          updated.productId = firstMatchedProduct.id;
          updated.quantity = firstMatchedProduct.isSerialized ? 0 : 1;
        }
      }
      return updated;
    }));
  };

  // Source (From) states - Locked to SUPPLIER
  const [fromId, setFromId] = useState(initialSupplier || '');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  // Received By details - Receiver is locked to WAREHOUSE
  const [receivedBy, setReceivedBy] = useState('');
  const [globalNotes, setGlobalNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Webcam scanning state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [sessionScans, setSessionScans] = useState([]);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isBulkScan, setIsBulkScan] = useState(false);
  const [activeScanTarget, setActiveScanTarget] = useState(null); // { itemIdx, field: 'productId' | 'quantity' | 'rangeStart' | 'rangeEnd' | 'list' }

  // Wireless Mobile companion scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null); // { sessionId, localIp, port }
  const [isCompanionActive, setIsCompanionActive] = useState(false);
  const [activeCategorySuggestionsTarget, setActiveCategorySuggestionsTarget] = useState(null); // idx
  const [highlightedSupplierIdx, setHighlightedSupplierIdx] = useState(-1);
  const [highlightedReceiverIdx, setHighlightedReceiverIdx] = useState(-1);
  const [highlightedCategoryIdx, setHighlightedCategoryIdx] = useState(-1);

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

  // Helper to construct a blank receipt item configuration
  const createEmptyInboundItem = (index = 0) => {
    const activeFilter = brandFilter || 'ALL';
    const defaultBrand = (activeFilter !== 'ALL') ? activeFilter : (brands[0]?.id || '');
    
    return {
      id: `temp-${Date.now()}-${index}`,
      isNewProduct: false,
      productId: '',
      quantity: 1,
      barcodesInput: '',
      notes: '',
      rangeStart: '',
      rangeEnd: '',
      rangeMode: false, // true = range builder, false = scan/text input
      isExpanded: true,
      error: '',
      manufactureDate: '',
      expiryDate: '',
      // Inline Product registration states
      prodName: '',
      prodType: 'NORMAL',
      prodBrandId: defaultBrand,
      prodCategory: 'General',
      prodSize: '',
      prodItemCode: '',
      prodLowStockAlert: '10',
      prodIsReturnable: false,
      prodIsDisposable: false,
      prodTrackExpiry: false,
      prodImageFile: null,
      prodImagePreview: '',
      prodRack: '',
      prodShelf: '',
      prodSimStoreId: stores[0]?.id || '',
      prodSimStoreCode: '',
      prodAutoGenName: true,
      brandFilter: activeFilter,
    };
  };

  // State array for receipt items queue
  const [items, setItems] = useState(initialItems || []);

  // Warn before navigating away with unsaved items
  useUnsavedChanges(items.length > 0 && !loading);

  const initializedRef = useRef(false);
  // Initialize selected products from URL search parameter "productIds"
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const urlIds = searchParams.get('productIds')?.split(',').filter(Boolean) || [];
    if (urlIds.length > 0) {
      const urlItems = urlIds.map((id, idx) => {
        const prod = products.find(p => p.id === id);
        return {
          id: `temp-${Date.now()}-${idx}`,
          isNewProduct: false,
          productId: id,
          quantity: prod?.isSerialized ? 0 : 1,
          barcodesInput: '',
          notes: '',
          rangeStart: '',
          rangeEnd: '',
          rangeMode: false,
          isExpanded: idx === 0,
          error: '',
          manufactureDate: '',
          expiryDate: '',
          prodName: '',
          prodType: 'NORMAL',
          prodBrandId: brands[0]?.id || '',
          prodCategory: 'General',
          prodSize: '',
          prodItemCode: '',
          prodLowStockAlert: '10',
          prodIsReturnable: false,
          prodIsDisposable: false,
          prodTrackExpiry: false,
          prodImageFile: null,
          prodImagePreview: '',
          prodRack: '',
          prodShelf: '',
        };
      });
      setItems(urlItems);
    } else if (!initialItems || initialItems.length === 0) {
      // Only create a blank item if no pre-populated items exist (e.g. from copyDn)
      setItems([createEmptyInboundItem(0)]);
    }
    // else: keep the initialItems already loaded from useState
  }, [searchParams, products, brands, initialItems]);

  // Prefill receivedBy and globalNotes from initialItems on edit or copy
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      if (initialItems[0].receivedBy) {
        setReceivedBy(initialItems[0].receivedBy);
      }
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
      } else {
        const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
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
      const updated = { ...item, [field]: value };
      
      // If product changes, reset quantity based on tracking type
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        updated.quantity = prod?.isSerialized ? 0 : 1;
        updated.barcodesInput = '';
        updated.rangeStart = '';
        updated.rangeEnd = '';
      }

      // If inline product type changes, reset categories & serial lists
      if (field === 'prodType') {
        if (value === 'SIM') {
          updated.prodCategory = 'SIM Cards';
        } else if (value === 'ROUTER') {
          updated.prodCategory = 'Routers';
        } else {
          updated.prodCategory = 'General';
        }
        updated.quantity = 0;
        updated.barcodesInput = '';
        updated.rangeStart = '';
        updated.rangeEnd = '';
      }
      
      // SIM Name Auto-Generation logic
      if (updated.prodType === 'SIM' && updated.prodAutoGenName) {
        const bObj = brands.find(b => b.id === updated.prodBrandId);
        const sObj = stores.find(s => s.id === updated.prodSimStoreId);
        if (bObj && sObj && updated.prodSimStoreCode.trim()) {
          updated.prodName = `${bObj.name} ${updated.prodSimStoreCode.trim()} ${sObj.name}`;
        } else {
          updated.prodName = '';
        }
      }

      // Auto-update quantity if barcodesInput changes on serialized products
      if (field === 'barcodesInput') {
        const isSerialized = item.isNewProduct
          ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
          : (products.find(p => p.id === item.productId)?.isSerialized || false);
        if (isSerialized) {
          const barcodes = value.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
          updated.quantity = barcodes.length;
        }
      }
      return updated;
    }));
  };

  const addBarcodeToActiveItem = (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return false;

    let added = false;
    setItems(prev => {
      if (!activeScanTarget) return prev;
      const { itemIdx, field } = activeScanTarget;

      const targetItem = prev[itemIdx];
      if (!targetItem) return prev;

      if (field === 'productId') {
        const matched = products.find(p => p.itemCode?.toLowerCase() === cleanCode.toLowerCase());
        if (matched) {
          added = true;
          setTimeout(() => setActiveScanTarget(null), 0);
          return prev.map((item, i) => i === itemIdx ? { 
            ...item, 
            productId: matched.id,
            quantity: matched.isSerialized ? 0 : 1,
            barcodesInput: '',
            rangeStart: '',
            rangeEnd: '',
            rangeMode: false,
            error: ''
          } : item);
        } else {
          alert(`No product found in catalog matching SKU/barcode: "${cleanCode}"`);
        }
        return prev;
      }

      if (field === 'quantity') {
        added = true;
        const currentQty = parseInt(targetItem.quantity, 10) || 0;
        return prev.map((item, i) => i === itemIdx ? { ...item, quantity: currentQty + 1 } : item);
      }

      if (field === 'rangeStart') {
        added = true;
        setTimeout(() => setActiveScanTarget(null), 0);
        return prev.map((item, i) => i === itemIdx ? { ...item, rangeStart: cleanCode } : item);
      }

      if (field === 'rangeEnd') {
        added = true;
        setTimeout(() => setActiveScanTarget(null), 0);
        return prev.map((item, i) => i === itemIdx ? { ...item, rangeEnd: cleanCode } : item);
      }

      if (field === 'list') {
        const currentList = targetItem.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          added = true;
          return prev.map((item, i) => i === itemIdx ? { 
            ...item, 
            barcodesInput: newList.join('\n'),
            quantity: newList.length
          } : item);
        }
      }

      return prev;
    });
    return added;
  };

  // Webcam scanning hooks
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

              if (!isBulkScanRef.current || activeScanTarget?.field === 'productId' || activeScanTarget?.field === 'rangeStart' || activeScanTarget?.field === 'rangeEnd') {
                setIsCameraOpen(false);
                setActiveScanTarget(null);
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
  }, [isCameraOpen, cameraPermissionStatus, activeScanTarget]);

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

  // Mobile companion scanner pairing
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

  // Poll mobile companion scanned barcodes
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
                  if (activeScanTarget?.field === 'productId' || activeScanTarget?.field === 'rangeStart' || activeScanTarget?.field === 'rangeEnd') {
                    setIsMobileModalOpen(false);
                    setActiveScanTarget(null);
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

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  // Generate sequence ranges for barcodes
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

  const handleApplyRange = (idx) => {
    const item = items[idx];
    const start = item.rangeStart.trim();
    const end = item.rangeEnd.trim();
    if (!start || !end) {
      alert("Please enter both starting and ending barcodes.");
      return;
    }

    try {
      const generated = generateSeries(start, end);
      const currentList = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      const mergedList = Array.from(new Set([...currentList, ...generated]));
      
      updateItemField(idx, 'barcodesInput', mergedList.join('\n'));
      updateItemField(idx, 'rangeStart', '');
      updateItemField(idx, 'rangeEnd', '');
      playBeep();
    } catch (e) {
      alert(e.message || "Failed to generate barcode series.");
    }
  };

  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyInboundItem(prev.length)));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (item.isNewProduct) {
      if (!item.prodName.trim()) {
        updateItemField(idx, 'error', 'Product name is required for new product registration');
        return;
      }
      if (!item.prodBrandId) {
        updateItemField(idx, 'error', 'Brand is required for new product registration');
        return;
      }
      const isSerialized = item.prodType === 'SIM' || item.prodType === 'ROUTER';
      if (!isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
        updateItemField(idx, 'error', 'Quantity must be greater than 0');
        return;
      }
      if (isSerialized && item.quantity === 0) {
        updateItemField(idx, 'error', 'Please scan or enter at least one serial barcode');
        return;
      }
    } else {
      if (!item.productId) {
        updateItemField(idx, 'error', 'Product selection is required');
        return;
      }
      const prod = products.find(p => p.id === item.productId);
      if (!prod?.isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
        updateItemField(idx, 'error', 'Quantity must be greater than 0');
        return;
      }
      if (prod?.isSerialized && item.quantity === 0) {
        updateItemField(idx, 'error', 'Please scan or enter at least one serial barcode');
        return;
      }
    }

    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyInboundItem(0)];
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(item => item.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  // Submit batch transaction
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    // Global Form Validation
    if (!fromId.trim()) {
      setError('Please enter a valid source supplier name');
      setLoading(false);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isNewProduct) {
        if (!item.prodName.trim()) {
          updateItemField(i, 'error', 'Product name is required for new product registration');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (!item.prodBrandId) {
          updateItemField(i, 'error', 'Brand is required for new product registration');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        const isSerialized = item.prodType === 'SIM' || item.prodType === 'ROUTER';
        if (!isSerialized && (parseInt(item.quantity, 10) <= 0 || isNaN(parseInt(item.quantity, 10)))) {
          updateItemField(i, 'error', 'Quantity must be greater than 0');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
        if (isSerialized && item.quantity === 0) {
          updateItemField(i, 'error', 'Please scan or enter at least one serial barcode');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      } else {
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
        if (prod?.isSerialized && item.quantity === 0) {
          updateItemField(i, 'error', 'Please scan or enter at least one serial barcode');
          handleExpandItem(i);
          setLoading(false);
          return;
        }
      }
    }

    // Construct FormData
    const formData = new FormData();
    formData.append('fromEntityType', 'SUPPLIER');
    formData.append('fromEntityId', fromId.trim());
    formData.append('toEntityType', 'WAREHOUSE');
    formData.append('toEntityId', '');
    formData.append('receivedBy', receivedBy || '');
    formData.append('globalNotes', globalNotes || '');
    formData.append('transactionDate', transactionDate || '');

    // Map items to payload
    const itemsPayload = items.map((item, idx) => {
      const isSerialized = item.isNewProduct 
        ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
        : (products.find(p => p.id === item.productId)?.isSerialized || false);

      let barcodes = [];
      if (isSerialized) {
        barcodes = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
      }

      if (item.isNewProduct && item.prodImageFile) {
        formData.append(`item_${idx}_imageFile`, item.prodImageFile);
      }

      return {
        isNewProduct: item.isNewProduct,
        productId: item.productId,
        quantity: parseInt(item.quantity, 10),
        barcodes,
        notes: item.notes,
        manufactureDate: item.manufactureDate,
        expiryDate: item.expiryDate,
        // Inline Product details
        prodName: item.prodName,
        prodType: item.prodType,
        prodBrandId: item.prodBrandId,
        prodCategory: item.prodCategory,
        prodSize: item.prodSize,
        prodItemCode: item.prodItemCode,
        prodLowStockAlert: item.prodLowStockAlert,
        prodIsReturnable: item.prodIsReturnable,
        prodIsDisposable: item.prodIsDisposable,
        prodTrackExpiry: item.prodTrackExpiry,
        prodRack: item.prodRack,
        prodShelf: item.prodShelf,
      };
    });

    formData.append('items', JSON.stringify(itemsPayload));

    try {
      if (editMode && existingDn) {
        await updateBulkReceiveTransactions(existingDn, formData);
        setConfirmData({ title: 'Receive Note Updated', message: `Receive note ${existingDn} has been updated successfully.` });
        setConfirmOpen(true);
      } else {
        await createBulkReceiveTransactions(formData);
        setConfirmData({ title: 'Inbound Received', message: `${items.length} item(s) received into warehouse successfully.` });
        setConfirmOpen(true);
      }
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

  const getFilteredCategories = (query) => {
    const list = ['Stands', 'Uniforms', 'Gifts', 'Disposables', ...uniqueCategories];
    const unique = Array.from(new Set(list));
    if (!query) return unique;
    return unique.filter(c => c.toLowerCase().includes(query.toLowerCase()));
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <ArrowDownLeft size={180} />
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/inbound" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
              Inbound Stock Receive
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Log supplier shipments in a rapid batch accordion queue.
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
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/inbound'); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      {/* Global Form Configurations */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ArrowDownLeft size={18} className="text-success" />
          <span>Inbound Shipment Details</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Supplier (From)</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  setShowSupplierSuggestions(true);
                  setHighlightedSupplierIdx(0);
                }}
                onFocus={() => {
                  setShowSupplierSuggestions(true);
                  setHighlightedSupplierIdx(0);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSupplierSuggestions(false);
                    setHighlightedSupplierIdx(-1);
                  }, 250);
                }}
                onKeyDown={(e) => {
                  const filtered = filteredSupplierSuggestions;
                  if (filtered.length === 0) return;

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedSupplierIdx(prev => Math.min(prev + 1, filtered.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedSupplierIdx(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    if (highlightedSupplierIdx >= 0 && highlightedSupplierIdx < filtered.length) {
                      e.preventDefault();
                      setFromId(filtered[highlightedSupplierIdx]);
                      setShowSupplierSuggestions(false);
                      setHighlightedSupplierIdx(-1);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSupplierSuggestions(false);
                    setHighlightedSupplierIdx(-1);
                  }
                }}
                placeholder="e.g. Sadia Supplier"
                required
              />
              {showSupplierSuggestions && filteredSupplierSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                  {filteredSupplierSuggestions.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-0 font-medium ${
                        idx === highlightedSupplierIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-elevated text-text-primary'
                      }`}
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

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-text-secondary">Received By (Staff)</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                value={receivedBy}
                onChange={(e) => {
                  setReceivedBy(e.target.value);
                  setShowSuggestions(true);
                  setHighlightedReceiverIdx(0);
                }}
                onFocus={() => {
                  setShowSuggestions(true);
                  setHighlightedReceiverIdx(0);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSuggestions(false);
                    setHighlightedReceiverIdx(-1);
                  }, 250);
                }}
                onKeyDown={(e) => {
                  const filtered = filteredSuggestions;
                  if (filtered.length === 0) return;

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedReceiverIdx(prev => Math.min(prev + 1, filtered.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedReceiverIdx(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    if (highlightedReceiverIdx >= 0 && highlightedReceiverIdx < filtered.length) {
                      e.preventDefault();
                      setReceivedBy(filtered[highlightedReceiverIdx]);
                      setShowSuggestions(false);
                      setHighlightedReceiverIdx(-1);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setHighlightedReceiverIdx(-1);
                  }
                }}
                placeholder="e.g. John Doe"
                required
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                  {filteredSuggestions.map((name, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-0 font-medium ${
                        idx === highlightedReceiverIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-elevated text-text-primary'
                      }`}
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

          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <label className="text-xs font-semibold text-text-secondary">Receive Note Global Remarks</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
              placeholder="Global remark visible at the top of the Receive Note PDF..."
            />
          </div>
        </div>
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
                brandFilter === 'ALL'
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
                  brandFilter === b.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface border-border text-text-secondary hover:border-primary/50'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
          {brandFilter !== 'ALL' && (
            <p className="text-[11px] text-primary font-semibold">
              Showing only <strong>{brands.find(b => b.id === brandFilter)?.name}</strong> products · {products.filter(p => p.brand?.id === brandFilter).length} products available
            </p>
          )}
        </div>
      )}

      {/* Accordion Form Cards Queue */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const selectedProd = products.find(p => p.id === item.productId);
            const brandObj = brands.find(b => b.id === item.prodBrandId);
            const isSerialized = item.isNewProduct
              ? (item.prodType === 'SIM' || item.prodType === 'ROUTER')
              : (selectedProd?.isSerialized || false);

            const isSim = item.isNewProduct
              ? (item.prodType === 'SIM')
              : (selectedProd?.category?.toUpperCase().includes('SIM') || selectedProd?.name?.toUpperCase().includes('SIM') || false);

            const displayTitle = item.isNewProduct
              ? (item.prodName || `New Product Entry #${idx + 1}`)
              : (selectedProd ? `${selectedProd.brand.name} - ${selectedProd.name}` : `Receipt Entry #${idx + 1}`);

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
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.isNewProduct ? (
                        item.prodImagePreview ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                            <img src={item.prodImagePreview} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                            <Camera size={18} />
                          </div>
                        )
                      ) : (
                        selectedProd?.imageUrl ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                            <img src={selectedProd.imageUrl} alt="Product" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                            <Camera size={18} />
                          </div>
                        )
                      )}
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-primary truncate">
                            {displayTitle}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider
                            ${item.isNewProduct ? 'bg-success/15 text-success border border-success/20' : 'bg-surface-elevated border border-border text-text-secondary'}
                          `}>
                            {item.isNewProduct ? 'New Inline' : 'Catalog'}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {item.isNewProduct ? (
                            <span>Brand: <strong>{brandObj?.name || '---'}</strong> | Tracking: <strong>{item.prodType}</strong></span>
                          ) : (
                            <span>Category: <strong>{selectedProd?.category || '---'}</strong> | Tracking: <strong>{isSerialized ? 'Serialized' : 'Bulk'}</strong></span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block">Stock Level</span>
                        <span className="text-xs font-bold text-primary block">
                          {item.isNewProduct ? (
                            <span>{(parseInt(item.quantity, 10) || 0)} items (New)</span>
                          ) : (
                            <span>
                              {(selectedProd?.warehouseStock || 0) + (parseInt(item.quantity, 10) || 0)} items
                              <span className="text-[10px] text-text-secondary font-medium block mt-0.5">
                                ({(selectedProd?.warehouseStock || 0)} current + {(parseInt(item.quantity, 10) || 0)} inbound)
                              </span>
                            </span>
                          )}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="has-tooltip">
                          <button
                            type="button"
                            onClick={() => handleExpandItem(idx)}
                            className="p-1.5 hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <span className="tooltip-box">Expand receipt item details</span>
                        </div>
                        <div className="has-tooltip">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className="tooltip-box">Remove entry</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. EXPANDED FORM CARD */}
                {item.isExpanded && (
                  <div className="p-6 sm:p-8 flex flex-col gap-6 animate-slide-down">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Receipt Item Entry #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                      >
                        <Trash2 size={13} />
                        <span>Remove Item</span>
                      </button>
                    </div>

                    {item.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} />
                        <span>{item.error}</span>
                      </div>
                    )}

                    {/* Radio toggle for existing vs inline product creation */}
                    <div className="flex items-center gap-6 pb-4 border-b border-border/60">
                      <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                        <input
                          type="radio"
                          name={`productSource-${item.id}`}
                          checked={!item.isNewProduct}
                          onChange={() => updateItemField(idx, 'isNewProduct', false)}
                          className="accent-primary"
                        />
                        <span>Inbound Existing Catalog Product</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                        <input
                          type="radio"
                          name={`productSource-${item.id}`}
                          checked={item.isNewProduct}
                          onChange={() => updateItemField(idx, 'isNewProduct', true)}
                          className="accent-primary"
                        />
                        <span className="text-primary font-bold">Register &amp; Inbound New Product</span>
                      </label>
                    </div>

                    {/* Product fields based on selection */}
                    {!item.isNewProduct ? (
                      /* EXISTING PRODUCT dropdown */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-text-secondary">Product to Receive</label>
                          {/* Per-item brand override pills */}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => updateItemField(idx, 'brandFilter', 'ALL')}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${(item.brandFilter || 'ALL') === 'ALL' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                            >All Brands</button>
                            {brands.map(b => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => updateItemField(idx, 'brandFilter', b.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${item.brandFilter === b.id ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/50'}`}
                              >{b.name}</button>
                            ))}
                          </div>
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
                            onChange={(val) => updateItemField(idx, 'productId', val)}
                            placeholder={
                              (item.brandFilter || 'ALL') === 'ALL'
                                ? '-- Select Product --'
                                : `-- Select ${brands.find(b => b.id === item.brandFilter)?.name || ''} Product --`
                            }
                            required
                          />
                          {selectedProd?.imageUrl && (
                            <div className="mt-2.5 flex items-center gap-3 border border-border p-2 rounded-xl bg-surface-elevated/20 w-fit">
                              <img 
                                src={selectedProd.imageUrl} 
                                alt={selectedProd.name} 
                                className="w-12 h-12 rounded-2xl object-cover border border-border flex-shrink-0 cursor-zoom-in hover:brightness-95 transition-all duration-200"
                                onClick={() => setLightboxImage({ url: selectedProd.imageUrl, name: selectedProd.name })}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-bold text-text-primary truncate max-w-[200px]">{selectedProd.name}</span>
                                <span className="text-[10px] text-text-secondary mt-0.5 font-mono">SKU: {selectedProd.itemCode || '---'}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* NEW INLINE PRODUCT form */
                      <div className="flex flex-col gap-6 animate-slide-down">
                        <div className="flex flex-col gap-4">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60 flex items-center gap-1.5">
                            <Info size={13} className="text-primary" />
                            <span>1. New Catalog Classification</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Product Type</label>
                              <CustomSelect
                                options={[
                                  { value: 'NORMAL', label: 'Bulk Product (Stands, Shirts, etc.)' },
                                  { value: 'SIM', label: 'SIM Card (Serialized Barcode)' },
                                  { value: 'ROUTER', label: 'Router Device (Serialized Barcode)' },
                                ]}
                                value={item.prodType}
                                onChange={(val) => updateItemField(idx, 'prodType', val)}
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Associated Brand</label>
                              <CustomSelect
                                options={brands.map(b => ({ value: b.id, label: b.name }))}
                                value={item.prodBrandId}
                                onChange={(val) => updateItemField(idx, 'prodBrandId', val)}
                                placeholder="-- Select Brand --"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4">
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider pb-1 border-b border-border/60">2. New Product Details</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {item.prodType === 'SIM' && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2 bg-primary/5 p-4 rounded-xl border border-primary/10 animate-slide-down">
                                <div className="flex flex-col gap-1.5 sm:col-span-3">
                                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                    <input 
                                      type="checkbox" 
                                      className="custom-checkbox"
                                      checked={item.prodAutoGenName}
                                      onChange={(e) => {
                                        updateItemField(idx, 'prodAutoGenName', e.target.checked);
                                      }}
                                    />
                                    <span className="text-primary font-bold">Auto-Generate SIM Card Display Name</span>
                                  </label>
                                  <span className="text-[10px] text-text-secondary">Generates name layout: [Brand Name] [Store Code] [Store Name]</span>
                                </div>

                                {item.prodAutoGenName && (
                                  <>
                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                      <label className="text-xs font-semibold text-text-secondary">Target Store</label>
                                      <CustomSelect
                                        options={stores.map(s => ({ value: s.id, label: s.name }))}
                                        value={item.prodSimStoreId}
                                        onChange={(val) => updateItemField(idx, 'prodSimStoreId', val)}
                                        placeholder="-- Select Store --"
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                      <label className="text-xs font-semibold text-text-secondary">Store Code</label>
                                      <input
                                        type="text"
                                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                        value={item.prodSimStoreCode}
                                        onChange={(e) => updateItemField(idx, 'prodSimStoreCode', e.target.value)}
                                        placeholder="e.g. 4001"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                              <label className="text-xs font-semibold text-text-secondary">
                                Display Name {item.prodType === 'SIM' && item.prodAutoGenName && <span className="text-[10px] text-primary italic">(Auto-Generated)</span>}
                              </label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-surface-elevated/40"
                                value={item.prodName}
                                onChange={(e) => updateItemField(idx, 'prodName', e.target.value)}
                                onBlur={(e) => {
                                  if (item.prodCategory?.toUpperCase() === 'UNIFORM' && item.prodSize && item.prodName) {
                                    const baseName = item.prodName.replace(/\s*\((XS|S|M|L|XL|XXL|XXXL)\)\s*$/i, '').trim();
                                    const newName = `${baseName} (${item.prodSize})`;
                                    if (item.prodName !== newName) updateItemField(idx, 'prodName', newName);
                                  }
                                }}
                                disabled={item.prodType === 'SIM' && item.prodAutoGenName}
                                placeholder={item.prodType === 'SIM' && item.prodAutoGenName ? "Complete store fields above to generate name..." : "e.g. Promo Stand"}
                                required
                              />
                              {(() => {
                                 const brandObj = brands.find(b => b.id === item.prodBrandId);
                                 const bName = brandObj?.name || '';
                                 let previewName = item.prodName.trim();
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
                                value={item.prodItemCode}
                                onChange={(e) => updateItemField(idx, 'prodItemCode', e.target.value)}
                                placeholder="Auto-generated if empty"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5 relative">
                              <label className="text-xs font-semibold text-text-secondary">Category Group</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:bg-surface-elevated/45"
                                  value={item.prodCategory}
                                  onChange={(e) => {
                                    updateItemField(idx, 'prodCategory', e.target.value);
                                    setActiveCategorySuggestionsTarget(idx);
                                    setHighlightedCategoryIdx(0);
                                  }}
                                  onFocus={() => {
                                    setActiveCategorySuggestionsTarget(idx);
                                    setHighlightedCategoryIdx(0);
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveCategorySuggestionsTarget(null);
                                      setHighlightedCategoryIdx(-1);
                                    }, 250);
                                  }}
                                  onKeyDown={(e) => {
                                    const filtered = getFilteredCategories(item.prodCategory);
                                    if (filtered.length === 0) return;

                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      setHighlightedCategoryIdx(prev => Math.min(prev + 1, filtered.length - 1));
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      setHighlightedCategoryIdx(prev => Math.max(prev - 1, 0));
                                    } else if (e.key === 'Enter') {
                                      if (highlightedCategoryIdx >= 0 && highlightedCategoryIdx < filtered.length) {
                                        e.preventDefault();
                                        updateItemField(idx, 'prodCategory', filtered[highlightedCategoryIdx]);
                                        setActiveCategorySuggestionsTarget(null);
                                        setHighlightedCategoryIdx(-1);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setActiveCategorySuggestionsTarget(null);
                                      setHighlightedCategoryIdx(-1);
                                    }
                                  }}
                                  disabled={item.prodType !== 'NORMAL' || item.prodCategory?.toUpperCase() === 'UNIFORM'}
                                  placeholder="e.g. Materials"
                                />
                                {activeCategorySuggestionsTarget === idx && getFilteredCategories(item.prodCategory).length > 0 && (
                                  <div className="absolute top-full left-0 right-0 bg-surface border border-border rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto z-[100] animate-fade-in">
                                    {getFilteredCategories(item.prodCategory).map((cat, catIdx) => (
                                      <button
                                        key={catIdx}
                                        type="button"
                                        className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-border last:border-0 font-medium font-semibold ${
                                          catIdx === highlightedCategoryIdx ? 'bg-primary/10 text-primary' : 'hover:bg-surface-elevated text-text-primary'
                                        }`}
                                        onClick={() => {
                                          updateItemField(idx, 'prodCategory', cat);
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
                              <label className="text-xs font-semibold text-text-secondary">Low Stock Threshold</label>
                              <input
                                type="number"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                value={item.prodLowStockAlert}
                                onChange={(e) => updateItemField(idx, 'prodLowStockAlert', e.target.value)}
                                placeholder="e.g. 10"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Warehouse Rack (Optional)</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                value={item.prodRack || ''}
                                onChange={(e) => updateItemField(idx, 'prodRack', e.target.value)}
                                placeholder="e.g. Rack A"
                              />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Warehouse Shelf (Optional)</label>
                              <input
                                type="text"
                                className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                                value={item.prodShelf || ''}
                                onChange={(e) => updateItemField(idx, 'prodShelf', e.target.value)}
                                placeholder="e.g. Shelf 3"
                              />
                            </div>

                             <div className="flex flex-col gap-1.5 sm:col-span-2 mt-4">
                               <label className="text-xs font-semibold text-text-secondary">Returnable / Disposable Status</label>
                               <div className="flex items-center gap-6 mt-1 flex-wrap">
                                 <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                   <input 
                                     type="radio" 
                                     name={`prod-status-${idx}`}
                                     className="custom-radio"
                                     checked={!item.prodIsReturnable && !item.prodIsDisposable && item.prodCategory?.toUpperCase() !== 'UNIFORM'}
                                     onChange={() => {
                                       updateItemField(idx, 'prodIsReturnable', false);
                                       updateItemField(idx, 'prodIsDisposable', false);
                                       if (item.prodCategory?.toUpperCase() === 'UNIFORM') {
                                         updateItemField(idx, 'prodCategory', 'Stands');
                                       }
                                     }}
                                   />
                                   <span>Standard (Neither)</span>
                                 </label>
                                 <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                   <input 
                                     type="radio" 
                                     name={`prod-status-${idx}`}
                                     className="custom-radio"
                                     checked={item.prodIsReturnable && item.prodCategory?.toUpperCase() !== 'UNIFORM'}
                                     onChange={() => {
                                       updateItemField(idx, 'prodIsReturnable', true);
                                       updateItemField(idx, 'prodIsDisposable', false);
                                       if (item.prodCategory?.toUpperCase() === 'UNIFORM') {
                                         updateItemField(idx, 'prodCategory', 'Stands');
                                       }
                                     }}
                                   />
                                   <span>Returnable</span>
                                 </label>
                                 <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                   <input 
                                     type="radio" 
                                     name={`prod-status-${idx}`}
                                     className="custom-radio"
                                     checked={item.prodIsDisposable && item.prodCategory?.toUpperCase() !== 'UNIFORM'}
                                     onChange={() => {
                                       updateItemField(idx, 'prodIsReturnable', false);
                                       updateItemField(idx, 'prodIsDisposable', true);
                                       if (item.prodCategory?.toUpperCase() === 'UNIFORM') {
                                         updateItemField(idx, 'prodCategory', 'Stands');
                                       }
                                     }}
                                   />
                                   <span>Disposable (Single Use)</span>
                                 </label>
                                 <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                   <input 
                                     type="radio" 
                                     name={`prod-status-${idx}`}
                                     className="custom-radio"
                                     checked={item.prodCategory?.toUpperCase() === 'UNIFORM'}
                                        onChange={() => {
                                       updateItemField(idx, 'prodIsReturnable', true);
                                       updateItemField(idx, 'prodIsDisposable', false);
                                       updateItemField(idx, 'prodCategory', 'UNIFORM');
                                     }}
                                   />
                                   <span>Uniform (Always Returnable)</span>
                                 </label>
                               </div>
                             </div>

                             <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                               <label className="text-xs font-semibold text-text-secondary">Expiry Date Tracking</label>
                               <div className="flex items-center gap-6 mt-1">
                                 <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                                   <input 
                                     type="checkbox" 
                                     className="custom-checkbox"
                                     checked={item.prodTrackExpiry}
                                     onChange={(e) => updateItemField(idx, 'prodTrackExpiry', e.target.checked)}
                                   />
                                   <span className="text-primary font-bold">Enable Expiry Date Tracking for this product</span>
                                 </label>
                               </div>
                               <span className="text-[10px] text-text-secondary">If enabled, you will be required to record manufacture and expiry dates when inbounding or receiving stock of this product.</span>
                             </div>

                            {item.prodCategory?.toUpperCase() === 'UNIFORM' && (
                              <div className="flex flex-col gap-1.5 mt-3 p-3 bg-accent/5 border border-accent/20 rounded-lg sm:col-span-2">
                                <label className="text-xs font-semibold text-text-secondary">Uniform Size *</label>
                                <select
                                  value={item.prodSize || ''}
                                  onChange={(e) => {
                                    const newSize = e.target.value;
                                    updateItemField(idx, 'prodSize', newSize);
                                    if (item.prodName) {
                                      const baseName = item.prodName.replace(/\s*\((XS|S|M|L|XL|XXL|XXXL)\)\s*$/i, '').trim();
                                      const newName = newSize ? `${baseName} (${newSize})` : baseName;
                                      updateItemField(idx, 'prodName', newName);
                                    }
                                  }}
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
                                  required={item.prodCategory?.toUpperCase() === 'UNIFORM'}
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

                            {/* Image Upload Area */}
                            <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                              <label className="text-xs font-semibold text-text-secondary">Product Image</label>
                              <div className="flex items-center gap-4 border border-border border-dashed p-4 rounded-xl bg-surface-elevated/10">
                                {item.prodImagePreview ? (
                                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <img src={item.prodImagePreview} alt="Preview" className="w-full h-full object-contain" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateItemField(idx, 'prodImageFile', null);
                                        updateItemField(idx, 'prodImagePreview', '');
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
                                        updateItemField(idx, 'prodImageFile', file);
                                        updateItemField(idx, 'prodImagePreview', URL.createObjectURL(file));
                                      }
                                    }}
                                    className="hidden"
                                    id={`inline-image-${item.id}`}
                                  />
                                  <label
                                    htmlFor={`inline-image-${item.id}`}
                                    className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 inline-flex items-center gap-1.5 w-fit border-dashed"
                                  >
                                    <span>Browse Picture</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stock quantities or barcode scanners */}
                    {!isSerialized ? (
                      /* BULK QUANTITY INPUT */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-text-secondary">Quantity to Receive</label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveScanTarget({ itemIdx: idx, field: 'quantity' });
                                  handleOpenMobileScanner();
                                }}
                                className="inline-flex items-center gap-0.5 text-[10px] text-text-secondary hover:text-text-primary font-semibold cursor-pointer"
                                title="Sync quantity scans via companion"
                              >
                                <Smartphone size={10} /> <span>Sync</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveScanTarget({ itemIdx: idx, field: 'quantity' });
                                  setIsCameraOpen(true);
                                  setIsBulkScan(true);
                                }}
                                className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline font-bold cursor-pointer"
                              >
                                <Camera size={10} /> <span>Scan Units</span>
                              </button>
                            </div>
                          </div>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      /* SERIALIZED INPUT SECTION */
                      <div className="flex flex-col gap-4 pt-4 border-t border-border/60 animate-slide-down">
                        <div className="flex items-center justify-between pb-1">
                          <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <QrCode size={15} className="text-primary" />
                            <span>Scan / Input Serial Barcodes</span>
                          </label>
                          
                          {/* Range input builder mode toggle */}
                          {isSim && (
                            <button
                              type="button"
                              onClick={() => updateItemField(idx, 'rangeMode', !item.rangeMode)}
                              className="text-xs text-primary font-bold hover:underline"
                            >
                              {item.rangeMode ? "Switch to Manual Scan List" : "Switch to Serial Range Builder"}
                            </button>
                          )}
                        </div>

                        {item.rangeMode && isSim ? (
                          /* RANGE BUILDER CONTAINER */
                          <div className="p-4 bg-surface-elevated/20 border border-border border-dashed rounded-xl flex flex-col gap-3.5 animate-slide-down">
                            <div className="flex items-center gap-2 text-text-secondary text-[11px] font-medium leading-relaxed">
                              <span>Enter the starting barcode and ending barcode of the package sequence (e.g. SIM001 to SIM100) to auto-generate the list.</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-text-secondary">Range Start Barcode</label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveScanTarget({ itemIdx: idx, field: 'rangeStart' });
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
                                        setActiveScanTarget({ itemIdx: idx, field: 'rangeStart' });
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
                                  placeholder="e.g. ACC001"
                                  value={item.rangeStart}
                                  onChange={(e) => updateItemField(idx, 'rangeStart', e.target.value)}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-text-secondary">Range End Barcode</label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveScanTarget({ itemIdx: idx, field: 'rangeEnd' });
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
                                        setActiveScanTarget({ itemIdx: idx, field: 'rangeEnd' });
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
                                  placeholder="e.g. ACC100"
                                  value={item.rangeEnd}
                                  onChange={(e) => updateItemField(idx, 'rangeEnd', e.target.value)}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleApplyRange(idx)}
                              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow w-fit cursor-pointer"
                            >
                              Generate Range &amp; Add
                            </button>
                          </div>
                        ) : (
                          /* STANDARD SCANS / TEXT AREA */
                          <div className="flex flex-col gap-1.5 animate-slide-down">
                            <div className="flex items-center justify-between pb-1">
                              <span className="text-[10px] text-text-secondary">Type or scan barcodes separated by commas or lines...</span>
                              <div className="flex items-center gap-2">
                                <div className="has-tooltip">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveScanTarget({ itemIdx: idx, field: 'list' });
                                      handleOpenMobileScanner();
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary rounded text-[10px] font-bold cursor-pointer transition-colors"
                                  >
                                    <Smartphone size={10} /> <span>Companion Sync</span>
                                  </button>
                                  <span className="tooltip-box">Pair and scan using smartphone</span>
                                </div>
                                <div className="has-tooltip">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveScanTarget({ itemIdx: idx, field: 'list' });
                                      setIsCameraOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary hover:bg-primary-hover text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                                  >
                                    <Camera size={10} /> <span>Webcam Scan</span>
                                  </button>
                                  <span className="tooltip-box">Scan barcodes using webcam</span>
                                </div>
                              </div>
                            </div>
                            <textarea
                              rows={5}
                              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary font-mono focus:ring-1 focus:ring-primary/20 leading-relaxed"
                              placeholder="Type or scan barcodes separated by commas or lines...&#10;e.g.&#10;SIM87600123&#10;SIM87600124"
                              value={item.barcodesInput}
                              onChange={(e) => updateItemField(idx, 'barcodesInput', e.target.value)}
                            />
                            <div className="flex items-center justify-between text-[10px] text-text-secondary mt-1">
                              <span>Barcodes parsed: <strong className="text-primary">{item.quantity}</strong></span>
                              <span>Press Enter in the top scanner to quick-append barcodes.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expiry Tracking Inputs */}
                    {((!item.isNewProduct && selectedProd?.trackExpiry) || (item.isNewProduct && item.prodTrackExpiry)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Manufacture Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            value={item.manufactureDate || ''}
                            onChange={(e) => updateItemField(idx, 'manufactureDate', e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Expiry Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            value={item.expiryDate || ''}
                            onChange={(e) => updateItemField(idx, 'expiryDate', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes field */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Receipt Remarks / Notes</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 duration-200" 
                        value={item.notes}
                        onChange={(e) => updateItemField(idx, 'notes', e.target.value)}
                        placeholder="e.g. Delivered directly from regional supplier shipment..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-border">
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

        {/* Add item row trigger button */}
        <button
          type="button"
          onClick={handleAddNewItem}
          className="w-full py-4 border-2 border-dashed border-border hover:border-primary/50 text-text-secondary hover:text-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all bg-surface/50 hover:bg-surface duration-200 cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Another Inbound Item</span>
        </button>
        <FormFooter cancelHref="/dashboard/inbound" loading={loading} editMode={editMode} submitLabel={editMode ? 'Update Inbound Receive' : 'Log Inbound Receive'} />
      </form>

      {/* Webcam scanner overlay */}
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

                <div className="has-tooltip">
                  <button 
                    type="button" 
                    className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
                    onClick={() => {
                      setIsCameraOpen(false);
                      setActiveScanTarget(null);
                    }}
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
                            return prev.map((x, i) => i === activeIdx ? { ...x, barcodesInput: '', quantity: 0 } : x);
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
                                const updatedSelected = activeItem.barcodesInput
                                  .split(/[\n,]/)
                                  .map(b => b.trim())
                                  .filter(b => b && b.toLowerCase() !== bc.toLowerCase());
                                return prev.map((x, i) => i === activeIdx ? { ...x, barcodesInput: updatedSelected.join('\n'), quantity: updatedSelected.length } : x);
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

      {/* Wireless Companion pairings pairing modal */}
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
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none transition-colors" 
                onClick={() => {
                  setIsMobileModalOpen(false);
                  setActiveScanTarget(null);
                }}
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

      <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
}

export default function InboundClient({ products, recentReceivers, recentSuppliers, brands, stores, initialItems, initialSupplier, editMode = false, existingDn = '' }) {
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
        brands={brands}
        stores={stores}
        initialItems={initialItems}
        initialSupplier={initialSupplier}
        editMode={editMode}
        existingDn={existingDn}
      />
    </Suspense>
  );
}

