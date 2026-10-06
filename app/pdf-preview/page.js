'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  Loader2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Check, 
  Image as ImageIcon 
} from 'lucide-react';

function PDFPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const pdfUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Delivery Note';

  const [loading, setLoading] = useState(true);
  const [renderingPages, setRenderingPages] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [rawPdfData, setRawPdfData] = useState(null);
  const [error, setError] = useState(null);
  const [includeImages, setIncludeImages] = useState(false);
  
  // PDF Rendering state
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' (mobile & universal) | 'native' (desktop embed)
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef(null);
  const canvasRefs = useRef([]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('canvas');
        setScale(1.0);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isValidPdfUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('/api/dashboard/') && !trimmed.startsWith('//');
  };

  const getEffectivePdfUrl = useCallback(() => {
    if (!pdfUrl) return '';
    try {
      const u = new URL(pdfUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      if (includeImages) {
        u.searchParams.set('images', '1');
      } else {
        u.searchParams.delete('images');
        u.searchParams.delete('showImages');
      }
      return u.pathname + u.search;
    } catch {
      return pdfUrl + (includeImages ? (pdfUrl.includes('?') ? '&images=1' : '?images=1') : '');
    }
  }, [pdfUrl, includeImages]);

  // Fetch the PDF binary buffer
  const fetchPDF = useCallback(async () => {
    const effectiveUrl = getEffectivePdfUrl();
    if (!effectiveUrl) return;
    if (!isValidPdfUrl(effectiveUrl)) {
      setError('Invalid or untrusted PDF document URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(effectiveUrl);
      if (!response.ok) {
        let errMessage = `Error ${response.status}: ${response.statusText}`;
        try {
          const json = await response.json();
          if (json.error || json.message) errMessage = json.error || json.message;
        } catch {
          const text = await response.text();
          if (text) errMessage = text;
        }
        throw new Error(errMessage);
      }

      const arrayBuffer = await response.arrayBuffer();
      setRawPdfData(arrayBuffer);

      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(err.message || 'Failed to load PDF preview');
    } finally {
      setLoading(false);
    }
  }, [getEffectivePdfUrl]);

  useEffect(() => {
    fetchPDF();
  }, [fetchPDF]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Render PDF pages onto HTML5 canvas elements
  useEffect(() => {
    if (!rawPdfData || viewMode !== 'canvas') return;

    let isCancelled = false;

    const renderPdfToCanvas = async () => {
      setRenderingPages(true);
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
        
        // Point to the local worker file in /public/pdf.worker.min.js
        if (typeof window !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        }

        // Make a clone of the ArrayBuffer for PDF.js to consume
        const dataCopy = rawPdfData.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        const pdfDoc = await loadingTask.promise;

        if (isCancelled) return;
        setNumPages(pdfDoc.numPages);

        // Render each page sequentially
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (isCancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          const canvas = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;

          // Responsive viewport scaling
          const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
          const baseViewport = page.getViewport({ scale: 1.0 });
          
          // Fit comfortably inside container with padding
          const autoFitScale = Math.min((containerWidth - 32) / baseViewport.width, 1.4);
          const targetScale = (scale || 1.0) * (autoFitScale > 0 ? autoFitScale : 1.0);
          
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Sharp Retina resolution
          const viewport = page.getViewport({ scale: targetScale });

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;

          const ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };

          await page.render(renderContext).promise;
        }
      } catch (e) {
        console.error('PDF.js Canvas render error:', e);
      } finally {
        if (!isCancelled) {
          setRenderingPages(false);
        }
      }
    };

    renderPdfToCanvas();

    return () => {
      isCancelled = true;
    };
  }, [rawPdfData, scale, viewMode]);

  const handleZoomIn = () => setScale((s) => Math.min(Number((s + 0.2).toFixed(1)), 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(Number((s - 0.2).toFixed(1)), 0.6));
  const handleZoomReset = () => setScale(1.0);

  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center flex flex-col items-center gap-3 text-slate-500 max-w-sm">
          <FileText size={48} className="text-slate-400" />
          <p className="text-base font-bold text-slate-700">No PDF URL provided.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-100 select-none">
      
      {/* Top Primary Navigation Bar */}
      <header className="flex-none bg-white text-slate-800 border-b border-slate-200 px-3 py-2 sm:px-5 sm:py-2.5 shadow-sm z-30">
        <div className="flex items-center justify-between gap-2 max-w-full">
          
          {/* Left: Back Button & Truncated Document Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-all text-xs sm:text-sm font-semibold shadow-xs shrink-0"
              title="Go Back"
            >
              <ArrowLeft size={15} />
              <span className="hidden xs:inline">Back</span>
            </button>

            <div className="h-4 w-px bg-slate-200 shrink-0 hidden xs:block" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={15} />
              </div>
              <h1 className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[320px] md:max-w-md" title={title}>
                {title}
              </h1>
            </div>
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-medium transition-all shadow-xs"
                title="Open raw PDF in new browser tab"
              >
                <ExternalLink size={14} />
                <span className="hidden md:inline">Open in Tab</span>
              </a>
            )}

            {blobUrl && (
              <a
                href={blobUrl}
                download={`${title}${includeImages ? '-WithImages' : ''}.pdf`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs active:scale-95"
                title="Download PDF"
              >
                <Download size={14} />
                <span className="hidden xs:inline">Download</span>
              </a>
            )}
          </div>

        </div>
      </header>

      {/* Sub-Header: Secondary Toolbar (Controls, Photos Toggle, Zoom) */}
      <section className="flex-none bg-slate-800 border-b border-slate-700/80 px-3 py-1.5 sm:px-5 flex items-center justify-between gap-2 z-20 text-xs overflow-x-auto scrollbar-none">
        
        {/* Left: Product Images Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIncludeImages(!includeImages)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              includeImages
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                : 'bg-slate-700/60 text-slate-300 border-slate-600 hover:bg-slate-700'
            }`}
            title="Toggle high-quality product images in the PDF"
          >
            <ImageIcon size={13} />
            <span>Product Photos</span>
            <span className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
              includeImages ? 'bg-emerald-500 text-slate-950' : 'bg-slate-600 text-slate-300'
            }`}>
              {includeImages ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Right: View & Zoom Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {numPages > 0 && viewMode === 'canvas' && (
            <span className="text-slate-400 text-[11px] sm:text-xs font-mono mr-1">
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </span>
          )}

          {viewMode === 'canvas' && (
            <div className="inline-flex items-center bg-slate-700/80 rounded-lg p-0.5 border border-slate-600/80">
              <button
                onClick={handleZoomOut}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              
              <button
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-[11px] font-mono text-slate-200 hover:bg-slate-600 rounded transition-colors"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>

              <button
                onClick={handleZoomIn}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          )}

          {!isMobile && blobUrl && (
            <button
              onClick={() => setViewMode(viewMode === 'canvas' ? 'native' : 'canvas')}
              className="hidden lg:inline-flex items-center gap-1 px-2 py-1 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded text-[11px] font-medium transition-colors"
              title="Switch between Canvas render and Browser Plugin"
            >
              <Maximize2 size={12} />
              <span>{viewMode === 'canvas' ? 'Native Viewer' : 'Canvas Mode'}</span>
            </button>
          )}
        </div>

      </section>

      {/* Main Document Display Area */}
      <main 
        ref={containerRef}
        className="flex-1 relative overflow-y-auto overflow-x-auto bg-slate-900 flex flex-col items-center p-3 sm:p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
      >
        {/* Loading Overlay */}
        {(loading || renderingPages) && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 p-4">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-200 text-center">
              {loading ? 'Fetching PDF document...' : 'Rendering document preview...'}
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 z-30">
            <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 text-center flex flex-col items-center gap-3 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                <AlertCircle size={26} />
              </div>
              <h2 className="text-base font-bold text-white">Unable to Load Preview</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{error}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={fetchPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <RefreshCw size={13} />
                  Try Again
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. Universal Canvas Rendering (Works on iPhone, iPad, Android, Mac, Windows) */}
        {blobUrl && !error && viewMode === 'canvas' && (
          <div className="flex flex-col items-center gap-4 sm:gap-6 my-auto max-w-full">
            {Array.from({ length: numPages || 1 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-700/50 transition-transform duration-150"
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[idx] = el;
                  }}
                  className="block mx-auto max-w-full"
                />
              </div>
            ))}
          </div>
        )}

        {/* 2. Native Desktop Embed (Optional toggle for desktop users) */}
        {blobUrl && !error && viewMode === 'native' && (
          <object
            data={`${blobUrl}#view=FitH`}
            type="application/pdf"
            className="w-full h-full rounded-lg border-0 shadow-lg"
          >
            <iframe
              src={`${blobUrl}#view=FitH`}
              className="w-full h-full border-0 rounded-lg"
              title={title}
            />
          </object>
        )}

      </main>

    </div>
  );
}

export default function PDFPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
            <p className="text-sm font-semibold">Loading Document Preview...</p>
          </div>
        </div>
      }
    >
      <PDFPreviewContent />
    </Suspense>
  );
}
