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
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [scannedItems, setScannedItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const lastScannedBarcodeRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  // Trigger brief mobile vibration feedback on successful scans
  const triggerVibe = () => {
    try {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {}
  };

  // Check camera permissions
  useEffect(() => {
    if (session) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setCameraPermissionStatus('granted');
        })
        .catch(err => {
          console.error("Camera access error:", err);
          setCameraPermissionStatus('denied');
        });
    }
  }, [session]);

  // html5-qrcode scanner lifecycle
  useEffect(() => {
    let html5QrcodeScanner = null;
    if (session && cameraPermissionStatus === 'granted') {
      const initScanner = async () => {
        try {
          const { Html5QrcodeScanner } = await import('html5-qrcode');
          html5QrcodeScanner = new Html5QrcodeScanner(
            "mobile-reader-element",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
          );

          html5QrcodeScanner.render(
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
          console.error("Scanner init error:", e);
        }
      };
      initScanner();
    }
    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error("Failed to clear scanner:", e));
      }
    };
  }, [session, cameraPermissionStatus]);

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
      <div className="min-h-screen bg-[#fcfbfa] flex flex-col items-center justify-center p-6 text-center font-sans">
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
    <div className="min-h-screen bg-[#fcfbfa] flex flex-col font-sans">
      {/* Header banner */}
      <header className="bg-surface border-b border-border py-4 px-6 flex items-center justify-between sticky top-0 z-50">
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
          <span className="text-[10px] font-bold text-text-muted uppercase">Wireless Sync</span>
        </div>
      </header>

      {/* Main scanner container */}
      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full gap-4">
        {errorMessage && (
          <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2 animate-slide-down">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {cameraPermissionStatus === 'prompt' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 bg-surface border border-border rounded-xl">
            <Loader2 size={32} className="animate-spin text-primary" />
            <span className="text-xs text-text-secondary">Requesting camera permissions...</span>
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
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow"
            >
              Grant Camera Permission
            </button>
          </div>
        )}

        {cameraPermissionStatus === 'granted' && (
          <div className="flex flex-col gap-4 flex-1">
            {/* Live Camera Viewport */}
            <div className="relative w-full rounded-xl overflow-hidden border border-border bg-surface shadow-sm">
              <div id="mobile-reader-element" className="w-full"></div>
            </div>

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
