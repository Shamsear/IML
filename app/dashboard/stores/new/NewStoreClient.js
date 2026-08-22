'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBulkStores } from '@/app/actions/stores';
import { ArrowLeft, Store, Loader2, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';

const regions = ['AUH', 'DXB', 'SHJ', 'ALN', 'RAK', 'FUJ', 'UAQ'];

const createEmptyItem = (index = 0) => ({
  id: `temp-${Date.now()}-${index}`,
  name: '',
  region: 'DXB',
  location: '',
  isExpanded: true,
  error: '',
});

export default function NewStoreClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([createEmptyItem(0)]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleAddItem = () => {
    setItems(prev => [...prev, { ...createEmptyItem(prev.length), isExpanded: true }]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleExpand = (idx) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, isExpanded: !item.isExpanded } : item));
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value, error: '' } : item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate
    const hasErrors = items.some(item => !item.name.trim());
    if (hasErrors) {
      setError('All stores must have a name.');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      items.forEach((item, idx) => {
        formData.append(`item_${idx}_name`, item.name.trim());
        formData.append(`item_${idx}_region`, item.region);
        formData.append(`item_${idx}_location`, item.location.trim());
        formData.append(`item_${idx}_isPublic`, 'true');
      });
      await createBulkStores(formData);
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create stores');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link
          href="/dashboard/stores"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Register New Stores
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Add one or multiple retail outlets to your inventory system.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2 animate-slide-down">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/stores'); }}
        type="success"
        title="Stores Created"
        message={`${items.length} store(s) registered successfully.`}
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
              {/* Collapsed view */}
              {!item.isExpanded && (
                <div
                  onClick={() => handleToggleExpand(idx)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-text-primary truncate">
                        {item.name || <span className="text-text-muted italic">Untitled store</span>}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {item.region} {item.location ? `• ${item.location}` : ''}
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveItem(idx); }}
                      className="p-1.5 text-text-muted hover:text-danger transition-colors rounded-md hover:bg-danger/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Expanded form */}
              {item.isExpanded && (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-primary" />
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        Store Entry #{idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-text-muted hover:text-danger transition-colors rounded-md hover:bg-danger/10"
                          title="Remove store"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(idx)}
                        className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded-md hover:bg-surface-elevated"
                        title="Collapse"
                      >
                        <ChevronDown size={14} className="rotate-180" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Store Name *</label>
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="e.g. Carrefour Mall of the Emirates"
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Region</label>
                    <CustomSelect
                      options={regions.map(r => ({ value: r, label: r }))}
                      value={item.region}
                      onChange={(val) => updateItem(idx, 'region', val)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Location / Address</label>
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      value={item.location}
                      onChange={(e) => updateItem(idx, 'location', e.target.value)}
                      placeholder="e.g. Sheikh Zayed Rd, Al Barsha 1, Dubai"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Another Store */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
          >
            <Plus size={13} className="text-primary" />
            <span>Add Another Store</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
          <Link
            href="/dashboard/stores"
            className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center gap-2"
            disabled={loading}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Save Stores</span>
          </button>
        </div>
      </form>
    </div>
  );
}
