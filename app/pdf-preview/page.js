'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';

function PDFPreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  const pdfUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Delivery Note';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f3f4f6' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.back()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'none', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: 500 }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <span style={{ color: '#d1d5db' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>{title}</span>
          </div>
        </div>

        <a
          href={pdfUrl}
          download
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '13px', borderRadius: '8px', textDecoration: 'none' }}
        >
          <Download size={14} />
          Download PDF
        </a>
      </div>

      {/* PDF area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Loading overlay */}
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', zIndex: 10, gap: '12px' }}>
            <Loader2 size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Generating PDF, please wait...</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <iframe
          src={pdfUrl}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title={title}
        />
      </div>
    </div>
  );
}

export default function PDFPreviewPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#6b7280' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: '14px', fontWeight: 500 }}>Loading...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    }>
      <PDFPreviewContent />
    </Suspense>
  );
}
