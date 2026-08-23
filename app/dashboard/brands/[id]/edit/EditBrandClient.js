'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateBrand } from '@/app/actions/brands';
import { ArrowLeft, Loader2, X, Camera, Save } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ConfirmModal from '@/components/ConfirmModal';
import FormFooter from '@/components/FormFooter';

export default function EditBrandClient({ brand }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Single Brand Item state
  const [item, setItem] = useState({
    id: brand.id,
    name: brand.name,
    description: brand.description || '',
    imageUrl: brand.imageUrl || '',
    logoFile: null,
    logoPreview: '',
    rack: brand.rack || '',
    shelf: brand.shelf || '',
    isPublic: brand.isPublic,
  });

  // Image Cropping Modal states
  const [cropping, setCropping] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropDimensions, setCropDimensions] = useState({ width: 320, height: 320 });
  const [originalFile, setOriginalFile] = useState(null);
  const cropImageRef = useRef(null);

  const handleDrag = (dx, dy) => {
    setCropX(prev => {
      const next = prev + dx;
      const maxOffset = Math.max(0, (cropDimensions.width * cropZoom - 320) / 2);
      return Math.min(maxOffset, Math.max(-maxOffset, next));
    });
    setCropY(prev => {
      const next = prev + dy;
      const maxOffset = Math.max(0, (cropDimensions.height * cropZoom - 320) / 2);
      return Math.min(maxOffset, Math.max(-maxOffset, next));
    });
  };

  const handleSaveCrop = () => {
    if (!originalFile || !cropImageRef.current) return;

    const img = cropImageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const centerX = (320 - cropDimensions.width * cropZoom) / 2;
    const centerY = (320 - cropDimensions.height * cropZoom) / 2;

    const sx = - (centerX + cropX) / (cropDimensions.width * cropZoom) * imgWidth;
    const sy = - (centerY + cropY) / (cropDimensions.height * cropZoom) * imgHeight;
    const sw = (320 / (cropDimensions.width * cropZoom)) * imgWidth;
    const sh = (320 / (cropDimensions.height * cropZoom)) * imgHeight;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 500, 500);

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], originalFile.name, {
          type: originalFile.type,
          lastModified: Date.now()
        });

        setItem(prev => ({
          ...prev,
          logoFile: croppedFile,
          logoPreview: URL.createObjectURL(croppedFile),
        }));

        setCropping(false);
        setCropSrc('');
        setOriginalFile(null);
      }
    }, originalFile.type || 'image/jpeg', 0.95);
  };

  const updateField = (field, value) => {
    setItem(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!item.name.trim()) {
      setError('Brand name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', item.name);
      formData.append('description', item.description);
      formData.append('imageUrl', item.imageUrl);
      formData.append('rack', item.rack);
      formData.append('shelf', item.shelf);
      if (item.logoFile) {
        formData.append('imageFile', item.logoFile);
      }
      formData.append('isPublic', item.isPublic.toString());

      await updateBrand(item.id, formData);
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link href="/dashboard/brands" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Edit Brand
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Modify brand guidelines, logo, and settings for {brand.name}.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-4 text-sm font-semibold text-center animate-slide-down">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Brand Name</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              value={item.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Virgin Mobile"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Logo Image</label>
            <div className="flex items-center gap-3">
              {(item.logoPreview || item.imageUrl) && (
                <div className="relative group">
                  <div className="w-[42px] h-[42px] rounded-sm border border-border bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img src={item.logoPreview || getOptimizedImageUrl(item.imageUrl, 60, 60)} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              )}
              <label className="flex-1 flex items-center justify-center gap-1.5 h-[42px] border-2 border-dashed border-border hover:border-primary/50 rounded-lg bg-surface-elevated/30 hover:bg-surface-elevated/60 cursor-pointer transition-all group">
                <Camera size={13} className="text-text-muted group-hover:text-primary transition-colors" />
                <span className="text-[11px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors">{item.logoFile?.name ? 'Change logo' : 'Upload logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setOriginalFile(file);
                      setCropSrc(URL.createObjectURL(file));
                      setCropping(true);
                      setCropZoom(1);
                      setCropX(0);
                      setCropY(0);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Default Warehouse Rack (Optional)</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              value={item.rack}
              onChange={(e) => updateField('rack', e.target.value)}
              placeholder="e.g. Rack A"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Default Warehouse Shelf (Optional)</label>
            <input
              type="text"
              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
              value={item.shelf}
              onChange={(e) => updateField('shelf', e.target.value)}
              placeholder="e.g. Shelf 3"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Description</label>
          <textarea
            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            value={item.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Describe brand guidelines or specifications."
            rows={3}
          />
        </div>

        <FormFooter cancelHref="/dashboard/brands" submitLabel="Save Changes" loading={loading} editMode />
      </form>

      {/* Image Cropping Modal */}
      {cropping && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-extrabold text-sm text-text-primary uppercase tracking-wider">Crop Brand Logo</h3>
              <button
                type="button"
                className="p-1 text-text-muted hover:text-text-primary rounded-md transition-colors"
                onClick={() => {
                  setCropping(false);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-text-secondary leading-relaxed">
              Drag the image to adjust alignment. Scroll or pinch to zoom. The logo will crop into a square container.
            </div>

            {/* Cropping Area */}
            <div 
              className="relative w-80 h-80 mx-auto rounded-xl overflow-hidden border border-border bg-[#1a1918] cursor-move select-none flex items-center justify-center"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                setDragStart({ x: e.clientX, y: e.clientY });
                handleDrag(dx, dy);
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={(e) => {
                e.preventDefault();
                const zoomFactor = 0.05;
                const nextZoom = e.deltaY < 0 ? Math.min(3, cropZoom + zoomFactor) : Math.max(1, cropZoom - zoomFactor);
                setCropZoom(nextZoom);
                const maxOffsetX = Math.max(0, (cropDimensions.width * nextZoom - 320) / 2);
                const maxOffsetY = Math.max(0, (cropDimensions.height * nextZoom - 320) / 2);
                setCropX(prev => Math.min(maxOffsetX, Math.max(-maxOffsetX, prev)));
                setCropY(prev => Math.min(maxOffsetY, Math.max(-maxOffsetY, prev)));
              }}
            >
              {/* Overlay Grid lines */}
              <div className="absolute inset-0 border border-white/20 pointer-events-none z-10 flex items-center justify-center">
                <div className="w-full h-[1px] bg-white/10 absolute"></div>
                <div className="w-[1px] h-full bg-white/10 absolute"></div>
                <div className="w-72 h-72 rounded-lg border border-dashed border-white/30 absolute"></div>
              </div>

              <img
                ref={cropImageRef}
                src={cropSrc}
                alt="Crop Target"
                className="max-w-none pointer-events-none absolute"
                style={{
                  width: `${cropDimensions.width * cropZoom}px`,
                  height: `${cropDimensions.height * cropZoom}px`,
                  left: `calc(50% + ${cropX}px)`,
                  top: `calc(50% + ${cropY}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
                onLoad={(e) => {
                  const img = e.target;
                  const naturalW = img.naturalWidth;
                  const naturalH = img.naturalHeight;

                  let renderW = 320;
                  let renderH = 320;

                  if (naturalW > naturalH) {
                    renderH = 320;
                    renderW = (naturalW / naturalH) * 320;
                  } else {
                    renderW = 320;
                    renderH = (naturalH / naturalW) * 320;
                  }

                  setCropDimensions({ width: renderW, height: renderH });
                }}
              />
            </div>

            {/* Slider zoom */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-2xs font-bold text-text-secondary uppercase">
                <span>Zoom Level</span>
                <span className="font-mono text-primary font-bold">x{cropZoom.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = parseFloat(e.target.value);
                  setCropZoom(nextZoom);
                  const maxOffsetX = Math.max(0, (cropDimensions.width * nextZoom - 320) / 2);
                  const maxOffsetY = Math.max(0, (cropDimensions.height * nextZoom - 320) / 2);
                  setCropX(prev => Math.min(maxOffsetX, Math.max(-maxOffsetX, prev)));
                  setCropY(prev => Math.min(maxOffsetY, Math.max(-maxOffsetY, prev)));
                }}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Footer controls */}
            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold bg-surface border border-border text-text-secondary hover:text-text-primary rounded-lg transition-colors"
                onClick={() => {
                  setCropping(false);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors shadow-sm"
              >
                Crop &amp; Save Image
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/brands'); }}
        type="success"
        title="Brand Updated"
        message="Brand details have been saved successfully."
      />
    </div>
  );
}
