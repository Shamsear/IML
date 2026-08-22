'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, QrCode, X, Smartphone } from 'lucide-react';
import { playBeep } from '@/lib/audio';

/**
 * Reusable barcode scanner component with camera + manual input.
 *
 * @param {Object} props
 * @param {Function} props.onScan - Called with scanned code string
 * @param {string} [props.placeholder] - Manual input placeholder
 * @param {string} [props.className] - Extra CSS classes
 */
export default function BarcodeScanner({ onScan, placeholder = 'Type or scan barcode...', className = '' }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);

  // Start camera stream
  const startCamera = async () => {
    try {
      setScanError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setScanError('Camera access denied. Use manual input below.');
      console.error('Camera error:', err);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Handle manual barcode input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      playBeep();
      onScan(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Camera toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cameraActive ? stopCamera : startCamera}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
            cameraActive
              ? 'bg-danger/10 border-danger/20 text-danger hover:bg-danger/20'
              : 'bg-surface-elevated border-border text-text-secondary hover:border-primary/30 hover:text-primary'
          }`}
        >
          {cameraActive ? <X size={12} /> : <Camera size={12} />}
          {cameraActive ? 'Stop Camera' : 'Open Camera'}
        </button>
        {cameraActive && (
          <span className="text-[10px] text-success font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Scanning...
          </span>
        )}
      </div>

      {/* Camera preview */}
      {cameraActive && (
        <div className="relative rounded-lg overflow-hidden border border-border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 border-2 border-primary/30 rounded-lg pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-primary/50" />
          </div>
        </div>
      )}

      {scanError && (
        <p className="text-[10px] text-danger font-medium">{scanError}</p>
      )}

      {/* Manual input */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={!manualInput.trim()}
          className="px-3 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors"
        >
          <QrCode size={14} />
        </button>
      </form>
    </div>
  );
}
