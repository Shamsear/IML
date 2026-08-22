'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupervisor } from '@/app/actions/supervisors';
import { ArrowLeft, UserCheck, Loader2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

export default function NewSupervisorClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name.trim()) {
      setError('Supervisor name is required');
      setLoading(false);
      return;
    }

    if (phone && !/^0\d{8,9}$/.test(phone.replace(/\s/g, ''))) {
      setError('Please enter a valid UAE phone number starting with 0 (e.g. 050 123 4567)');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      formData.append('phone', phone.trim());
      await createSupervisor(formData);
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create supervisor');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <UserCheck size={250} />
      </div>

      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link
          href="/dashboard/supervisors"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Add Supervisor
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Register a new delivery supervisor for warehouse operations.
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
          <label className="text-xs font-semibold text-text-secondary">Full Name *</label>
          <input
            type="text"
            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ahmed Al Maktoum"
            required
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Email</label>
          <input
            type="email"
            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. ahmed@iml-group.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-secondary">Phone</label>
          <input
            type="tel"
            className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 050 123 4567"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/supervisors"
            className="px-5 py-2.5 border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-bold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white text-xs font-bold rounded-lg shadow-md transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            <span>{loading ? 'Creating...' : 'Create Supervisor'}</span>
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/supervisors'); }}
        type="success"
        title="Supervisor Created"
        message={`"${name}" has been registered as a supervisor.`}
      />
    </div>
  );
}
