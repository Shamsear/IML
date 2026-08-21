'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrand, updateBrand, deleteBrand, createBulkBrands } from '@/app/actions/brands';
import { Tag, Plus, Edit2, Trash2, Loader2, X, Camera, Search } from 'lucide-react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';

export default function BrandsClient({ initialBrands }) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );
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

  const openAddModal = () => {
    setEditingBrand(null);
    setItems([createEmptyBrandItem(0)]);
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setItems([{
      id: brand.id,
      name: brand.name,
      description: brand.description || '',
      imageUrl: brand.imageUrl || '',
      logoFile: null,
      logoPreview: '',
      rack: brand.rack || '',
      shelf: brand.shelf || '',
      isPublic: brand.isPublic,
      isExpanded: true,
      error: '',
    }]);
    setError('');
    setIsFormOpen(true);
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
      if (editingBrand) {
        // Edit mode (single item)
        const item = items[0];
        formData.append('name', item.name);
        formData.append('description', item.description);
        formData.append('imageUrl', item.imageUrl);
        formData.append('rack', item.rack);
        formData.append('shelf', item.shelf);
        if (item.logoFile) {
          formData.append('imageFile', item.logoFile);
        }
        formData.append('isPublic', item.isPublic.toString());
        await updateBrand(editingBrand.id, formData);
      } else {
        // Create mode (Batch add via FormData serialization)
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
      }

      window.location.reload();
      setIsFormOpen(false);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this brand? This will permanently delete all associated products and projects.')) return;
    
    setLoading(true);
    try {
      await deleteBrand(id);
      setBrands(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete brand.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Tag size={250} />
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Brands Portfolio
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage active business brands and their client-facing settings.
          </p>
        </div>
        {!isFormOpen && (
          <div className="has-tooltip">
            <button 
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
              onClick={openAddModal}
            >
              <Plus size={16} />
              <span>Add Brand</span>
            </button>
            <span className="tooltip-box">Register new brand owner</span>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {/* Accordion Form Cards Queue */}
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingBrand ? 'Edit Brand' : 'Register New Brands (Batch)'}
              </h2>
              <button 
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors" 
                onClick={() => setIsFormOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold text-center animate-slide-down">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-white flex items-center justify-center flex-shrink-0">
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
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                              value={item.name}
                              onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                              placeholder="e.g. Virgin Mobile"
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Upload Logo Image File</label>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full bg-surface-elevated text-text-primary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
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
                            {(item.logoPreview || item.imageUrl) && (
                              <div className="flex items-center gap-2 mt-1">
                                <img src={item.logoPreview || getOptimizedImageUrl(item.imageUrl, 60, 60)} alt="Preview" className="w-8 h-8 rounded border border-border bg-white object-contain" />
                                <span className="text-[10px] text-text-secondary truncate max-w-xs">{item.logoFile?.name || 'Current Image'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Default Warehouse Rack (Optional)</label>
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                              value={item.rack || ''}
                              onChange={(e) => updateItemField(idx, 'rack', e.target.value)}
                              placeholder="e.g. Rack A"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Default Warehouse Shelf (Optional)</label>
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
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

              {/* Dynamic Add Brands Trigger (only when adding new ones) */}
              {!editingBrand && (
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
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button 
                  type="button" 
                  className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer" 
                  onClick={() => setIsFormOpen(false)} 
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
                  disabled={loading}
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{editingBrand ? 'Save Changes' : `Save Batch of ${items.length} Brands`}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Brands Cards Grid */}
        <div className="w-full flex flex-col gap-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search brands by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
            />
          </div>
          {filteredBrands.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm">
              <Tag size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">{searchQuery ? 'No brands match your search' : 'No Brands Registered'}</h3>
              <p className="text-sm max-w-xs">{searchQuery ? 'Try a different search term.' : 'Click "Add Brand" to create your first client operation.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBrands.map((brand) => (
                <div key={brand.id} className="bg-surface border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col aspect-square group relative">
                  {/* Brand Image/Logo Container - takes up most of the card */}
                  <div className="flex-1 min-h-0 bg-white flex items-center justify-center p-0 relative overflow-hidden">
                    {brand.imageUrl ? (
                      <img 
                        src={getOptimizedImageUrl(brand.imageUrl, 400, 400)} 
                        alt={brand.name} 
                        className="w-full h-full object-cover filter group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-text-muted">
                        <Tag size={40} />
                        <span className="text-xs uppercase font-bold tracking-wider font-display">No Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Brand Info Overlay / Bottom Banner */}
                  <div className="bg-surface-elevated/95 border-t border-border p-4 flex flex-col gap-1.5 flex-shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-extrabold text-sm text-text-primary truncate">{brand.name}</h3>
                      <Link 
                        href={`/dashboard/brands/${brand.id}`} 
                        className="text-xs font-bold text-primary hover:underline flex-shrink-0 after:absolute after:inset-0 after:content-[''] after:z-0"
                      >
                        Manage ➔
                      </Link>
                    </div>
                    
                    <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-1">
                      {brand.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-text-muted font-semibold">
                      <span>
                        {brand.rack || brand.shelf ? `Loc: ${brand.rack || ''}${brand.rack && brand.shelf ? '/' : ''}${brand.shelf || ''}` : 'No Loc'}
                      </span>
                      
                      <div className="flex items-center gap-2 relative z-10">
                        <div className="has-tooltip">
                          <button 
                            className="p-1 hover:text-text-primary rounded transition-colors cursor-pointer"
                            onClick={() => openEditModal(brand)}
                            type="button"
                          >
                            <Edit2 size={12} />
                          </button>
                          <span className="tooltip-box">Modify name or logo</span>
                        </div>
                        <div className="has-tooltip">
                          <button 
                            className="p-1 hover:text-danger rounded transition-colors cursor-pointer"
                            onClick={() => handleDelete(brand.id)}
                            type="button"
                          >
                            <Trash2 size={12} />
                          </button>
                          <span className="tooltip-box">Delete brand</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Cropping Modal */}
      {croppingIdx !== null && (
        <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display font-extrabold text-sm text-text-primary uppercase tracking-wider">Crop Brand Logo</h3>
              <button
                type="button"
                onClick={() => {
                  setCroppingIdx(null);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Viewport container */}
            <div className="flex justify-center items-center py-2 bg-surface-elevated/40 rounded-xl border border-border/60">
              <div 
                className="w-[320px] h-[320px] overflow-hidden relative border border-border rounded-lg bg-black cursor-grab active:cursor-grabbing select-none"
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
                onTouchStart={(e) => {
                  if (e.touches[0]) {
                    setIsDragging(true);
                    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                  }
                }}
                onTouchMove={(e) => {
                  if (!isDragging || !e.touches[0]) return;
                  const dx = e.touches[0].clientX - dragStart.x;
                  const dy = e.touches[0].clientY - dragStart.y;
                  setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                  handleDrag(dx, dy);
                }}
                onTouchEnd={() => setIsDragging(false)}
              >
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
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;
                    let renderW, renderH;
                    if (w > h) {
                      renderH = 320;
                      renderW = (w / h) * 320;
                    } else {
                      renderW = 320;
                      renderH = (h / w) * 320;
                    }
                    setCropDimensions({ width: renderW, height: renderH });
                  }}
                />
                {/* Viewport Frame Guidelines overlay */}
                <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none rounded-lg">
                  {/* Grid guidelines */}
                  <div className="absolute inset-x-0 top-1/3 h-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-x-0 top-2/3 h-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-y-0 left-1/3 w-px bg-white/20 border-dashed"></div>
                  <div className="absolute inset-y-0 left-2/3 w-px bg-white/20 border-dashed"></div>
                </div>
              </div>
            </div>

            {/* Slider controls */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
                <span>Zoom Level</span>
                <span className="font-mono text-primary font-bold">x{cropZoom.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={cropZoom}
                onChange={(e) => {
                  const nextZoom = parseFloat(e.target.value);
                  setCropZoom(nextZoom);
                  // Readjust offsets if they exceed new bounds
                  const maxOffsetX = Math.max(0, (cropDimensions.width * nextZoom - 320) / 2);
                  const maxOffsetY = Math.max(0, (cropDimensions.height * nextZoom - 320) / 2);
                  setCropX(prev => Math.min(maxOffsetX, Math.max(-maxOffsetX, prev)));
                  setCropY(prev => Math.min(maxOffsetY, Math.max(-maxOffsetY, prev)));
                }}
                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <span className="text-[10px] text-text-muted text-center leading-relaxed">
              Drag the image to position and adjust the slider to zoom. The final picture will be saved as a square 1:1 brand logo image.
            </span>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setCroppingIdx(null);
                  setCropSrc('');
                  setOriginalFile(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg transition-colors"
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
