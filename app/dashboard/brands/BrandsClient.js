'use client';

import { useState } from 'react';
import { deleteBrand } from '@/app/actions/brands';
import { Tag, Plus, Edit2, Trash2, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function BrandsClient({ initialBrands }) {
  const toast = useToast();
  const [brands, setBrands] = useState(initialBrands);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', danger: false, onConfirm: null });

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = (id) => {
    setConfirmData({
      title: 'Delete Brand?',
      message: 'This will permanently delete this brand and all associated products and projects.',
      danger: true,
      confirmLabel: 'Delete Brand',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteBrand(id);
          setBrands(prev => prev.filter(b => b.id !== id));
          toast.success('Brand Deleted', 'The brand and all associated data have been removed.');
        } catch (err) {
          toast.error('Delete Failed', err.message || 'Could not delete brand.');
        } finally {
          setLoading(false);
        }
      },
    });
    setConfirmOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Tag size={250} />
      </div>
      
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Brands Portfolio
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage active business brands and their client-facing settings.
          </p>
        </div>
        <div className="has-tooltip">
          <Link 
            href="/dashboard/brands/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
          >
            <Plus size={16} />
            <span>Add Brand</span>
          </Link>
          <span className="tooltip-box">Register new brand owner</span>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {/* Main Content Grid */}
        <div className="flex flex-col gap-4">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search brands by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
            />
          </div>

          {filteredBrands.length === 0 ? (
            searchQuery ? (
              <div className="bg-surface border border-border rounded-xl shadow-sm">
                <EmptyState
                  icon={Tag}
                  title="No brands match your search"
                  description="Try a different search term or clear the filter."
                />
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl shadow-sm">
                <EmptyState
                  icon={Tag}
                  title="No brands yet"
                  description="Brands represent your client operations. Register your first brand to start managing inventory."
                  actionLabel="Add Brand"
                  actionHref="/dashboard/brands/new"
                />
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
              {filteredBrands.map((brand) => (
                <div key={brand.id} className="bg-surface border border-border rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex sm:flex-col group relative overflow-hidden">
                  {/* Brand Image/Logo Container */}
                  <div className="w-16 h-16 sm:w-full sm:h-auto sm:aspect-square bg-white flex items-center justify-center relative overflow-hidden flex-shrink-0 sm:rounded-t-md rounded-l-xl sm:rounded-l-none">
                    {brand.imageUrl ? (
                      <img 
                        src={getOptimizedImageUrl(brand.imageUrl, 400, 400)} 
                        alt={brand.name} 
                        className="w-full h-full object-cover filter group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-0.5 text-text-muted">
                        <Tag size={20} />
                      </div>
                    )}
                  </div>

                  {/* Brand Info */}
                  <div className="bg-surface-elevated/95 sm:border-t border-border p-3 sm:p-4 flex flex-col gap-1 flex-shrink-0 sm:rounded-b-2xl flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-extrabold text-xs sm:text-sm text-text-primary truncate">{brand.name}</h3>
                      <Link 
                        href={`/dashboard/brands/${brand.id}`} 
                        className="text-[10px] sm:text-xs font-bold text-primary hover:underline flex-shrink-0 sm:relative z-0 sm:z-10 after:absolute after:inset-0 after:content-[''] sm:after:hidden"
                      >
                        Manage →
                      </Link>
                    </div>
                    
                    <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-1 hidden sm:block">
                      {brand.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between mt-0.5 sm:mt-1 text-[9px] sm:text-[10px] text-text-muted font-semibold">
                      <span className="truncate">
                        {brand.rack || brand.shelf ? `${brand.rack || ''}${brand.rack && brand.shelf ? '/' : ''}${brand.shelf || ''}` : ''}
                      </span>
                      
                      <div className="flex items-center gap-1.5 sm:gap-2 relative z-10 flex-shrink-0">
                        <div className="has-tooltip">
                          <Link 
                            href={`/dashboard/brands/${brand.id}/edit`}
                            className="p-0.5 sm:p-1 hover:text-text-primary rounded transition-colors cursor-pointer inline-flex items-center justify-center"
                          >
                            <Edit2 size={11} />
                          </Link>
                          <span className="tooltip-box">Modify name or logo</span>
                        </div>
                        <div className="has-tooltip">
                          <button 
                            className="p-0.5 sm:p-1 hover:text-danger rounded transition-colors cursor-pointer"
                            onClick={() => handleDelete(brand.id)}
                            type="button"
                            disabled={loading}
                          >
                            {loading ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
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

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmData.onConfirm}
        type="confirm"
        danger={confirmData.danger}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel={confirmData.confirmLabel}
      />
    </div>
  );
}
