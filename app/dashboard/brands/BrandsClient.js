'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrand, updateBrand, deleteBrand, createBulkBrands } from '@/app/actions/brands';
import { Tag, Plus, Edit2, Trash2, Loader2, X, Camera } from 'lucide-react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';

export default function BrandsClient({ initialBrands }) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Queue item creator helper
  const createEmptyBrandItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    description: '',
    imageUrl: '',
    logoFile: null,
    logoPreview: '',
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
    <div className="flex flex-col gap-6">
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
          <button 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
            onClick={openAddModal}
          >
            <Plus size={16} />
            <span>Add Brand</span>
          </button>
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
                                  updateItemField(idx, 'logoFile', file);
                                  updateItemField(idx, 'logoPreview', URL.createObjectURL(file));
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
        <div className="w-full">
          {brands.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm">
              <Tag size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">No Brands Registered</h3>
              <p className="text-sm max-w-xs">Click &quot;Add Brand&quot; to create your first client operation.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((brand) => (
                <div key={brand.id} className="bg-surface border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group">
                  {/* Brand Image Container */}
                  <div className="h-32 bg-surface-elevated border-b border-border flex items-center justify-center p-6 relative">
                    {brand.imageUrl ? (
                      <img 
                        src={getOptimizedImageUrl(brand.imageUrl, 240, 96)} 
                        alt={brand.name} 
                        className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-text-muted">
                        <Tag size={28} />
                        <span className="text-[10px] uppercase font-bold tracking-wider font-display">No Logo</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-5 flex-1 flex flex-col gap-3.5">
                    <div>
                      <h3 className="font-display font-extrabold text-base text-text-primary">{brand.name}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed mt-1 line-clamp-2 h-8">
                        {brand.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                      <Link 
                        href={`/dashboard/brands/${brand.id}`} 
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Manage Inventory ➔
                      </Link>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-md transition-colors cursor-pointer"
                          onClick={() => openEditModal(brand)}
                          title="Edit Brand"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors cursor-pointer"
                          onClick={() => handleDelete(brand.id)}
                          title="Delete Brand"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
