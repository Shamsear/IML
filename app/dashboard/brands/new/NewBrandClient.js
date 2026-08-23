'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBulkBrands } from '@/app/actions/brands';
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, X, Camera } from 'lucide-react';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import ConfirmModal from '@/components/ConfirmModal';
import FormFooter from '@/components/FormFooter';

export default function NewBrandClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });

  // Queue item creator helper
  const createEmptyBrandItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    description: '',
    imageUrl: '',
    logoFile: null,
    logoPreview: '',
    rack: '',
    shelf: '',
    isPublic: true,
    isExpanded: true,
    error: '',
  });

  // State array for brands queue
  const [items, setItems] = useState([createEmptyBrandItem(0)]);

  // Image Cropping Modal states
  const [croppingIdx, setCroppingIdx] = useState(null);
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
    if (croppingIdx === null || !originalFile || !cropImageRef.current) return;

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

        updateItemField(croppingIdx, 'logoFile', croppedFile);
        updateItemField(croppingIdx, 'logoPreview', URL.createObjectURL(croppedFile));

        setCroppingIdx(null);
        setCropSrc('');
        setOriginalFile(null);
      }
    }, originalFile.type || 'image/jpeg', 0.95);
  };

  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyBrandItem(prev.length)));
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (!item.name.trim()) {
      updateItemField(idx, 'error', 'Brand name is required');
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyBrandItem(0)];
      }
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.some(item => item.isExpanded)) {
        updated[updated.length - 1].isExpanded = true;
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    for (let i = 0; i < items.length; i++) {
      if (!items[i].name.trim()) {
        updateItemField(i, 'error', 'Brand name is required');
        handleExpandItem(i);
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('count', items.length.toString());
      items.forEach((item, idx) => {
        formData.append(`item_${idx}_name`, item.name);
        formData.append(`item_${idx}_description`, item.description);
        formData.append(`item_${idx}_rack`, item.rack);
        formData.append(`item_${idx}_shelf`, item.shelf);
        formData.append(`item_${idx}_isPublic`, item.isPublic.toString());
        if (item.logoFile) {
          formData.append(`item_${idx}_imageFile`, item.logoFile);
        } else if (item.imageUrl) {
          formData.append(`item_${idx}_imageUrl`, item.imageUrl);
        }
      });
      await createBulkBrands(formData);
      setConfirmData({ title: 'Brand Created', message: `${items.length} brand(s) registered successfully.` });
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/brands" className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
              Register New Brands
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Add one or multiple brand owner profiles to your inventory system.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-4 text-sm font-semibold text-center animate-slide-down">
          {error}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/brands'); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
            <div 
              key={item.id}
              className={`bg-surface border rounded-xl transition-all duration-200 overflow-hidden
                ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
              `}
            >
              {/* 1. COLLAPSED VIEW CARD */}
              {!item.isExpanded && (
                <div 
                  onClick={() => handleExpandItem(idx)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {item.logoPreview || item.imageUrl ? (
                      <div className="w-10 h-10 rounded-sm overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
                        <img src={item.logoPreview || getOptimizedImageUrl(item.imageUrl, 80, 80)} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-muted flex-shrink-0">
                        <Camera size={16} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-text-primary truncate block">
                        {item.name || <span className="text-text-muted italic">Unnamed Brand</span>}
                      </span>
                      <span className="text-[10px] text-text-secondary block mt-0.5 truncate max-w-xs">
                        {item.description || 'No description added'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleExpandItem(idx)}
                        className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. EXPANDED VIEW CARD */}
              {item.isExpanded && (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-2xs font-bold text-primary uppercase tracking-wider">Brand Entry #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {item.error && (
                    <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2.5 text-xs font-semibold">
                      {item.error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Brand Name</label>
                      <input
                        type="text"
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                        value={item.name}
                        onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                        placeholder="e.g. Virgin Mobile"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Logo Image</label>
                      {(item.logoPreview || item.imageUrl) ? (
                        <div className="relative group">
                          <div className="w-full h-[42px] rounded-sm border border-border bg-white overflow-hidden flex items-center justify-center">
                            <img src={item.logoPreview || getOptimizedImageUrl(item.imageUrl, 200, 200)} alt="Preview" className="max-h-full max-w-full object-contain px-1" />
                          </div>
                          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <label className="px-2 py-0.5 bg-white text-text-primary text-[10px] font-bold rounded cursor-pointer hover:bg-gray-100 transition-colors shadow-sm">
                              Change
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    setOriginalFile(file);
                                    setCropSrc(URL.createObjectURL(file));
                                    setCroppingIdx(idx);
                                    setCropZoom(1);
                                    setCropX(0);
                                    setCropY(0);
                                  }
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                updateItemField(idx, 'logoFile', null);
                                updateItemField(idx, 'logoPreview', '');
                                updateItemField(idx, 'imageUrl', '');
                              }}
                              className="px-2 py-0.5 bg-white text-danger text-[10px] font-bold rounded hover:bg-red-50 transition-colors shadow-sm"
                            >
                              Remove
                            </button>
                          </div>
                          <span className="text-[10px] text-text-secondary mt-0.5 truncate block">{item.logoFile?.name || 'Current logo'}</span>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 w-full h-[42px] border-2 border-dashed border-border hover:border-primary/50 rounded-lg bg-surface-elevated/30 hover:bg-surface-elevated/60 cursor-pointer transition-all group">
                          <Camera size={14} className="text-text-muted group-hover:text-primary transition-colors" />
                          <span className="text-[11px] font-semibold text-text-secondary group-hover:text-text-primary transition-colors">Click to upload logo</span>
                          <span className="text-[10px] text-text-muted">PNG, JPG up to 5MB</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setOriginalFile(file);
                                setCropSrc(URL.createObjectURL(file));
                                setCroppingIdx(idx);
                                setCropZoom(1);
                                setCropX(0);
                                setCropY(0);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Default Warehouse Rack (Optional)</label>
                      <input
                        type="text"
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        value={item.rack || ''}
                        onChange={(e) => updateItemField(idx, 'rack', e.target.value)}
                        placeholder="e.g. Rack A"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary">Default Warehouse Shelf (Optional)</label>
                      <input
                        type="text"
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        value={item.shelf || ''}
                        onChange={(e) => updateItemField(idx, 'shelf', e.target.value)}
                        placeholder="e.g. Shelf 3"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Description</label>
                    <textarea
                      className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      value={item.description}
                      onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                      placeholder="Describe brand guidelines or specifications."
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleFinishItem(idx)}
                      className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow cursor-pointer"
                    >
                      Finish &amp; Collapse Card
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dynamic Add Brands Trigger */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAddNewItem}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
          >
            <Plus size={13} className="text-primary" />
            <span>Add Another Brand</span>
          </button>
        </div>

        <FormFooter cancelHref="/dashboard/brands" submitLabel="Save Brands" loading={loading} />
      </form>

      {/* Image Cropping Modal */}
      {croppingIdx !== null && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-display font-extrabold text-sm text-text-primary uppercase tracking-wider">Crop Brand Logo</h3>
              <button
                type="button"
                className="p-1 text-text-muted hover:text-text-primary rounded-md transition-colors"
                onClick={() => {
                  setCroppingIdx(null);
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
                  setCroppingIdx(null);
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
    </div>
  );
}
