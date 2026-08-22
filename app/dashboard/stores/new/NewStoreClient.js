'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createStore } from '@/app/actions/stores';
import { ArrowLeft, Store, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';

const regions = ['AUH', 'DXB', 'SHJ', 'ALN', 'RAK', 'FUJ', 'UAQ'];

export default function NewStoreClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('DXB');
  const [location, setLocation] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name.trim()) {
      setError('Store name is required');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('region', region);
      formData.append('location', location.trim());
      formData.append('isPublic', 'true');
      await createStore(formData);
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create store');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Store size={250} />
      </div>

      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link
          href="/dashboard/stores"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Add Store
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Register a new retail outlet in the inventory system.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-3 text-xs font-semibold flex items-center gap-2 animate-slide-down">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Store Name *</label>
          <input
            type="text"
            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Carrefour Mall of the Emirates"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Region</label>
          <CustomSelect
            options={regions.map(r => ({ value: r, label: r }))}
            value={region}
            onChange={setRegion}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Location / Address</label>
          <input
            type="text"
            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Sheikh Zayed Rd, Al Barsha 1, Dubai"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/stores"
            className="px-5 py-2.5 border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white text-xs font-bold rounded-lg shadow-md transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
            <span>{loading ? 'Creating...' : 'Create Store'}</span>
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/stores'); }}
        type="success"
        title="Store Created"
        message={`"${name}" has been registered successfully.`}
      />
    </div>
  );
}
