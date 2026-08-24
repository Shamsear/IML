'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, Loader2, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { playBeep } from '@/lib/audio';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

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
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const scannedBarcodeSetRef = useRef(new Set());
  // Multi-scan consensus: track recent scan attempts for accuracy
  const pendingScanRef = useRef(null); // { code, rawCode, timestamp, count }
  const [pendingScan, setPendingScan] = useState(null); // UI mirror of pendingScanRef
  const pendingTimeoutRef = useRef(null);
  
  const [cameras, setCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const html5QrCodeRef = useRef(null);

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();
    const code = manualBarcode.trim();
    if (!code) return;

    try {
      const response = await fetch('/api/scan-companion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session, barcode: code })
      });

      if (response.ok) {
        playBeep();
        triggerVibe();
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

  // Trigger mobile vibration feedback
  // 'success' = long single buzz, 'duplicate' = short double buzz
  const triggerVibe = (type = 'success') => {
    try {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        if (type === 'duplicate') {
          navigator.vibrate([40, 50, 40]); // short double buzz
        } else {
          navigator.vibrate(150); // long single buzz
        }
      }
    } catch (e) {}
  };

  // Check if session remains active on the host database (not deleted or expired)
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

  // Check camera permissions
  // Determine initial state: respect past permission approvals to prevent annoying duplicate browser prompts on scanning QR
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

  // Strict barcode validation: only alphanumeric + hyphen + space allowed
  const isValidBarcode = (raw) => {
    if (!raw || raw.length < 4) return false;
    // Reject if contains any non-alphanumeric characters except hyphen and space
    if (/[^a-zA-Z0-9\- ]/.test(raw)) return false;
    // Reject if has too many special patterns that indicate misreads
    // (e.g., repeated chars like 'IIII', '0000' are valid IMEI suffixes so allow them)
    return true;
  };

  // Send barcode to PC backend
  const sendBarcodeToPC = async (rawCode) => {
    const lowerCode = rawCode.toLowerCase();
    if (scannedBarcodeSetRef.current.has(lowerCode)) {
      triggerVibe('duplicate');
      setErrorMessage(`"${rawCode}" was already scanned. Clear history first to re-scan.`);
      setTimeout(() => setErrorMessage(''), 3000);
      return false;
    }
    try {
      const response = await fetch('/api/scan-companion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session, barcode: rawCode })
      });
      if (response.ok) {
        playBeep();
        triggerVibe('success');
        scannedBarcodeSetRef.current.add(lowerCode);
        lastScannedBarcodeRef.current = lowerCode;
        lastScannedTimeRef.current = Date.now();
        setScannedItems(prev => [rawCode, ...prev]);
        // Flash overlay
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

  // Confirm a pending scan (user tapped Send)
  const confirmPendingScan = async () => {
    const pending = pendingScanRef.current;
    if (!pending) return;
    pendingScanRef.current = null;
    setPendingScan(null);
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    await sendBarcodeToPC(pending.rawCode);
  };

  // Reject a pending scan (user tapped Skip)
  const rejectPendingScan = () => {
    pendingScanRef.current = null;
    setPendingScan(null);
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    triggerVibe('duplicate');
  };

  const startScanning = async (scannerInstance, cameraId) => {
    try {
      await scannerInstance.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          const rawCode = decodedText.trim();
          const now = Date.now();

          // LAYER 1: Strict character filter
          if (!isValidBarcode(rawCode)) {
            return; // silently reject garbled scans
          }

          const lowerCode = rawCode.toLowerCase();

          // LAYER 2: Cooldown — reject exact duplicate within 3 seconds
          if (lowerCode === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 3000)) {
            return;
          }

          // LAYER 3: Permanent dedup — already sent to PC this session
          if (scannedBarcodeSetRef.current.has(lowerCode)) {
            triggerVibe('duplicate');
            setErrorMessage(`"${rawCode}" was already scanned. Clear history first to re-scan.`);
            setTimeout(() => setErrorMessage(''), 3000);
            return;
          }

          // LAYER 4: Multi-scan consensus — require 2 matching scans within 5 seconds
          const pending = pendingScanRef.current;
          if (pending && pending.lowerCode === lowerCode && (now - pending.timestamp < 5000)) {
            // MATCH! Second scan confirms the first — auto-send
            pendingScanRef.current = null;
            setPendingScan(null);
            if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
            await sendBarcodeToPC(rawCode);
            return;
          }

          // LAYER 5: New barcode — show confirmation card, wait for 2nd scan or manual confirm
          pendingScanRef.current = { rawCode, lowerCode, timestamp: now, count: 1 };
          setPendingScan({ rawCode, count: 1 });
          triggerVibe('success');

          // Auto-dismiss after 8 seconds if no confirmation
          if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
          pendingTimeoutRef.current = setTimeout(() => {
            if (pendingScanRef.current && pendingScanRef.current.lowerCode === lowerCode) {
              pendingScanRef.current = null;
              setPendingScan(null);
            }
          }, 8000);
        },
        (err) => {}
      );
    } catch (e) {
      console.error("Failed to start scanning:", e);
    }
  };

  // html5-qrcode scanner lifecycle
  useEffect(() => {
    let html5Qrcode = null;
    if (session && cameraPermissionStatus === 'granted') {
      const initScanner = async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          html5Qrcode = new Html5Qrcode("mobile-reader-element");
          html5QrCodeRef.current = html5Qrcode;

          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
            
            // Auto select best back/environment camera
            let defaultIdx = devices.findIndex(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('rear') || 
              d.label.toLowerCase().includes('environment')
            );
            if (defaultIdx === -1) defaultIdx = 0;
            
            setCurrentCameraIdx(defaultIdx);
            await startScanning(html5Qrcode, devices[defaultIdx].id);
          } else {
            setErrorMessage("No cameras found on this device.");
          }
        } catch (e) {
          console.error("Scanner init error:", e);
          setErrorMessage("Failed to start camera feed.");
        }
      };
      initScanner();
    }
    return () => {
      if (html5Qrcode) {
        html5Qrcode.stop().catch(e => console.error("Failed to stop scanner:", e));
      }
    };
  }, [session, cameraPermissionStatus]);

  const handleCycleCamera = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current) return;
    
    try {
      await html5QrCodeRef.current.stop();
      const nextIdx = (currentCameraIdx + 1) % cameras.length;
      setCurrentCameraIdx(nextIdx);
      await startScanning(html5QrCodeRef.current, cameras[nextIdx].id);
    } catch (e) {
      console.error("Failed to switch camera:", e);
      setErrorMessage("Error switching camera lens.");
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // Hook to dynamically inject scanning laser line & custom corners over the live HTML video container
  useEffect(() => {
    if (cameraPermissionStatus === 'granted') {
      const interval = setInterval(() => {
        const videoElement = document.querySelector('#mobile-reader-element video');
        if (videoElement) {
          clearInterval(interval);
          const videoParent = videoElement.parentElement;
          if (videoParent) {
            videoParent.style.position = 'relative';
            if (!videoParent.querySelector('.custom-scan-overlay')) {
              const overlay = document.createElement('div');
              overlay.className = 'custom-scan-overlay absolute inset-0 pointer-events-none flex items-center justify-center z-10';
              overlay.innerHTML = `
                <div class="w-[250px] h-[250px] border-2 border-white/30 rounded-lg relative overflow-hidden transition-transform duration-300">
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

  // Error/Success state displays
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

      {/* Floating toast messages — overlay without pushing layout */}
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
              <label className="text-[11px] font-bold text-text-secondary text-left">Type/Scan Barcode Manually:</label>
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
            {/* Live Camera Viewport */}
            <div className="relative w-full rounded-xl overflow-hidden border border-border bg-surface shadow-sm">
              <div id="mobile-reader-element" className="w-full"></div>
            </div>

            {/* Dynamic Camera Cycle Switch Button */}
            {cameras.length > 1 && (
              <div className="flex justify-center flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCycleCamera}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  <Camera size={14} className="text-primary animate-pulse" />
                  <span>Switch Camera ({currentCameraIdx + 1}/{cameras.length}: {cameras[currentCameraIdx]?.label || 'Lens'})</span>
                </button>
              </div>
            )}

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
                Position a barcode inside the square outline. Scan again to confirm, or tap Send/Skip below.
              </span>
            </div>

            {/* Pending Scan Confirmation Card */}
            {pendingScan && (
              <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-4 flex flex-col items-center gap-3 animate-slide-down">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                  <span className="text-[10px] font-bold text-warning uppercase">Awaiting Confirmation</span>
                </div>
                <div className="bg-surface border border-border rounded-lg px-5 py-3 w-full text-center">
                  <span className="text-lg font-mono font-extrabold text-text-primary tracking-wider">
                    {pendingScan.rawCode}
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary text-center">
                  Scan the same barcode again to auto-confirm, or use the buttons below.
                </p>
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={rejectPendingScan}
                    className="flex-1 py-2.5 bg-surface border border-border text-text-secondary hover:bg-danger/10 hover:text-danger hover:border-danger/30 text-xs font-bold rounded-lg transition-all"
                  >
                    Skip ✗
                  </button>
                  <button
                    type="button"
                    onClick={confirmPendingScan}
                    className="flex-1 py-2.5 bg-success text-white hover:bg-success/90 text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    Send ✓
                  </button>
                </div>
              </div>
            )}

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
