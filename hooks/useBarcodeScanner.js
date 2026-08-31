'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { playBeep } from '@/lib/audio';

/**
 * High-performance reusable barcode scanner hook.
 * Uses native BarcodeDetector API if available, falling back to zxing-wasm.
 *
 * @param {Object} options
 * @param {string} options.elementId - DOM element ID for the scanner container
 * @param {boolean} options.isOpen - Whether the scanner modal is open
 * @param {Function} options.onScan - Called with decoded text on successful scan
 */
export default function useBarcodeScanner({
  elementId = 'camera-reader-element',
  isOpen = false,
  onScan,
}) {
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt');
  const streamRef = useRef(null);
  const scannedCodesRef = useRef(new Set());

  // Keep a stable ref to onScan so the scan loop always uses the latest
  // callback without needing to restart the camera stream on every change.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // 1. Camera permission check
  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          setCameraPermissionStatus('granted');
        })
        .catch(err => {
          console.error('Camera access error:', err);
          setCameraPermissionStatus('denied');
        });
    } else {
      setCameraPermissionStatus('prompt');
    }
  }, [isOpen]);

  // 2. Scanner initialization & scan loop
  useEffect(() => {
    if (!isOpen || cameraPermissionStatus !== 'granted') return;

    let active = true;
    let stream = null;
    let scanInterval = null;
    let detector = null;
    let zxingReader = null;
    let canvas = null;
    let video = null;
    let parent = null;

    const init = async () => {
      // Wait for DOM element to be ready
      let attempts = 0;
      while (!document.getElementById(elementId) && attempts < 20 && active) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      parent = document.getElementById(elementId);
      if (!parent || !active) return;

      try {
        // Create video element
        video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        parent.innerHTML = ''; // clear parent loading/old elements
        parent.appendChild(video);

        // Create hidden canvas for WASM fallback
        canvas = document.createElement('canvas');
        canvas.style.display = 'none';
        parent.appendChild(canvas);

        // Start video stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        video.srcObject = stream;

        // Check native support
        if ('BarcodeDetector' in window) {
          try {
            detector = new window.BarcodeDetector({
              formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
            });
          } catch (e) {
            console.warn('Native BarcodeDetector fallback:', e);
          }
        }

        if (!detector) {
          try {
            const { readBarcodes } = await import('zxing-wasm');
            zxingReader = readBarcodes;
          } catch (err) {
            console.error('Failed to load zxing-wasm:', err);
            return;
          }
        }

        // Start scanning loop (every 150ms)
        scanInterval = setInterval(async () => {
          if (!active || !video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

          try {
            let detectedCodes = [];

            if (detector) {
              const barcodes = await detector.detect(video);
              detectedCodes = barcodes.map(b => b.rawValue);
            } else if (zxingReader) {
              const ctx = canvas.getContext('2d');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const results = await zxingReader(imageData, {
                formats: ['Code128', 'EAN13', 'EAN8', 'QRCode', 'UPCA', 'UPCE'],
                tryHarder: false
              });
              detectedCodes = results.map(r => r.text);
            }

            for (const rawCode of detectedCodes) {
              if (!rawCode) continue;
              const code = rawCode.trim();
              const lowerCode = code.toLowerCase();

              // Unique barcode checking
              if (!scannedCodesRef.current.has(lowerCode)) {
                scannedCodesRef.current.add(lowerCode);

                // Beep and vibration feedback
                playBeep();
                if (typeof window !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate(100);
                }

                // Call client onScan callback via ref — no camera restart needed
                if (onScanRef.current) onScanRef.current(code);
              }
            }
          } catch (e) {
            // Ignore scan loop errors
          }
        }, 150);
      } catch (err) {
        console.error('Failed to init camera or scanner:', err);
      }
    };

    init();

    return () => {
      active = false;
      if (scanInterval) clearInterval(scanInterval);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (parent && video && parent.contains(video)) {
        parent.removeChild(video);
      }
      if (parent && canvas && parent.contains(canvas)) {
        parent.removeChild(canvas);
      }
      streamRef.current = null;
      // Reset seen codes so reopening the modal scans fresh
      scannedCodesRef.current.clear();
    };
  // onScan intentionally excluded — we use onScanRef to avoid camera restarts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementId, isOpen, cameraPermissionStatus]);

  const retryCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermissionStatus('granted');
    } catch (e) {
      setCameraPermissionStatus('denied');
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  return { cameraPermissionStatus, retryCameraPermission, stop };
}
