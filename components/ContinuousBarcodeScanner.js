'use client';

import { useEffect, useRef, useState } from 'react';
import { playBeep } from '@/lib/audio';
import { Camera, RefreshCw, X } from 'lucide-react';

export default function ContinuousBarcodeScanner({ onScan, isOpen = true, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scannedBarcodesRef = useRef(new Set());
  const [error, setError] = useState('');
  const [scannerType, setScannerType] = useState('Initializing...');
  const [cameras, setCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);

  // Cycle camera lens
  const cycleCamera = async () => {
    if (cameras.length <= 1) return;
    const nextIdx = (currentCameraIdx + 1) % cameras.length;
    setCurrentCameraIdx(nextIdx);
    await startCamera(cameras[nextIdx].deviceId);
  };

  const startCamera = async (deviceId = null) => {
    setError('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Enumerate cameras if not done yet
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      if (deviceId) {
        const idx = videoDevices.findIndex(d => d.deviceId === deviceId);
        if (idx !== -1) setCurrentCameraIdx(idx);
      } else if (videoDevices.length > 0) {
        // Match active stream track to deviceId
        const activeTrack = stream.getVideoTracks()[0];
        const settings = activeTrack ? activeTrack.getSettings() : null;
        if (settings && settings.deviceId) {
          const idx = videoDevices.findIndex(d => d.deviceId === settings.deviceId);
          if (idx !== -1) setCurrentCameraIdx(idx);
        }
      }
    } catch (err) {
      console.error('Camera capture failed:', err);
      setError('Camera access denied or lens not available.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    startCamera();

    let active = true;
    let scanInterval = null;
    let detector = null;
    let zxingReader = null;

    const setupScanner = async () => {
      // 1. Check for Native Barcode Detector support
      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats && formats.length > 0) {
            detector = new window.BarcodeDetector({
              formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
            });
            setScannerType('Native API (Hardware Accelerated)');
          }
        } catch (e) {
          console.warn('Native BarcodeDetector creation failed, falling back to WASM:', e);
        }
      }

      // 2. If no native detector, prepare zxing-wasm
      if (!detector) {
        setScannerType('WebAssembly Engine (ZXing)');
        try {
          const { readBarcodes } = await import('zxing-wasm');
          zxingReader = readBarcodes;
        } catch (err) {
          console.error('Failed to load zxing-wasm:', err);
          setError('Failed to load scanning engine.');
          return;
        }
      }

      // 3. Start high-frequency scan loop (every 150ms)
      console.log(`[CompanionScanner] ${detector ? 'Native BarcodeDetector' : 'zxing-wasm'} ready, scanning...`);
      scanInterval = setInterval(async () => {
        if (!active || !videoRef.current) return;
        
        const video = videoRef.current;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        try {
          let detectedCodes = [];

          if (detector) {
            // NATIVE PATH
            const barcodes = await detector.detect(video);
            detectedCodes = barcodes.map(b => b.rawValue);
          } else if (zxingReader) {
            // WASM FALLBACK PATH
            // Draw current video frame to hidden canvas to get ImageData
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const results = await zxingReader(imageData, {
              formats: ['Code128', 'EAN13', 'EAN8', 'QRCode', 'UPCA', 'UPCE'],
              tryHarder: false // Set false for speed
            });
            detectedCodes = results.map(r => r.text);
          }

          // Process detected codes immediately
          for (const rawCode of detectedCodes) {
            if (!rawCode) continue;
            const code = rawCode.trim();
            const lowerCode = code.toLowerCase();

            // Strict duplication prevention via Set
            if (!scannedBarcodesRef.current.has(lowerCode)) {
              scannedBarcodesRef.current.add(lowerCode);
              console.log(`[CompanionScanner] Detected: ${code}`);
              
              // Audio + Tactile Feedback
              playBeep();
              if (typeof window !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(100);
              }

              // Visual Flash feedback trigger
              const flashOverlay = document.querySelector('.scanner-laser-box');
              if (flashOverlay) {
                flashOverlay.style.borderColor = '#10b981';
                flashOverlay.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.6)';
                setTimeout(() => {
                  flashOverlay.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  flashOverlay.style.boxShadow = 'none';
                }, 300);
              }

              onScan(code);
            }
          }
        } catch (e) {
          console.warn('[CompanionScanner] Scan loop error:', e);
        }
      }, 150);
    };

    setupScanner();

    return () => {
      active = false;
      if (scanInterval) clearInterval(scanInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Scanner Viewport */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-black shadow-lg">
        {error ? (
          <div className="h-48 flex items-center justify-center p-4 text-center">
            <span className="text-xs text-danger font-medium">{error}</span>
          </div>
        ) : (
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="scanner-laser-box w-[220px] h-[220px] border-2 border-white/30 rounded-lg relative overflow-hidden transition-all duration-300">
                {/* Laser animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-success shadow-[0_0_8px_#10b981] animate-scanner-laser"></div>
                {/* Visual corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-success"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-success"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-success"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-success"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Action controls */}
      <div className="flex items-center justify-between px-1 flex-shrink-0">
        <span className="text-[10px] text-text-secondary font-mono">
          Engine: {scannerType}
        </span>
        <div className="flex gap-2">
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={cycleCamera}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-[11px] font-bold shadow-sm transition-all"
            >
              <RefreshCw size={12} className="animate-spin-slow" />
              <span>Camera ({currentCameraIdx + 1}/{cameras.length})</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 border border-danger/20 hover:bg-danger/20 text-danger rounded-lg text-[11px] font-bold transition-all"
            >
              <X size={12} />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
