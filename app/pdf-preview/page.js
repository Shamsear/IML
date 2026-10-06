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
  Image as ImageIcon 
} from 'lucide-react';

function PDFPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const pdfUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Delivery Note';

  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [rawPdfData, setRawPdfData] = useState(null);
  const [error, setError] = useState(null);
  const [includeImages, setIncludeImages] = useState(false);
  
  // PDF Rendering state
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);

  const containerRef = useRef(null);
  const canvasRefs = useRef([]);
  const renderTasksRef = useRef([]);

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
    setRendering(true);
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
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setRawPdfData(arrayBuffer);
    } catch (err) {
      setError(err.message || 'Failed to load PDF preview');
      setRendering(false);
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
    if (!rawPdfData) return;

    let isCancelled = false;

    // Cancel any previous ongoing render tasks
    renderTasksRef.current.forEach((task) => {
      try {
        if (task && typeof task.cancel === 'function') {
          task.cancel();
        }
      } catch {}
    });
    renderTasksRef.current = [];

    const renderPdfToCanvas = async () => {
      setRendering(true);
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
        
        if (typeof window !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        }

        const dataCopy = rawPdfData.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
        const pdfDoc = await loadingTask.promise;

        if (isCancelled) return;
        setNumPages(pdfDoc.numPages);

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (isCancelled) break;
          const page = await pdfDoc.getPage(pageNum);
          const canvas = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;

          const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
          const baseViewport = page.getViewport({ scale: 1.0 });
          
          // Auto-fit calculation (max 850px standard A4 preview width on desktop, full width minus padding on mobile)
          const maxAllowedWidth = Math.min(containerWidth - 32, 900);
          const autoFitScale = maxAllowedWidth / baseViewport.width;
          const targetScale = scale * (autoFitScale > 0 ? autoFitScale : 1.0);
          
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // High-DPI Retina
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

          const renderTask = page.render(renderContext);
          renderTasksRef.current.push(renderTask);

          try {
            await renderTask.promise;
          } catch (renderErr) {
            if (renderErr?.name !== 'RenderingCancelledException') {
              console.error('Page render error:', renderErr);
            }
          }
        }
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') {
          console.error('PDF.js Canvas render error:', e);
        }
      } finally {
        if (!isCancelled) {
          setRendering(false);
        }
      }
    };

    renderPdfToCanvas();

    return () => {
      isCancelled = true;
      renderTasksRef.current.forEach((task) => {
        try {
          if (task && typeof task.cancel === 'function') task.cancel();
        } catch {}
      });
    };
  }, [rawPdfData, scale]);

  const handleZoomIn = () => setScale((s) => Math.min(Number((s + 0.15).toFixed(2)), 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(Number((s - 0.15).toFixed(2)), 0.6));
  const handleZoomReset = () => setScale(1.0);

  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="text-center flex flex-col items-center gap-3 text-slate-400 max-w-sm">
          <FileText size={48} className="text-slate-500" />
          <p className="text-base font-bold text-slate-200">No PDF URL provided.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors shadow-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      
      {/* Unified Modern Top Header Bar */}
      <header className="flex-none bg-slate-900 border-b border-slate-800 px-3 py-2 sm:px-5 sm:py-2.5 shadow-md z-30">
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto w-full">
          
          {/* Left: Back Button & Document Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition-all text-xs sm:text-sm font-semibold shadow-xs shrink-0"
              title="Go Back"
            >
              <ArrowLeft size={15} />
              <span className="hidden xs:inline">Back</span>
            </button>

            <div className="h-4 w-px bg-slate-800 shrink-0 hidden xs:block" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <FileText size={15} />
              </div>
              <h1 className="font-bold text-xs sm:text-sm text-slate-100 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-[320px] md:max-w-md" title={title}>
                {title}
              </h1>
            </div>
          </div>

          {/* Center (Desktop / Tablet Controls): Photos Toggle & Zoom */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {/* Photos Toggle */}
            <button
              type="button"
              onClick={() => setIncludeImages(!includeImages)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                includeImages
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
              title="Toggle high-quality product photos"
            >
              <ImageIcon size={13} className={includeImages ? 'text-emerald-400' : 'text-slate-400'} />
              <span>Product Photos</span>
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                includeImages ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {includeImages ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Zoom Controls */}
            <div className="inline-flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={handleZoomOut}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              
              <button
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-[11px] font-mono text-slate-200 hover:bg-slate-700 rounded transition-colors"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>

              <button
                onClick={handleZoomIn}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            {numPages > 0 && (
              <span className="text-slate-400 text-xs font-mono">
                {numPages} {numPages === 1 ? 'page' : 'pages'}
              </span>
            )}
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {blobUrl && (
              <a
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs sm:text-sm font-medium transition-all shadow-xs"
                title="Open in new tab"
              >
                <ExternalLink size={14} />
                <span className="hidden md:inline">Open in Tab</span>
              </a>
            )}

            {blobUrl && (
              <a
                href={blobUrl}
                download={`${title}${includeImages ? '-WithImages' : ''}.pdf`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95"
                title="Download PDF"
              >
                <Download size={14} />
                <span className="hidden xs:inline">Download</span>
              </a>
            )}
          </div>

        </div>

        {/* Mobile Sub-Row (Visible on screens < sm) */}
        <div className="flex sm:hidden items-center justify-between pt-2 mt-2 border-t border-slate-800 text-xs">
          {/* Mobile Photos Toggle */}
          <button
            type="button"
            onClick={() => setIncludeImages(!includeImages)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
              includeImages
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <ImageIcon size={12} className={includeImages ? 'text-emerald-400' : 'text-slate-400'} />
            <span>Photos: {includeImages ? 'ON' : 'OFF'}</span>
          </button>

          {/* Mobile Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={handleZoomOut}
                className="p-1 text-slate-300 hover:text-white rounded"
                title="Zoom Out"
              >
                <ZoomOut size={12} />
              </button>
              
              <button
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-[11px] font-mono text-slate-200 rounded"
                title="Reset Zoom"
              >
                {Math.round(scale * 100)}%
              </button>

              <button
                onClick={handleZoomIn}
                className="p-1 text-slate-300 hover:text-white rounded"
                title="Zoom In"
              >
                <ZoomIn size={12} />
              </button>
            </div>

            {numPages > 0 && (
              <span className="text-slate-400 text-[11px] font-mono">
                {numPages}p
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Document Display Area */}
      <main 
        ref={containerRef}
        className="flex-1 relative overflow-y-auto overflow-x-auto bg-slate-950 flex flex-col items-center p-3 sm:p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950"
      >
        {/* Full-Screen Loading State (Before PDF buffer is loaded) */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center my-auto">
            <Loader2 size={36} className="text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-300">
              Generating document preview...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 my-auto">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center flex flex-col items-center gap-3 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center">
                <AlertCircle size={26} />
              </div>
              <h2 className="text-base font-bold text-white">Unable to Load Preview</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{error}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={fetchPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  <RefreshCw size={13} />
                  Try Again
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Universal Crisp Canvas Rendering */}
        {blobUrl && !error && !loading && (
          <div className="flex flex-col items-center gap-4 sm:gap-6 my-auto max-w-full">
            {Array.from({ length: numPages || 1 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-sm shadow-2xl overflow-hidden border border-slate-800 transition-all"
                style={{
                  minHeight: rendering ? '400px' : 'auto',
                  minWidth: rendering ? '280px' : 'auto'
                }}
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

      </main>

    </div>
  );
}

export default function PDFPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
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
