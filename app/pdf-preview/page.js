'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { ArrowLeft, Download, FileText, Loader2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

function PDFPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const pdfUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Delivery Note';

  const [loading, setLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [includeImages, setIncludeImages] = useState(false);

  const isValidPdfUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    // Only allow internal API endpoints generating PDFs
    return trimmed.startsWith('/api/dashboard/') && !trimmed.startsWith('//');
  };

  const getEffectivePdfUrl = () => {
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
  };

  const fetchPDF = async () => {
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

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
        throw new Error('The returned document is not a valid PDF.');
      }

      const blob = await response.blob();
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
  };

  useEffect(() => {
    fetchPDF();
  }, [pdfUrl, includeImages]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center flex flex-col items-center gap-3 text-gray-500">
          <FileText size={48} />
          <p className="text-lg font-bold">No PDF URL provided.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={15} color="#2563eb" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{title}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Images toggle button */}
          <button
            type="button"
            onClick={() => setIncludeImages(!includeImages)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: includeImages ? '1.5px solid #0f766e' : '1px solid #cbd5e1',
              background: includeImages ? '#f0fdfa' : '#fff',
              color: includeImages ? '#0f766e' : '#475569',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: includeImages ? 'none' : '1.5px solid #94a3b8',
                background: includeImages ? '#0f766e' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 800
              }}
            >
              {includeImages ? '✓' : ''}
            </div>
            <span>Product Photos: {includeImages ? 'ON' : 'OFF'}</span>
          </button>

          {blobUrl && (
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', textDecoration: 'none' }}
            >
              <ExternalLink size={14} />
              Open in Tab
            </a>
          )}
          {blobUrl && (
            <a
              href={blobUrl}
              download={`${title}${includeImages ? '-WithImages' : ''}.pdf`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '13px', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 1px 2px rgba(37,99,235,0.2)' }}
            >
              <Download size={14} />
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* PDF area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#64748b' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 10, gap: '14px' }}>
            <Loader2 size={38} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>Rendering document preview, please wait...</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 10, padding: '24px' }}>
            <div style={{ maxWidth: '440px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={28} color="#dc2626" />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Unable to Load Document</h3>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>{error}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  onClick={fetchPDF}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
                <button
                  onClick={() => router.back()}
                  style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {blobUrl && !loading && !error && (
          <object
            data={`${blobUrl}#view=FitH`}
            type="application/pdf"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          >
            <iframe
              src={`${blobUrl}#view=FitH`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title={title}
            >
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#334155', color: '#fff', padding: '30px', textAlign: 'center' }}>
                <p style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 600 }}>Your browser does not support inline PDF previews.</p>
                <a
                  href={blobUrl}
                  download={`${title}.pdf`}
                  style={{ display: 'inline-block', padding: '10px 20px', background: '#2563eb', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}
                >
                  Download PDF Instead
                </a>
              </div>
            </iframe>
          </object>
        )}
      </div>
    </div>
  );
}

export default function PDFPreviewPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#64748b' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading Preview...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    }>
      <PDFPreviewContent />
    </Suspense>
  );
}
