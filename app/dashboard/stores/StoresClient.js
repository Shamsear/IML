'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStore, updateStore, deleteStore, createBulkStores } from '@/app/actions/stores';
import { Store, Plus, Edit2, Trash2, MapPin, Search, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import CustomSelect from '@/components/CustomSelect';

const regions = ['AUH', 'DXB', 'SHJ', 'ALN', 'RAK', 'FUJ', 'UAQ'];

export default function StoresClient({ initialStores }) {
  const router = useRouter();
  const [stores, setStores] = useState(initialStores);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('ALL');

  // Queue item creator helper
  const createEmptyStoreItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    region: 'DXB',
    location: '',
    isPublic: true,
    isExpanded: true,
    error: '',
  });

  // State array for stores queue
  const [items, setItems] = useState([createEmptyStoreItem(0)]);

  const openAddModal = () => {
    setEditingStore(null);
    setItems([createEmptyStoreItem(0)]);
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    setItems([{
      id: store.id,
      name: store.name,
      region: store.region || 'DXB',
      location: store.location || '',
      isPublic: store.isPublic,
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
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyStoreItem(prev.length)));
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (!item.name.trim()) {
      updateItemField(idx, 'error', 'Store name is required');
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptyStoreItem(0)];
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
        updateItemField(i, 'error', 'Store name is required');
        handleExpandItem(i);
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      if (editingStore) {
        // Edit mode (single item)
        const item = items[0];
        formData.append('name', item.name);
        formData.append('region', item.region);
        formData.append('location', item.location);
        formData.append('isPublic', item.isPublic.toString());
        await updateStore(editingStore.id, formData);
      } else {
        // Create mode (Batch add via FormData serialization)
        formData.append('count', items.length.toString());
        items.forEach((item, idx) => {
          formData.append(`item_${idx}_name`, item.name);
          formData.append(`item_${idx}_region`, item.region);
          formData.append(`item_${idx}_location`, item.location);
          formData.append(`item_${idx}_isPublic`, item.isPublic.toString());
        });
        await createBulkStores(formData);
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
    if (!confirm('Delete this store? Campaign mappings will be removed.')) return;
    setLoading(true);
    try {
      await deleteStore(id);
      setStores(prev => prev.filter(s => s.id !== id));
    } catch (err) { 
      alert(err.message || 'Failed.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.location && store.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRegion = selectedRegionFilter === 'ALL' || store.region === selectedRegionFilter;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Store size={250} />
      </div>
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Outlets &amp; Stores
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage physical stores, regions, and coordinates across the UAE.
          </p>
        </div>
        {!isFormOpen && (
          <div className="has-tooltip">
            <button 
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer" 
              onClick={openAddModal}
            >
              <Plus size={16} /> <span>Add Store</span>
            </button>
            <span className="tooltip-box">Register new outlet</span>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {/* Accordion Form Cards Queue */}
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingStore ? 'Edit Store' : 'Register New Stores (Batch)'}
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
                          <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center border border-border text-text-secondary flex-shrink-0">
                            <Store size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-text-primary truncate block">
                              {item.name || <span className="text-text-muted italic">Unnamed Store</span>}
                            </span>
                            <span className="text-[10px] text-text-secondary block mt-0.5 truncate max-w-xs">
                              Region: <strong>{item.region}</strong> | Location: {item.location || 'Not set'}
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
                          <span className="text-2xs font-bold text-primary uppercase tracking-wider">Store Entry #{idx + 1}</span>
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
                            <label className="text-xs font-semibold text-text-secondary">Store Name</label>
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                              value={item.name}
                              onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                              placeholder="e.g. Carrefour Mall of the Emirates"
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Region</label>
                            <CustomSelect
                              options={regions.map(r => ({ value: r, label: r }))}
                              value={item.region}
                              onChange={(val) => updateItemField(idx, 'region', val)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Location / Address Details</label>
                          <input
                            type="text"
                            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                            value={item.location}
                            onChange={(e) => updateItemField(idx, 'location', e.target.value)}
                            placeholder="e.g. Sheikh Zayed Rd, Al Barsha 1, Dubai"
                          />
                        </div>

                        <div className="flex justify-end pt-3 border-t border-border">
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

              {/* Dynamic Add Store Trigger (only when adding new ones) */}
              {!editingStore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>Add Another Store</span>
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
                  <span>{editingStore ? 'Save Changes' : `Save Batch of ${items.length} Stores`}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters and List */}
        {!isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" 
                placeholder="Search stores by name or address..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Region Filter Buttons */}
            <div className="flex flex-wrap gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
              <button
                onClick={() => setSelectedRegionFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer
                  ${selectedRegionFilter === 'ALL'
                    ? 'bg-surface text-text-primary shadow-sm border border-border'
                    : 'text-text-secondary hover:text-text-primary border border-transparent'
                  }
                `}
              >
                All Regions
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRegionFilter(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer
                    ${selectedRegionFilter === r
                      ? 'bg-surface text-text-primary shadow-sm border border-border'
                      : 'text-text-secondary hover:text-text-primary border border-transparent'
                    }
                  `}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid List */}
        <div className="w-full">
          {filteredStores.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm">
              <Store size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">No Outlets Matches</h3>
              <p className="text-sm max-w-xs">No registered stores found in the database matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {filteredStores.map((store) => (
                <div key={store.id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Store size={18} />
                      </div>
                      <div>
                        <h3 className="font-display font-extrabold text-sm text-text-primary group-hover:text-primary transition-colors">{store.name}</h3>
                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">{store.region} Region</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-xs text-text-secondary border-t border-border pt-4 mt-auto">
                    <MapPin size={14} className="text-text-muted flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed line-clamp-2 h-8">{store.location || 'No coordinates or address specified.'}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                    <div className="has-tooltip">
                      <Link
                        href={`/dashboard/stores/${store.id}`}
                        className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors cursor-pointer"
                      >
                        <Store size={13} />
                      </Link>
                      <span className="tooltip-box">Open placement ledger</span>
                    </div>
                    <div className="has-tooltip">
                      <button 
                        className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-md transition-colors cursor-pointer"
                        onClick={() => openEditModal(store)}
                        type="button"
                      >
                        <Edit2 size={13} />
                      </button>
                      <span className="tooltip-box">Edit outlet details</span>
                    </div>
                    <div className="has-tooltip">
                      <button 
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors cursor-pointer"
                        onClick={() => handleDelete(store.id)}
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className="tooltip-box">Delete store mapping</span>
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
