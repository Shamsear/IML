'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Reusable barcode scanner hook using html5-qrcode.
 * Handles camera permission, initialization, dedup, laser overlay, and cleanup.
 *
 * @param {Object} options
 * @param {string} options.elementId - DOM element ID for the scanner
 * @param {boolean} options.isOpen - Whether the scanner modal is open
 * @param {Function} options.onScan - Called with decoded text on successful scan
 * @param {Object} [options.config] - Scanner config override
 * @param {string} [options.laserContainerSelector] - Selector for the video container to inject laser overlay
 */
export default function useBarcodeScanner({
  elementId = 'camera-reader-element',
  isOpen = false,
  onScan,
  config = {},
  laserContainerSelector = '#camera-reader-element video',
}) {
  const scannerRef = useRef(null);
  const lastScannedRef = useRef('');
  const lastTimeRef = useRef(0);
  const [cameraPermissionStatus, setCameraPermissionStatus] = useState('prompt');

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

  // 2. Scanner initialization
  useEffect(() => {
    if (!isOpen || cameraPermissionStatus !== 'granted') return;

    let cancelled = false;
    let scanner = null;

    const init = async () => {
      // Wait for DOM element to be ready
      let attempts = 0;
      while (!document.getElementById(elementId) && attempts < 10 && !cancelled) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (cancelled || !document.getElementById(elementId)) return;

      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        if (cancelled) return;

        scanner = new Html5QrcodeScanner(
          elementId,
          { fps: 10, qrbox: { width: 250, height: 250 }, ...config },
          false
        );

        scanner.render(
          (decodedText) => {
            const code = decodedText.trim();
            const now = Date.now();

            // Deduplicate within 2 seconds
            if (
              code.toLowerCase() === lastScannedRef.current &&
              now - lastTimeRef.current < 2000
            ) {
              return;
            }

            lastScannedRef.current = code.toLowerCase();
            lastTimeRef.current = now;

            // Flash feedback
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

            if (onScan) onScan(code);
          },
          () => {} // Ignore scanning errors
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Failed to init barcode scanner:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (scanner) {
        try {
          scanner.clear();
        } catch (err) {
          console.error('Failed to clear scanner:', err);
        }
      }
      scannerRef.current = null;
    };
  }, [elementId, isOpen, cameraPermissionStatus, onScan, config]);

  // 3. Inject scan laser overlay
  useEffect(() => {
    if (cameraPermissionStatus !== 'granted') return;

    const interval = setInterval(() => {
      const videoElement = document.querySelector(laserContainerSelector);
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
  }, [cameraPermissionStatus, laserContainerSelector]);

  // 4. Retry camera permission
  const retryCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermissionStatus('granted');
    } catch (e) {
      setCameraPermissionStatus('denied');
    }
  }, []);

  // 5. Manual stop
  const stop = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
      scannerRef.current = null;
    }
  }, []);

  return { cameraPermissionStatus, retryCameraPermission, stop };
}
