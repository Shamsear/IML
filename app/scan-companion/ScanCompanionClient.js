'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, Loader2, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';

// Synthesize a localized beep sound (client-only, fileless)
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    console.error("Audio synth error:", e);
  }
};

export default function ScanCompanionClient({ session }) {
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unsupported'
  const [scannedItems, setScannedItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  
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

  const handleDisconnect = async () => {
    if (window.confirm("Disconnect this scanner session?")) {
      try {
        await fetch(`/api/scan-companion?sessionId=${session}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.error(e);
      }
      window.location.href = '/scan-companion';
    }
  };

  // Trigger brief mobile vibration feedback on successful scans
  const triggerVibe = () => {
    try {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {}
  };

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
          const code = decodedText.trim();
          const now = Date.now();

          // Cooldown: prevent duplicate scans within 2 seconds
          if (code.toLowerCase() === lastScannedBarcodeRef.current && (now - lastScannedTimeRef.current < 2000)) {
            return;
          }
          lastScannedBarcodeRef.current = code.toLowerCase();
          lastScannedTimeRef.current = now;

          // Send scanned code to backend API endpoint
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
              
              // Flash visual target overlay feedback
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
            } else {
              const data = await response.json();
              setErrorMessage(data.error || 'Failed to submit barcode to PC.');
              setTimeout(() => setErrorMessage(''), 3000);
            }
          } catch (err) {
            setErrorMessage('Network connection lost.');
            setTimeout(() => setErrorMessage(''), 3000);
          }
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

  // Error/Success state displays
  if (!session) {
    return (
      <div className="h-[100dvh] bg-[#fcfbfa] flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
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
    <div className="h-[100dvh] overflow-hidden bg-[#fcfbfa] flex flex-col font-sans">
      {/* Header banner */}
      <header className="bg-surface border-b border-border py-4 px-6 flex items-center justify-between sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Smartphone size={18} />
          </div>
          <div>
            <h1 className="text-sm font-display font-extrabold text-text-primary">Mobile Scanner</h1>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
              <span className="text-[10px] font-bold text-text-secondary uppercase">Connected: {session}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={handleDisconnect}
            className="px-2.5 py-1 bg-danger/10 hover:bg-danger/20 text-danger text-[10px] font-bold rounded-lg transition-colors border border-danger/20"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Main scanner container */}
      <main className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full flex flex-col gap-4 min-h-0">
        {errorMessage && (
          <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2 animate-slide-down">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-success/10 border border-success/20 text-success rounded-lg p-3 text-xs font-semibold flex items-center gap-2 animate-slide-down">
            <CheckCircle size={14} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

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
              className="w-full max-w-xs px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
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
                  alert("Access still blocked. Please check browser privacy/security settings manually.");
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
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold shadow-sm transition-all"
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
                Position a barcode inside the square outline. The phone will vibrate and automatically type the code on your PC.
              </span>
            </div>

            {/* Live Scanned Items Ledger on Phone */}
            <div className="flex-1 bg-surface border border-border rounded-xl p-4 flex flex-col gap-2 min-h-[180px] max-h-[300px]">
              <div className="flex justify-between items-center border-b border-border pb-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Scanned History ({scannedItems.length})</span>
                {scannedItems.length > 0 && (
                  <button 
                    onClick={() => setScannedItems([])} 
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
    </div>
  );
}
