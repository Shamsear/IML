'use client';

import { useState } from 'react';
import { createBrand, updateBrand, deleteBrand } from '@/app/actions/brands';
import { Tag, Plus, Edit2, Trash2, Globe, EyeOff, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';

export default function BrandsClient({ initialBrands }) {
  const [brands, setBrands] = useState(initialBrands);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [logoFile, setLogoFile] = useState(null);

  const openAddModal = () => {
    setEditingBrand(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setIsPublic(true);
    setLogoFile(null);
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setDescription(brand.description || '');
    setImageUrl(brand.imageUrl || '');
    setIsPublic(brand.isPublic);
    setLogoFile(null);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('imageUrl', imageUrl);
    if (logoFile) {
      formData.append('imageFile', logoFile);
    }
    formData.append('isPublic', isPublic.toString());

    try {
      if (editingBrand) {
        await updateBrand(editingBrand.id, formData);
      } else {
        await createBrand(formData);
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
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Brands Portfolio
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage active business brands and their client-facing public settings.
          </p>
        </div>
        {!isFormOpen && (
          <button 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
            onClick={openAddModal}
          >
            <Plus size={16} />
            <span>Add Brand</span>
          </button>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingBrand ? 'Edit Brand' : 'Register New Brand'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Brand Name</label>
                  <input
                    type="text"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sadia or Virgin"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Upload Brand Logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full bg-surface-elevated text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    onChange={(e) => setLogoFile(e.target.files[0] || null)}
                  />
                  {imageUrl && (
                    <div className="text-[10px] text-text-muted truncate mt-0.5">
                      Current: <code>{imageUrl}</code>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Description</label>
                <textarea
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the operations, products, or guidelines."
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Public Visibility</label>
                <div className="flex gap-2">
                  <label className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg cursor-pointer text-xs font-semibold transition-all duration-200
                    ${isPublic 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <input type="radio" name="isPublic" checked={isPublic === true} onChange={() => setIsPublic(true)} className="hidden" />
                    <Globe size={14} />
                    <span>Public</span>
                  </label>
                  <label className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg cursor-pointer text-xs font-semibold transition-all duration-200
                    ${!isPublic 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <input type="radio" name="isPublic" checked={isPublic === false} onChange={() => setIsPublic(false)} className="hidden" />
                    <EyeOff size={14} />
                    <span>Hidden</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setIsFormOpen(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{editingBrand ? 'Save Changes' : 'Create Brand'}</span>
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
                <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 flex flex-col gap-4 group" key={brand.id}>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center overflow-hidden">
                      {brand.imageUrl ? (
                        <img 
                          src={getOptimizedImageUrl(brand.imageUrl, 150, 150)} 
                          alt={brand.name} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            if (e.target.src !== brand.imageUrl) {
                              e.target.src = brand.imageUrl;
                            }
                          }}
                        />
                      ) : (
                        <Tag size={20} className="text-primary" />
                      )}
                    </div>
                    {brand.isPublic ? (
                      <span className="badge badge-success"><Globe size={10} /> Public</span>
                    ) : (
                      <span className="badge badge-warning"><EyeOff size={10} /> Hidden</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <Link href={`/dashboard/brands/${brand.id}`} className="text-lg font-display font-bold text-text-primary hover:text-primary transition-colors">
                      {brand.name}
                    </Link>
                    <p className="text-xs text-text-secondary line-clamp-2 mt-1.5 leading-relaxed">
                      {brand.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border mt-2">
                    <Link href={`/dashboard/brands/${brand.id}`} className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200">
                      Dashboard
                    </Link>
                    <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => openEditModal(brand)}>
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => handleDelete(brand.id)}>
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
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
