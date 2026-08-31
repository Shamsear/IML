'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Plus, Loader2, CheckCircle, AlertCircle, Camera, QrCode, X, Smartphone, ClipboardCheck, ArrowUpDown } from 'lucide-react';
import { createBulkClientReturnTransactions } from '@/app/actions/transactions';
import { getProductBatchesAtLocation, getAvailableBarcodes, findProductByBarcode } from '@/app/actions/products';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { useToast } from '@/components/Toast';
import { playBeep } from '@/lib/audio';
import { getClientScanCompanionUrl } from '@/lib/scan-companion-url';

export default function ClientReturnsClient({ brands, products }) {
  const router = useRouter();
  const toast = useToast();

  // Core Form States
  const [brandId, setBrandId] = useState('');
  const [receivedBy, setReceivedBy] = useState(''); // Client Rep. Name
  const [deliverySupervisorName, setDeliverySupervisorName] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  });
  const [globalNotes, setGlobalNotes] = useState('');

  // Queue of return lines
  const [items, setItems] = useState([
    {
      id: `temp-${Date.now()}-0`,
      productId: '',
      quantity: 0,
      barcodesInput: '',
      availableBatches: [],
      selectedBatches: [],
      // Serialized barcode picker fields
      availableBarcodes: [],
      selectedBarcodes: [],
      rangeMode: false,
      rangeStart: '',
      rangeEnd: '',
      notes: '',
      isExpanded: true,
      error: ''
    }
  ]);

  // Loading & Msg States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });

  // Webcam scanning states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt');
  const [isBulkScan, setIsBulkScan] = useState(false);
  const [sessionScans, setSessionScans] = useState([]);
  const html5QrCodeRef = useRef(null);

  // Wireless Companion Scanner states
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileSession, setMobileSession] = useState(null);
  const [isCompanionActive, setIsCompanionActive] = useState(false);
  const [activeScanTarget, setActiveScanTarget] = useState(null); // { itemIdx, field: 'productId' | 'list' }

  // Load mobile session on mount
  useEffect(() => {
    const saved = localStorage.getItem('iml_mobile_scan_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        fetch(`/api/scan-companion?sessionId=${parsed.sessionId}&checkOnly=true`)
          .then(res => {
            if (res.ok) {
              setMobileSession(parsed);
              setIsCompanionActive(true);
            } else {
              localStorage.removeItem('iml_mobile_scan_session');
            }
          });
      } catch (e) {}
    }
  }, []);

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
      console.error(e);
    }
  };

  // Global barcode lookup — finds product by barcode and auto-assigns to first empty item
  const processGlobalBarcode = async (code) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    try {
      const serial = await findProductByBarcode(cleanCode);
      if (!serial) {
        toast.error('Not Found', `Barcode "${cleanCode}" was not found in the catalogue.`);
        return;
      }
      const prod = serial.product;

      const existingIdx = items.findIndex(item => item.productId === prod.id);
      if (existingIdx !== -1) {
        const item = items[existingIdx];
        const currentList = item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          const currentSelected = item.selectedBarcodes || [];
          const newSelected = currentSelected.includes(cleanCode) ? currentSelected : [...currentSelected, cleanCode];
          setItems(prev => prev.map((x, idx) => idx === existingIdx ? {
            ...x,
            barcodesInput: newList.join('\n'),
            selectedBarcodes: newSelected,
            quantity: newSelected.length,
            isExpanded: true,
          } : { ...x, isExpanded: false }));
          playBeep();
        }
      } else {
        const emptyIdx = items.findIndex(item => !item.productId);
        if (emptyIdx !== -1) {
          setItems(prev => prev.map((x, idx) => idx === emptyIdx ? {
            ...x,
            productId: prod.id,
            quantity: prod.isSerialized ? 1 : 1,
            barcodesInput: prod.isSerialized ? cleanCode : '',
            selectedBarcodes: prod.isSerialized ? [cleanCode] : [],
            isExpanded: true,
            error: '',
          } : { ...x, isExpanded: false }));
          playBeep();
        } else {
          setItems(prev => prev.map(x => ({ ...x, isExpanded: false })).concat({
            id: `temp-${Date.now()}-${prev.length}`,
            productId: prod.id,
            quantity: prod.isSerialized ? 1 : 1,
            barcodesInput: prod.isSerialized ? cleanCode : '',
            selectedBarcodes: prod.isSerialized ? [cleanCode] : [],
            notes: '',
            isExpanded: true,
            error: '',
          }));
          playBeep();
        }
      }
    } catch (err) {
      console.error('Global scan query failed:', err);
      toast.error('Server Error', 'Error fetching barcode from server.');
    }
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
          return prev.map((item, i) => i === itemIdx ? {
            ...item,
            productId: matched.id,
            quantity: matched.isSerialized ? 0 : 1,
            barcodesInput: '',
            error: ''
          } : item);
        } else {
          toast.error('Product Not Found', `No product matches SKU: "${cleanCode}"`);
        }
        return prev;
      }

      if (field === 'list') {
        const currentList = targetItem.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        const currentSelected = targetItem.selectedBarcodes || [];
        if (!currentList.includes(cleanCode)) {
          const newList = [...currentList, cleanCode];
          const newSelected = currentSelected.includes(cleanCode) ? currentSelected : [...currentSelected, cleanCode];
          added = true;
          return prev.map((item, i) => i === itemIdx ? {
            ...item,
            barcodesInput: newList.join('\n'),
            selectedBarcodes: newSelected,
            quantity: newSelected.length
          } : item);
        }
      }
      return prev;
    });
    return added;
  };

  // Listen to mobile companion scanned barcodes in real-time via SSE
  useEffect(() => {
    if (!mobileSession?.sessionId || !isCompanionActive) return;

    let eventSource = null;
    let fallbackInterval = null;

    const setupSSE = () => {
      eventSource = new EventSource(`/api/scan-companion/sync?sessionId=${mobileSession.sessionId}`);

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.barcode) {
            if (activeScanTarget) {
              const added = addBarcodeToActiveItem(data.barcode);
              if (added) playBeep();
            } else {
              await processGlobalBarcode(data.barcode);
            }
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection lost, falling back to polling...", err);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!fallbackInterval) {
          fallbackInterval = setInterval(async () => {
            try {
              const res = await fetch(`/api/scan-companion?sessionId=${mobileSession.sessionId}`);
              if (res.ok) {
                const data = await res.json();
                if (data.barcodes && data.barcodes.length > 0) {
                  for (const code of data.barcodes) {
                    if (activeScanTarget) {
                      const added = addBarcodeToActiveItem(code);
                      if (added) playBeep();
                    } else {
                      await processGlobalBarcode(code);
                    }
                  }
                }
              }
            } catch (e) {
              console.error("Polling fallback error:", e);
            }
          }, 500);
        }
      };
    };

    setupSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [mobileSession, activeScanTarget, isCompanionActive, items]);

  // Webcam scanning hooks
  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setCameraPermissionStatus('granted');
        })
        .catch(() => setCameraPermissionStatus('denied'));
    } else {
      setCameraPermissionStatus('prompt');
    }
  }, [isCameraOpen]);

  const startCamera = async (Html5Qrcode, cameraId) => {
    try {
      await Html5Qrcode.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          const code = decodedText.trim();
          if (!code) return;

          playBeep();
          if (isBulkScan) {
            setSessionScans(prev => {
              if (prev.includes(code)) return prev;
              const next = [...prev, code];
              setItems(itemsPrev => {
                if (!activeScanTarget) return itemsPrev;
                const { itemIdx } = activeScanTarget;
                return itemsPrev.map((x, i) => i === itemIdx ? {
                  ...x,
                  barcodesInput: next.join('\n'),
                  selectedBarcodes: next,
                  quantity: next.length
                } : x);
              });
              return next;
            });
          } else {
            const added = addBarcodeToActiveItem(code);
            if (added) {
              setIsCameraOpen(false);
            }
          }
        },
        () => {}
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let html5Qrcode = null;
    if (isCameraOpen && cameraPermissionStatus === 'granted') {
      const initScanner = async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          html5Qrcode = new Html5Qrcode("camera-reader-element");
          html5QrCodeRef.current = html5Qrcode;

          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            let backLensIdx = devices.findIndex(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment')
            );
            const cameraId = backLensIdx !== -1 ? devices[backLensIdx].id : devices[0].id;
            await startCamera(html5Qrcode, cameraId);
          } else {
            toast.error('No Camera', 'No camera device discovered on this device.');
          }
        } catch (e) {
          console.error(e);
        }
      };
      initScanner();
    }

    return () => {
      if (html5Qrcode) {
        html5Qrcode.stop().catch(e => console.error("Failed stop webcam:", e));
      }
    };
  }, [isCameraOpen, cameraPermissionStatus]);

  // Sync brand change for added product rows to matching brand
  const handleGlobalBrandChange = (bId) => {
    setBrandId(bId);
    setItems(prev => prev.map(item => ({
      ...item,
      productId: '',
      barcodesInput: '',
      quantity: 0
    })));
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev.map(x => ({ ...x, isExpanded: false })),
      {
        id: `temp-${Date.now()}-${prev.length}`,
        productId: '',
        quantity: 0,
        barcodesInput: '',
        availableBatches: [],
        selectedBatches: [],
        notes: '',
        isExpanded: true,
        error: ''
      }
    ]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length === 1) {
      setItems([{
        id: `temp-${Date.now()}-0`,
        productId: '',
        quantity: 0,
        barcodesInput: '',
        notes: '',
        isExpanded: true,
        error: ''
      }]);
    } else {
      setItems(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((x, i) => i === idx ? { ...x, isExpanded: true } : { ...x, isExpanded: false }));
  };

  const updateItemField = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val, error: '' };
      
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        updated.quantity = prod?.isSerialized ? 0 : 1;
        updated.barcodesInput = '';
        updated.availableBatches = [];
        updated.selectedBatches = [];
        updated.availableBarcodes = [];
        updated.selectedBarcodes = [];
        updated.rangeMode = false;
        updated.rangeStart = '';
        updated.rangeEnd = '';

        // Fetch expiry batches for trackExpiry products
        if (prod?.trackExpiry && !prod?.isSerialized) {
          getProductBatchesAtLocation(val, 'BRAND', brandId)
            .then(batches => {
              setItems(prev => prev.map((x, i2) => i2 === idx ? { ...x, availableBatches: batches || [] } : x));
            })
            .catch(e => console.error('Failed to fetch batches:', e));
        }

        // Fetch available barcodes for serialized products
        if (prod?.isSerialized) {
          getAvailableBarcodes(val, 'BRAND', brandId)
            .then(barcodes => {
              setItems(prev => prev.map((x, i2) => i2 === idx ? { ...x, availableBarcodes: barcodes || [] } : x));
            })
            .catch(e => console.error('Failed to fetch barcodes:', e));
        }
      }

      if (field === 'barcodesInput') {
        const barcodes = val.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
        updated.quantity = barcodes.length;
      }

      return updated;
    }));
  };

  const validateForm = () => {
    let isValid = true;
    const updated = items.map(item => {
      const errs = [];
      if (!item.productId) {
        errs.push('Product selection is required');
      } else {
        const prod = products.find(p => p.id === item.productId);
        if (prod?.isSerialized) {
          const selected = item.selectedBarcodes || [];
          const list = selected.length > 0 ? selected : item.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
          if (list.length === 0) {
            errs.push('At least one barcode must be selected/scanned');
          }
        } else if (prod?.trackExpiry) {
          const totalFromBatches = (item.selectedBatches || []).reduce((sum, b) => sum + b.quantity, 0);
          if (totalFromBatches <= 0) {
            errs.push('Select quantities from at least one expiry batch');
          }
        } else {
          const q = parseInt(item.quantity, 10);
          if (isNaN(q) || q <= 0) {
            errs.push('Quantity must be greater than 0');
          }
        }
      }

      if (errs.length > 0) {
        isValid = false;
        return { ...item, error: errs.join(', '), isExpanded: true };
      }
      return item;
    });

    if (!isValid) setItems(updated);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!brandId) {
      setError('Please select the client brand.');
      return;
    }
    if (!receivedBy.trim()) {
      setError('Please enter the client representative name.');
      return;
    }
    if (!validateForm()) return;

    setLoading(true);

    try {
      const payload = {
        brandId,
        receivedBy: receivedBy.trim(),
        deliverySupervisorName: deliverySupervisorName?.trim() || null,
        transactionDate: transactionDate || null,
        globalNotes: globalNotes || null,
        items: items.map(x => ({
          productId: x.productId,
          quantity: x.quantity,
          barcodes: (x.selectedBarcodes && x.selectedBarcodes.length > 0) ? x.selectedBarcodes : x.barcodesInput.split(/[\n,]+/).map(b => b.trim()).filter(Boolean),
          selectedBatches: x.selectedBatches?.length > 0 ? x.selectedBatches : undefined,
          notes: x.notes || null
        }))
      };

      const result = await createBulkClientReturnTransactions(payload);
      
      if (result && result.length > 0) {
        setConfirmData({ title: 'Client Return Processed', message: `Gate pass generated for ${result[0].deliveryNote}. The PDF has been downloaded.` });
        
        // Retrieve custom reference number
        const refNo = result[0].deliveryNote;
        const dateStr = transactionDate || new Date().toISOString().split('T')[0];

        // Download gate pass PDF
        const url = `/api/dashboard/client-returns/gate-pass?dn=${encodeURIComponent(refNo)}&brandId=${brandId}&date=${dateStr}`;
        const pdfRes = await fetch(url);
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          const fileUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = fileUrl;
          a.download = `IML-ClientReturn-GatePass-${refNo}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(fileUrl);
        }

        setTimeout(() => {
          router.push('/dashboard/client-returns');
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit client return.');
      setLoading(false);
    }
  };

  // Helper to filter products by selected brand filter
  const filteredProducts = products.filter(p => !brandId || p.brandId === brandId);
  const productOptions = [
    { value: '', label: 'Select product...' },
    ...filteredProducts.map(p => ({
      value: p.id,
      label: `${p.name} (${p.itemCode || 'No SKU'})`,
      imageUrl: p.imageUrl ? getOptimizedImageUrl(p.imageUrl, 50, 50) : null
    }))
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 font-sans relative">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/client-returns" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
              Return Stock to Client
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Dispatch inventory items back to client brand owners.
            </p>
          </div>
        </div>
        {/* Companion Status Badge */}
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
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/client-returns'); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      {/* Global Fields Container */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-3 border-b border-border">
          <ClipboardCheck size={18} className="text-primary" />
          <span>Gate Pass Details</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Client / Brand Owner</label>
            <CustomSelect
              options={[{ value: '', label: 'Select brand...' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
              value={brandId}
              onChange={handleGlobalBrandChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Client Representative</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors font-semibold"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="e.g. John representative"
              required
            />
          </div>


        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/40">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Transaction Date</label>
            <input
              type="datetime-local"
              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold font-mono"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-text-secondary">Global Remarks (Appears on PDF)</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold"
              placeholder="e.g., Campaign expired materials return"
              value={globalNotes}
              onChange={(e) => setGlobalNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Accordion List Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => {
            const selectedProd = products.find(p => p.id === item.productId);
            const isSerialized = selectedProd?.isSerialized || false;
            const displayTitle = selectedProd 
              ? `${selectedProd.brand.name} - ${selectedProd.name}` 
              : `Return Item #${idx + 1}`;

            return (
              <div 
                key={item.id}
                className={`bg-surface border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden
                  ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
                `}
              >
                {/* Collapsed Header */}
                {!item.isExpanded && (
                  <div 
                    onClick={() => handleExpandItem(idx)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-sm font-bold text-text-primary truncate">{displayTitle}</span>
                        {selectedProd && (
                          <span className="text-[10px] text-text-secondary font-semibold font-mono">
                            SKU: {selectedProd.itemCode || '—'} · Qty: <strong className="text-primary">{item.quantity}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(idx); }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}

                {/* Expanded Card */}
                {item.isExpanded && (
                  <div className="p-5 flex flex-col gap-4 border-l-4 border-primary">
                    <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
                      <h4 className="font-display font-bold text-sm text-text-primary">
                        Return Line Details
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-text-muted hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Delete Row</span>
                      </button>
                    </div>

                    {item.error && (
                      <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>{item.error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-text-secondary">Product Name / Code</label>
                        <CustomSelect
                          options={productOptions}
                          value={item.productId}
                          onChange={(val) => updateItemField(idx, 'productId', val)}
                        />
                      </div>
                      
                      {!isSerialized && (
                        <div className="flex flex-col gap-1.5 animate-slide-down">
                          <label className="text-xs font-semibold text-text-secondary">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-semibold"
                            value={item.quantity || ''}
                            onChange={(e) => updateItemField(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                            disabled={selectedProd?.trackExpiry}
                            placeholder={selectedProd?.trackExpiry ? 'Select batches below' : ''}
                          />
                          {selectedProd?.trackExpiry && (
                            <span className="text-[10px] text-text-muted">Quantity is computed from selected batches below.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expiry Batch selection section */}
                    {selectedProd?.trackExpiry && !isSerialized && (
                      <div className="flex flex-col gap-3 mt-2 bg-surface-elevated/20 p-4 border border-border rounded-xl">
                        <label className="text-xs font-bold text-text-primary uppercase tracking-wider">Select Quantities by Expiry Batch</label>
                        <div className="flex flex-col gap-2">
                          {(!item.availableBatches || item.availableBatches.length === 0) ? (
                            <div className="text-xs text-text-muted italic p-2 bg-surface border border-border rounded-lg">
                              No available non-expired stock batches found with client for this product.
                            </div>
                          ) : (
                            item.availableBatches.map((batch, bIdx) => {
                              const mDateStr = batch.manufactureDate ? new Date(batch.manufactureDate).toLocaleDateString() : 'N/A';
                              const eDateStr = batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A';
                              const now = new Date();
                              const isExpired = batch.expiryDate && new Date(batch.expiryDate) < now;
                              if (isExpired) return null;

                              const selectedQty = item.selectedBatches?.find(b =>
                                b.manufactureDate === batch.manufactureDate && b.expiryDate === batch.expiryDate
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
                                        const valInt = parseInt(e.target.value, 10) || 0;
                                        const cappedVal = Math.min(valInt, batch.quantity);
                                        const currentSelected = item.selectedBatches || [];
                                        const existingIdx = currentSelected.findIndex(b =>
                                          b.manufactureDate === batch.manufactureDate && b.expiryDate === batch.expiryDate
                                        );
                                        let nextSelected = [...currentSelected];
                                        if (existingIdx !== -1) {
                                          if (cappedVal > 0) {
                                            nextSelected[existingIdx] = { ...nextSelected[existingIdx], quantity: cappedVal };
                                          } else {
                                            nextSelected = nextSelected.filter((_, i) => i !== existingIdx);
                                          }
                                        } else if (cappedVal > 0) {
                                          nextSelected.push({ manufactureDate: batch.manufactureDate, expiryDate: batch.expiryDate, quantity: cappedVal });
                                        }
                                        const totalQty = nextSelected.reduce((sum, b) => sum + b.quantity, 0);
                                        setItems(prev => prev.map((x, i) => i === idx ? { ...x, selectedBatches: nextSelected, quantity: totalQty } : x));
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

                    {isSerialized && (
                      <div className="flex flex-col gap-3 animate-slide-down">
                        {/* Scanner buttons */}
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-xs font-bold text-text-primary">Select Barcodes</span>
                          <div className="flex items-center gap-2">
                            <div className="has-tooltip">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveScanTarget({ itemIdx: idx, field: 'list' });
                                  handleOpenMobileScanner();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated focus:bg-surface-elevated focus:outline-none text-text-primary rounded text-[11px] font-bold cursor-pointer transition-all"
                              >
                                <Smartphone size={12} /> <span>Companion</span>
                              </button>
                              <span className="tooltip-box">Pair and scan using smartphone</span>
                            </div>
                            <div className="has-tooltip">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveScanTarget({ itemIdx: idx, field: 'list' });
                                  setIsCameraOpen(true);
                                  setIsBulkScan(true);
                                  setSessionScans(item.selectedBarcodes || []);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded text-[11px] font-bold cursor-pointer transition-all"
                              >
                                <Camera size={12} /> <span>Webcam</span>
                              </button>
                              <span className="tooltip-box">Scan barcodes using webcam</span>
                            </div>
                          </div>
                        </div>

                        {/* Range mode toggle */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => updateItemField(idx, 'rangeMode', !item.rangeMode)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${item.rangeMode ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-secondary hover:border-primary/30'}`}
                          >
                            <ArrowUpDown size={12} />
                            {item.rangeMode ? 'Range Mode ON' : 'Range Mode'}
                          </button>
                          {item.selectedBarcodes?.length > 0 && (
                            <span className="text-[11px] font-bold text-primary">
                              {item.selectedBarcodes.length} of {item.availableBarcodes?.length || 0} selected
                            </span>
                          )}
                        </div>

                        {/* Range inputs */}
                        {item.rangeMode && (
                          <div className="flex items-center gap-2 animate-slide-down">
                            <input
                              type="text"
                              className="flex-1 bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary font-mono"
                              placeholder="Start serial"
                              value={item.rangeStart || ''}
                              onChange={(e) => updateItemField(idx, 'rangeStart', e.target.value)}
                            />
                            <span className="text-xs text-text-muted font-bold">to</span>
                            <input
                              type="text"
                              className="flex-1 bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary font-mono"
                              placeholder="End serial"
                              value={item.rangeEnd || ''}
                              onChange={(e) => updateItemField(idx, 'rangeEnd', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.rangeStart || !item.rangeEnd) return;
                                const available = item.availableBarcodes || [];
                                const startIdx = available.findIndex(b => b === item.rangeStart);
                                const endIdx = available.findIndex(b => b === item.rangeEnd);
                                if (startIdx !== -1 && endIdx !== -1) {
                                  const lo = Math.min(startIdx, endIdx);
                                  const hi = Math.max(startIdx, endIdx);
                                  const range = available.slice(lo, hi + 1);
                                  const existing = item.selectedBarcodes || [];
                                  const merged = [...new Set([...existing, ...range])];
                                  updateItemField(idx, 'selectedBarcodes', merged);
                                  updateItemField(idx, 'quantity', merged.length);
                                }
                              }}
                              className="px-3 py-2 bg-primary text-white text-[11px] font-bold rounded-lg cursor-pointer hover:bg-primary-hover transition-all"
                            >
                              Select Range
                            </button>
                          </div>
                        )}

                        {/* Barcode grid */}
                        {item.availableBarcodes && item.availableBarcodes.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-2 bg-surface-elevated/30 border border-border rounded-xl">
                            {item.availableBarcodes.map((barcode) => {
                              const isSelected = (item.selectedBarcodes || []).includes(barcode);
                              return (
                                <button
                                  key={barcode}
                                  type="button"
                                  onClick={() => {
                                    const current = item.selectedBarcodes || [];
                                    const next = isSelected
                                      ? current.filter(b => b !== barcode)
                                      : [...current, barcode];
                                    updateItemField(idx, 'selectedBarcodes', next);
                                    updateItemField(idx, 'quantity', next.length);
                                  }}
                                  className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all border ${isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface border-border text-text-secondary hover:border-primary/40'}`}
                                >
                                  {barcode}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-text-muted italic p-3 bg-surface border border-border rounded-lg">
                            No barcodes available with client for this product.
                          </div>
                        )}

                        {/* Fallback textarea */}
                        <details className="group">
                          <summary className="text-[10px] text-text-muted cursor-pointer hover:text-text-secondary font-semibold select-none">
                            Manual entry (type barcodes separated by commas or lines)
                          </summary>
                          <textarea
                            rows={3}
                            className="mt-2 w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary font-mono focus:ring-1 focus:ring-primary/20 leading-relaxed"
                            placeholder="Type or scan serials here..."
                            value={item.barcodesInput}
                            onChange={(e) => updateItemField(idx, 'barcodesInput', e.target.value)}
                          />
                        </details>

                        <div className="flex items-center justify-between text-[11px] text-text-secondary font-bold">
                          <span>Total: <strong className="text-primary">{item.quantity}</strong> serial(s)</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-xs font-semibold text-text-secondary">Row Specific Notes (Optional)</label>
                      <input
                        type="text"
                        className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        placeholder="e.g. return details for this specific product line"
                        value={item.notes || ''}
                        onChange={(e) => updateItemField(idx, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-2">
          <button
            type="button"
            onClick={handleAddItem}
            className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-primary font-bold text-sm rounded-lg shadow-sm transition-all duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Another Product</span>
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing Client Return...</span>
              </>
            ) : (
              <span>Complete Return &amp; Print Gate Pass</span>
            )}
          </button>
        </div>
      </form>

      {/* Companion Pairing Modal Overlay */}
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
              <div className="bg-white p-2 rounded-xl border border-border shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getClientScanCompanionUrl(mobileSession.sessionId, mobileSession.localIp, mobileSession.port))}`}
                  alt="Scan to pair companion"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1.5 max-w-sm">
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mx-auto font-mono">
                  Pairing Code: {mobileSession.sessionId}
                </span>
                <p className="text-xs text-text-secondary leading-relaxed px-4 mt-2">
                  Open the scan companion app on your phone, scan this QR code or enter the code to pair, then start scanning!
                </p>
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-[11px] font-bold text-text-secondary uppercase">Waiting for mobile scans...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webcam scanner modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-xl p-5 w-full max-w-[650px] shadow-2xl flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-bold text-sm text-text-primary flex items-center gap-1.5">
                <Camera size={16} className="text-primary" />
                <span>Webcam Barcode Scanner</span>
              </h3>
              <button 
                type="button" 
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer" 
                onClick={() => setIsCameraOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden min-h-[250px]">
              <div className="relative overflow-hidden rounded-xl border border-border bg-black flex items-center justify-center">
                <div id="camera-reader-element" className="w-full h-full"></div>
              </div>
              
              <div className="flex flex-col border border-border rounded-xl bg-surface-elevated/40 p-4 overflow-hidden">
                <div className="flex justify-between items-center pb-2 border-b border-border mb-3 flex-shrink-0">
                  <span className="text-xs font-bold text-text-primary uppercase">Scanned in this Session ({sessionScans.length})</span>
                  {sessionScans.length > 0 && (
                    <button                      type="button"
                      onClick={() => {
                        setSessionScans([]);
                        setItems(prev => {
                          if (!activeScanTarget) return prev;
                          const { itemIdx } = activeScanTarget;
                          return prev.map((x, i) => i === itemIdx ? { ...x, barcodesInput: '', selectedBarcodes: [], quantity: 0 } : x);
                        });
                      }}
                      className="text-[10px] font-bold text-danger hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 font-mono text-xs max-h-[200px]">
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
                            const next = sessionScans.filter((_, i) => i !== sIdx);
                            setSessionScans(next);
                            setItems(prev => {
                              if (!activeScanTarget) return prev;
                              const { itemIdx } = activeScanTarget;
                              return prev.map((x, i) => i === itemIdx ? {
                                ...x,
                                barcodesInput: next.join('\n'),
                                selectedBarcodes: next,
                                quantity: next.length
                              } : x);
                            });
                          }}
                          className="text-[10px] text-danger font-bold hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setIsCameraOpen(false)}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow cursor-pointer transition-colors"
              >
                Done Scanning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
