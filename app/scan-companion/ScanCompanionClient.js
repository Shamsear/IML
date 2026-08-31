'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, Loader2, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { playBeep } from '@/lib/audio';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import ContinuousBarcodeScanner from '@/components/ContinuousBarcodeScanner';

export default function ScanCompanionClient({ session }) {
  const toast = useToast();
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unsupported'
  const [scannedItems, setScannedItems] = useState([]);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', danger: false, onConfirm: null });
  const [manualBarcode, setManualBarcode] = useState('');
  const scannedBarcodeSetRef = useRef(new Set());

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();
    const code = manualBarcode.trim();
    if (!code) return;

    if (!isValidBarcode(code)) {
      setErrorMessage(`"${code}" is not a valid barcode format.`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    const lowerCode = code.toLowerCase();
    if (scannedBarcodeSetRef.current.has(lowerCode)) {
      triggerVibe('duplicate');
      setErrorMessage(`"${code}" was already scanned.`);
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      const response = await fetch('/api/scan-companion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session, barcode: code })
      });

      if (response.ok) {
        playBeep();
        triggerVibe('success');
        scannedBarcodeSetRef.current.add(lowerCode);
        setScannedItems(prev => [code, ...prev]);
        setSuccessMessage(`Barcode "${code}" sent successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        setManualBarcode('');
      } else {
        const data = await response.json();
        setErrorMessage(data.error || 'Failed to submit barcode to PC.');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (err) {
      setErrorMessage('Network connection lost.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDisconnect = () => {
    setConfirmData({
      title: 'Disconnect Scanner?',
      message: 'This will end the current scanner session.',
      danger: true,
      confirmLabel: 'Disconnect',
      onConfirm: async () => {
        try {
          await fetch(`/api/scan-companion?sessionId=${session}`, {
            method: 'DELETE'
          });
        } catch (e) {
          console.error(e);
        }
        window.location.href = '/scan-companion';
      },
    });
    setConfirmOpen(true);
  };

  const triggerVibe = (type = 'success') => {
    try {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        if (type === 'duplicate') {
          navigator.vibrate([40, 50, 40]);
        } else {
          navigator.vibrate(150);
        }
      }
    } catch (e) {}
  };

  // Check if session remains active on the host database
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan-companion?sessionId=${session}&checkOnly=true`);
        if (res.ok) {
          const data = await res.json();
          setIsSessionActive(data.exists !== false);
        } else {
          setIsSessionActive(false);
        }
      } catch (e) {
        setIsSessionActive(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [session]);

  // Check camera permissions on mount
  useEffect(() => {
    if (session) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermissionStatus('unsupported');
        return;
      }
      const savedGrant = localStorage.getItem('camera_permission_granted');
      if (savedGrant === 'true') {
        setCameraPermissionStatus('prompt');
      } else {
        setCameraPermissionStatus('paused');
      }
    }
  }, [session]);

  // Request camera permissions only when state transitions to 'prompt'
  useEffect(() => {
    if (session && cameraPermissionStatus === 'prompt') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          localStorage.setItem('camera_permission_granted', 'true');
          setCameraPermissionStatus('granted');
        })
        .catch(err => {
          console.error("Camera access error:", err);
          setCameraPermissionStatus('denied');
        });
    }
  }, [session, cameraPermissionStatus]);

  const isValidBarcode = (raw) => {
    if (!raw || raw.length < 4) return false;
    if (/[^a-zA-Z0-9\- ]/.test(raw)) return false;
    return true;
  };

  // Send barcode to PC backend
  const sendBarcodeToPC = async (rawCode) => {
    const cleanCode = rawCode.trim();
    if (!isValidBarcode(cleanCode)) return false;

    const lowerCode = cleanCode.toLowerCase();
    if (scannedBarcodeSetRef.current.has(lowerCode)) {
      triggerVibe('duplicate');
      setErrorMessage(`"${cleanCode}" was already scanned.`);
      setTimeout(() => setErrorMessage(''), 3000);
      return false;
    }

    try {
      const response = await fetch('/api/scan-companion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session, barcode: cleanCode })
      });
      if (response.ok) {
        triggerVibe('success');
        scannedBarcodeSetRef.current.add(lowerCode);
        setScannedItems(prev => [cleanCode, ...prev]);
        return true;
      } else {
        const data = await response.json();
        setErrorMessage(data.error || 'Failed to submit barcode to PC.');
        setTimeout(() => setErrorMessage(''), 3000);
        return false;
      }
    } catch (err) {
      setErrorMessage('Network connection lost.');
      setTimeout(() => setErrorMessage(''), 3000);
      return false;
    }
  };

  if (!session) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-display font-extrabold text-text-primary mb-2">No Active Session</h2>
        <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
          Please scan the session QR code on your PC dashboard to pair this device.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col font-sans">
      {/* Header banner */}
      <header className="bg-surface border-b border-border py-4 px-6 flex items-center justify-between sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Smartphone size={18} />
          </div>
          <div>
            <h1 className="text-sm font-display font-extrabold text-text-primary">Mobile Scanner</h1>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isSessionActive ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
              <span className="text-[10px] font-bold text-text-secondary uppercase">
                {isSessionActive ? `Connected: ${session}` : 'Disconnected (Session Expired)'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scannedItems.length > 0 && (
            <div className="px-2.5 py-1 bg-success/10 text-success text-[10px] font-bold rounded-full border border-success/20 flex items-center gap-1">
              <CheckCircle size={11} />
              <span>{scannedItems.length} sent</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleDisconnect}
            className="px-2.5 py-1 bg-danger/10 hover:bg-danger/20 text-danger text-[10px] font-bold rounded-lg transition-colors border border-danger/20"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Floating toast messages */}
      <div className="fixed top-[72px] left-4 right-4 z-[60] flex flex-col gap-2 max-w-md mx-auto pointer-events-none">
        {!isSessionActive && (
          <div className="bg-danger border border-danger/30 text-white rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-lg pointer-events-auto animate-slide-down">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>Session expired. Please pair again.</span>
          </div>
        )}
        {errorMessage && (
          <div className="bg-danger border border-danger/30 text-white rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-lg pointer-events-auto animate-slide-down">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-success border border-success/30 text-white rounded-lg px-3 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-lg pointer-events-auto animate-slide-down">
            <CheckCircle size={14} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Main scanner container */}
      <main className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full flex flex-col gap-4 min-h-0">

        {cameraPermissionStatus === 'prompt' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 bg-surface border border-border rounded-xl">
            <Loader2 size={32} className="animate-spin text-primary" />
            <span className="text-xs text-text-secondary">Requesting camera permissions...</span>
          </div>
        )}

        {cameraPermissionStatus === 'paused' && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center gap-5 bg-surface border border-border rounded-xl shadow-sm animate-slide-down">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
              <Smartphone size={32} />
            </div>
            <div className="flex flex-col gap-1.5 max-w-sm">
              <h3 className="font-display font-extrabold text-base text-text-primary">Device Paired Successfully!</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Click the button below to start the webcam barcode scanner.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCameraPermissionStatus('prompt')}
              className="w-full max-w-xs px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-colors"
            >
              Start Camera Scanner
            </button>

            {/* Manual Fallback Input Form */}
            <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-2 mt-4 pt-4 border-t border-border">
              <label className="text-[10px] font-bold text-text-secondary text-left font-sans uppercase">Or Type Barcode Manually:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan or type barcode here..."
                  className="flex-1 bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}

        {cameraPermissionStatus === 'unsupported' && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center gap-4 bg-surface border border-border rounded-xl">
            <div className="w-14 h-14 rounded-full bg-warning/10 text-warning flex items-center justify-center">
              <AlertCircle size={28} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-display font-extrabold text-sm text-text-primary">Insecure Connection (HTTP Context)</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Mobile browsers block camera access unless the connection uses **HTTPS** or **localhost**. Since you are connected via an insecure HTTP network address, camera access is disabled.
              </p>
            </div>
            
            {/* Manual Fallback Input Form */}
            <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-2 mt-2">
              <label className="text-[11px] font-bold text-text-secondary text-left font-sans uppercase">Type/Scan Barcode Manually:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan or type barcode here..."
                  className="flex-1 bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}

        {cameraPermissionStatus === 'denied' && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center gap-4 bg-surface border border-border rounded-xl">
            <div className="w-14 h-14 rounded-full bg-danger/10 text-danger flex items-center justify-center">
              <Camera size={28} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-display font-extrabold text-sm text-text-primary">Camera Permission Required</h3>
              <p className="text-xs text-text-secondary">
                This app needs camera access to scan barcodes. Please enable it in your mobile browser address bar settings and reload this page.
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
                  toast.error('Camera Blocked', 'Access is blocked. Check browser privacy settings manually.');
                }
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow w-full"
            >
              Grant Camera Permission
            </button>

            {/* Manual Fallback Input Form */}
            <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-2 mt-4 pt-4 border-t border-border">
              <label className="text-[11px] font-bold text-text-secondary text-left font-sans">Type/Scan Barcode Manually:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan or type barcode here..."
                  className="flex-1 bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}

        {cameraPermissionStatus === 'granted' && (
          <div className="flex flex-col gap-4 flex-1">
            {/* High Performance Continuous Camera Scanner */}
            <ContinuousBarcodeScanner
              onScan={sendBarcodeToPC}
              isOpen={true}
            />

            {/* Manual scan form fallback */}
            <form onSubmit={handleManualSubmit} className="bg-surface border border-border p-3 rounded-lg flex flex-col gap-2 shadow-sm">
              <label className="text-[11px] font-bold text-text-secondary text-left font-sans">Can't Scan? Type or scan with hardware wedge:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type barcode and press Send/Enter..."
                  className="flex-1 bg-surface-elevated text-text-primary placeholder:text-text-muted border border-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-primary"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded transition-colors"
                >
                  Send
                </button>
              </div>
            </form>

            {/* Instruction Banner */}
            <div className="bg-surface border border-border p-3 rounded-lg text-center">
              <span className="text-[11px] text-text-secondary leading-relaxed">
                Aim camera at a barcode. It will scan and send automatically. Duplicate codes will be ignored.
              </span>
            </div>

            {/* Live Scanned Items Ledger on Phone */}
            <div className="flex-1 bg-surface border border-border rounded-xl p-4 flex flex-col gap-2 min-h-[180px] max-h-[300px]">
              <div className="flex justify-between items-center border-b border-border pb-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Scanned History ({scannedItems.length})</span>
                {scannedItems.length > 0 && (
                  <button 
                    onClick={() => { setScannedItems([]); scannedBarcodeSetRef.current.clear(); }} 
                    className="text-[10px] text-danger font-semibold hover:underline"
                  >
                    Clear History
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                {scannedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted gap-1">
                    <QrCode size={24} />
                    <span className="text-[10px] italic">No items scanned in this session yet</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {scannedItems.map((code, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between bg-surface-elevated/40 border border-border/60 rounded px-2.5 py-1.5 text-xs font-mono text-text-primary animate-slide-down"
                      >
                        <span>{code}</span>
                        <CheckCircle size={12} className="text-success" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmData.onConfirm}
        type="confirm"
        danger={confirmData.danger}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel={confirmData.confirmLabel}
      />
    </div>
  );
}
