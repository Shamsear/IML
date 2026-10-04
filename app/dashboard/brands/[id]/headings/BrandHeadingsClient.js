'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOptimizedImageUrl } from '@/lib/imagekit';
import { updateBrandPortalConfig } from '@/app/actions/brands';
import { 
  ArrowLeft, ListTree, Plus, Trash2, ArrowUp, ArrowDown, 
  Check, Eye, X, Loader2, Save, Layers, Sparkles, HelpCircle
} from 'lucide-react';
import { useToast } from '@/components/Toast';

export default function BrandHeadingsClient({ brand }) {
  const router = useRouter();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [newHeadingTitle, setNewHeadingTitle] = useState('');
  const [activePickerHeadingId, setActivePickerHeadingId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Initialize headings from brand.portalConfig or group by product categories
  const [portalHeadings, setPortalHeadings] = useState(() => {
    if (brand.portalConfig) {
      try {
        const parsed = typeof brand.portalConfig === 'string' ? JSON.parse(brand.portalConfig) : brand.portalConfig;
        if (parsed && Array.isArray(parsed.headings)) {
          return parsed.headings;
        }
      } catch (e) {
        console.error('Error parsing brand portalConfig:', e);
      }
    }

    // Default fallback: Group by existing product categories
    const catMap = {};
    (brand.products || []).forEach(p => {
      const cat = (p.category || 'OTHERS').toUpperCase().trim();
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(p.id);
    });

    return Object.keys(catMap).sort().map(cat => ({
      id: `heading-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: cat,
      productIds: catMap[cat],
      remarks: {}
    }));
  });

  const handleResetFromCategories = () => {
    const catMap = {};
    (brand.products || []).forEach(p => {
      const cat = (p.category || 'OTHERS').toUpperCase().trim();
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(p.id);
    });

    const defaultHeadings = Object.keys(catMap).sort().map(cat => ({
      id: `heading-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: cat,
      productIds: catMap[cat],
      remarks: {}
    }));

    setPortalHeadings(defaultHeadings);
    toast.success('Headings Reset', 'Headings auto-grouped from catalog product categories.');
  };

  const handleAddHeading = () => {
    if (!newHeadingTitle.trim()) return;
    const newHeading = {
      id: `heading-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: newHeadingTitle.trim().toUpperCase(),
      productIds: [],
      remarks: {}
    };
    setPortalHeadings(prev => [...prev, newHeading]);
    setNewHeadingTitle('');
  };

  const handleRemoveHeading = (headingId) => {
    setPortalHeadings(prev => prev.filter(h => h.id !== headingId));
  };

  const handleMoveHeading = (index, direction) => {
    setPortalHeadings(prev => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleRenameHeading = (headingId, newTitle) => {
    setPortalHeadings(prev => prev.map(h => h.id === headingId ? { ...h, title: newTitle } : h));
  };

  const handleAddProductToHeading = (headingId, productId) => {
    setPortalHeadings(prev => prev.map(h => {
      if (h.id === headingId) {
        if (!h.productIds.includes(productId)) {
          return { ...h, productIds: [...h.productIds, productId] };
        }
      }
      return h;
    }));
  };

  const handleRemoveProductFromHeading = (headingId, productId) => {
    setPortalHeadings(prev => prev.map(h => {
      if (h.id === headingId) {
        const nextIds = h.productIds.filter(id => id !== productId);
        const nextRemarks = { ...(h.remarks || {}) };
        delete nextRemarks[productId];
        return { ...h, productIds: nextIds, remarks: nextRemarks };
      }
      return h;
    }));
  };

  const handleUpdateProductRemark = (headingId, productId, remark) => {
    setPortalHeadings(prev => prev.map(h => {
      if (h.id === headingId) {
        return {
          ...h,
          remarks: {
            ...(h.remarks || {}),
            [productId]: remark
          }
        };
      }
      return h;
    }));
  };

  const handleSavePortalConfig = async () => {
    try {
      setIsSaving(true);
      await updateBrandPortalConfig(brand.id, { headings: portalHeadings });
      toast.success('Headings Saved', `Portal summary headings for ${brand.name} updated successfully.`);
      router.refresh();
    } catch (e) {
      toast.error('Save Failed', e.message || 'Failed to save portal headings');
    } finally {
      setIsSaving(false);
    }
  };

  const totalAssignedProducts = portalHeadings.reduce((acc, h) => acc + (h.productIds || []).length, 0);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 font-sans pb-12">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link 
            href={`/dashboard/brands/${brand.id}`} 
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:outline-none transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
                Portal Summary Headings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {brand.name}
              </span>
            </div>
            <p className="text-text-secondary text-sm mt-1">
              Organize products into custom categorized sections and custom remarks for the {brand.name} Partner Portal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/portal/brand/${brand.secretKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Eye size={14} />
            <span>Preview Portal</span>
          </a>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSavePortalConfig}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Headings</span>
          </button>
        </div>
      </header>

      {/* Toolbar: Add New Heading & Reset Actions */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <input
            type="text"
            placeholder="New heading title (e.g. PROMOTIONAL STANDS)..."
            value={newHeadingTitle}
            onChange={(e) => setNewHeadingTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddHeading(); } }}
            className="w-full bg-surface-elevated/50 text-text-primary placeholder:text-text-muted border border-border rounded-xl px-3.5 py-2 text-xs font-bold uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="button"
            onClick={handleAddHeading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>Add Heading</span>
          </button>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs text-text-muted font-medium hidden md:inline">
            {portalHeadings.length} Headings · {totalAssignedProducts} Assigned Items
          </span>
          <button
            type="button"
            onClick={handleResetFromCategories}
            className="px-3.5 py-2 bg-surface-elevated/60 hover:bg-surface-elevated border border-border rounded-xl text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors cursor-pointer"
            title="Auto-fill headings from product categories"
          >
            Reset from Categories
          </button>
        </div>
      </div>

      {/* Headings List Container */}
      <div className="flex flex-col gap-5">
        {portalHeadings.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 bg-surface border border-dashed border-border rounded-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ListTree size={24} />
            </div>
            <h3 className="font-display font-bold text-base text-text-primary">No Headings Defined</h3>
            <p className="text-xs text-text-secondary max-w-sm">
              Type a heading title above and click &quot;Add Heading&quot; or click &quot;Reset from Categories&quot; to auto-group catalog products.
            </p>
          </div>
        ) : (
          portalHeadings.map((heading, idx) => {
            const headingProducts = (heading.productIds || [])
              .map(pid => (brand.products || []).find(p => p.id === pid))
              .filter(Boolean);

            const isPickerOpen = activePickerHeadingId === heading.id;
            const availableToAdd = (brand.products || []).filter(
              p => !(heading.productIds || []).includes(p.id) &&
              (p.name.toLowerCase().includes(pickerSearch.toLowerCase()) || (p.itemCode && p.itemCode.toLowerCase().includes(pickerSearch.toLowerCase())))
            );

            return (
              <div key={heading.id} className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all">
                {/* Heading Bar */}
                <div className="px-5 py-3.5 bg-surface-elevated/40 border-b border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-0.5 bg-surface border border-border rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveHeading(idx, -1)}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                        title="Move heading up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === portalHeadings.length - 1}
                        onClick={() => handleMoveHeading(idx, 1)}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 rounded hover:bg-surface-elevated transition-colors cursor-pointer"
                        title="Move heading down"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>

                    {/* Editable Title */}
                    <input
                      type="text"
                      value={heading.title}
                      onChange={(e) => handleRenameHeading(heading.id, e.target.value.toUpperCase())}
                      className="font-display font-extrabold text-sm text-text-primary uppercase bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:bg-surface-elevated px-2 py-1 rounded-md focus:outline-none transition-all flex-1 min-w-[160px]"
                      placeholder="HEADING TITLE"
                    />

                    <span className="text-[11px] font-bold text-text-secondary bg-surface-elevated px-2.5 py-0.5 rounded-full border border-border/60 shrink-0">
                      {headingProducts.length} items
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePickerHeadingId(isPickerOpen ? null : heading.id);
                        setPickerSearch('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveHeading(heading.id)}
                      className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors cursor-pointer"
                      title="Delete this heading"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Product Picker Dropdown Panel */}
                {isPickerOpen && (
                  <div className="p-4 bg-surface-elevated/60 border-b border-border flex flex-col gap-3 animate-slide-down">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text-primary">Select catalog products to assign to &quot;{heading.title}&quot;:</span>
                      <button onClick={() => setActivePickerHeadingId(null)} className="text-text-muted hover:text-text-primary p-1 rounded-md">
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Filter product name or SKU..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary"
                    />
                    <div className="max-h-48 overflow-y-auto flex flex-col gap-1 divide-y divide-border/40 bg-surface rounded-xl border border-border p-1.5">
                      {availableToAdd.length === 0 ? (
                        <div className="py-4 text-center text-xs text-text-muted italic">
                          No available products found matching your search.
                        </div>
                      ) : (
                        availableToAdd.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddProductToHeading(heading.id, p.id)}
                            className="px-3 py-2 text-left text-xs hover:bg-primary/10 hover:text-primary rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {p.imageUrl ? (
                                <img src={getOptimizedImageUrl(p.imageUrl, 50, 50)} alt={p.name} className="w-6 h-6 rounded object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {p.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-text-primary truncate">{p.name}</span>
                              <span className="text-[10px] font-mono text-text-muted">{p.itemCode || '---'}</span>
                            </div>
                            <span className="text-[10px] font-bold text-primary shrink-0 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                              + Add
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Assigned Products List */}
                <div className="divide-y divide-border">
                  {headingProducts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted italic bg-surface/50">
                      No products assigned to this heading yet. Click &quot;+ Add Product&quot; to assign catalog items.
                    </div>
                  ) : (
                    headingProducts.map(p => {
                      const remarkVal = heading.remarks?.[p.id] || '';
                      return (
                        <div key={p.id} className="p-3.5 sm:px-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 hover:bg-surface-elevated/20 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 sm:w-1/2">
                            {p.imageUrl ? (
                              <img 
                                src={getOptimizedImageUrl(p.imageUrl, 80, 80)} 
                                alt={p.name} 
                                className="w-9 h-9 rounded-md object-cover border border-border shrink-0 shadow-2xs" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20 shrink-0">
                                {p.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-text-primary block truncate">{p.name}</span>
                              <span className="text-[10px] font-mono text-text-muted">SKU: {p.itemCode || '---'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              placeholder="Custom remark for portal (e.g. 3 Damage / Skirt Broken)..."
                              value={remarkVal}
                              onChange={(e) => handleUpdateProductRemark(heading.id, p.id, e.target.value)}
                              className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors italic"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromHeading(heading.id, p.id)}
                              className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-colors shrink-0 cursor-pointer"
                              title="Remove from this heading"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Save Actions Bar at bottom */}
      <div className="sticky bottom-6 z-30 bg-surface/95 border border-border rounded-2xl shadow-xl p-4 flex items-center justify-between gap-4 backdrop-blur-md">
        <span className="text-xs text-text-secondary font-medium">
          {portalHeadings.length} Headings · {totalAssignedProducts} Assigned Items
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/brands/${brand.id}`}
            className="px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors"
          >
            Back to Brand
          </Link>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSavePortalConfig}
            className="inline-flex items-center gap-1.5 px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save &amp; Publish Headings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
