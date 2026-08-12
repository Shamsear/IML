'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStore, updateStore, deleteStore } from '@/app/actions/stores';
import { Store, Plus, Edit2, Trash2, Globe, EyeOff, MapPin, Search, Loader2, X, ExternalLink } from 'lucide-react';
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
  const [name, setName] = useState('');
  const [region, setRegion] = useState('DXB');
  const [location, setLocation] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState('ALL');

  const openAddModal = () => {
    setEditingStore(null);
    setName(''); setRegion('DXB'); setLocation(''); setIsPublic(true);
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    setName(store.name);
    setRegion(store.region || 'DXB');
    setLocation(store.location || '');
    setIsPublic(store.isPublic);
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('region', region);
    formData.append('location', location);
    formData.append('isPublic', isPublic.toString());
    try {
      if (editingStore) { await updateStore(editingStore.id, formData); }
      else { await createStore(formData); }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this store? Campaign mappings will be removed.')) return;
    setLoading(true);
    try {
      await deleteStore(id);
      setStores(prev => prev.filter(s => s.id !== id));
    } catch (err) { alert(err.message || 'Failed.'); }
    finally { setLoading(false); }
  };

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.location && store.location.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRegion = selectedRegionFilter === 'ALL' || store.region === selectedRegionFilter;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="flex flex-col gap-6">
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
          <button 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
            onClick={openAddModal}
          >
            <Plus size={16} /> <span>Add Store</span>
          </button>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingStore ? 'Edit Store' : 'Register Store'}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Outlet / Store Name</label>
                <input 
                  type="text" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Carrefour Yas Island" 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Emirate / Region</label>
                  <CustomSelect
                    options={regions.map(r => ({ value: r, label: r }))}
                    value={region}
                    onChange={(val) => setRegion(val)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Location / Address</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                    placeholder="Street, District, Mall name..." 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Visibility</label>
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
                  <span>{editingStore ? 'Save Details' : 'Create Store'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap gap-4 items-center shadow-sm justify-between">
            <div className="flex items-center gap-2 bg-surface-elevated px-3 py-2 rounded-lg border border-border flex-1 max-w-sm">
              <Search size={15} className="text-text-muted" />
              <input 
                type="text" 
                className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted w-full" 
                placeholder="Search stores..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button 
                onClick={() => setSelectedRegionFilter('ALL')} 
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200
                  ${selectedRegionFilter === 'ALL' 
                    ? 'bg-primary/10 border-primary text-primary' 
                    : 'bg-transparent border-border text-text-secondary hover:text-text-primary'
                  }`}
              >
                All
              </button>
              {regions.map(r => (
                <button 
                  key={r} 
                  onClick={() => setSelectedRegionFilter(r)} 
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200
                    ${selectedRegionFilter === r 
                      ? 'bg-primary/10 border-primary text-primary' 
                      : 'bg-transparent border-border text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm">
              <Store size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">No Outlets Found</h3>
              <p className="text-sm max-w-xs">No stores match your search or region filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStores.map((store) => (
                <div 
                  className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 flex flex-col gap-4 group cursor-pointer" 
                  key={store.id}
                  onClick={() => router.push(`/dashboard/stores/${store.id}`)}
                >
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/10 flex items-center justify-center">
                      <Store size={18} className="text-secondary" />
                    </div>
                    <div className="flex gap-1.5">
                      <span className="badge badge-info text-[10px]">{store.region || 'DXB'}</span>
                      {store.isPublic ? (
                        <span className="badge badge-success text-[10px]"><Globe size={9} /></span>
                      ) : (
                        <span className="badge badge-warning text-[10px]"><EyeOff size={9} /></span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <Link href={`/dashboard/stores/${store.id}`} className="text-lg font-display font-bold text-text-primary hover:text-primary transition-colors">
                      {store.name}
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-text-secondary mt-1.5">
                      <MapPin size={13} className="text-text-muted flex-shrink-0" />
                      <span className="truncate">{store.location || 'No address registered'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border mt-2" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/dashboard/stores/${store.id}`} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200">
                      <ExternalLink size={12} />
                      <span>View</span>
                    </Link>
                    <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => openEditModal(store)}>
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button className="inline-flex items-center justify-center p-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => handleDelete(store.id)}>
                      <Trash2 size={14} />
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
