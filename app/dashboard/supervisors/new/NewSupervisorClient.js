'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBulkSupervisors } from '@/app/actions/supervisors';
import { ArrowLeft, UserCheck, Loader2, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import FormFooter from '@/components/FormFooter';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

const createEmptyItem = (index = 0) => ({
  id: `temp-${Date.now()}-${index}`,
  name: '',
  email: '',
  phone: '',
  isExpanded: true,
  error: '',
});

export default function NewSupervisorClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([createEmptyItem(0)]);
  useUnsavedChanges(items.length > 0 && !loading);
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
    const hasEmptyNames = items.some(item => !item.name.trim());
    if (hasEmptyNames) {
      setError('All supervisors must have a name.');
      setLoading(false);
      return;
    }

    // Validate phone numbers
    for (let i = 0; i < items.length; i++) {
      if (items[i].phone && !/^0\d{8,9}$/.test(items[i].phone.replace(/\s/g, ''))) {
        setError(`Supervisor "${items[i].name}" has an invalid phone number. Use UAE format: 050 123 4567`);
        setLoading(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      items.forEach((item, idx) => {
        formData.append(`item_${idx}_name`, item.name.trim());
        formData.append(`item_${idx}_email`, item.email.trim());
        formData.append(`item_${idx}_phone`, item.phone.trim());
      });
      await createBulkSupervisors(formData);
      setConfirmOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to create supervisors');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <header className="flex items-center gap-4 pb-5 border-b border-border">
        <Link
          href="/dashboard/supervisors"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Register New Supervisors
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Add one or multiple delivery supervisors for warehouse operations.
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
        onClose={() => { setConfirmOpen(false); router.push('/dashboard/supervisors'); }}
        type="success"
        title="Supervisors Created"
        message={`${items.length} supervisor(s) registered successfully.`}
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
                        {item.name || <span className="text-text-muted italic">Untitled supervisor</span>}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {item.phone || item.email || 'No contact info'}
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
                      <UserCheck size={16} className="text-primary" />
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                        Supervisor Entry #{idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-text-muted hover:text-danger transition-colors rounded-md hover:bg-danger/10"
                          title="Remove supervisor"
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
                    <label className="text-xs font-semibold text-text-secondary">Full Name *</label>
                    <input
                      type="text"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="e.g. Ahmed Al Maktoum"
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Email</label>
                    <input
                      type="email"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      value={item.email}
                      onChange={(e) => updateItem(idx, 'email', e.target.value)}
                      placeholder="e.g. ahmed@iml-group.com"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Phone</label>
                    <input
                      type="tel"
                      className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      value={item.phone}
                      onChange={(e) => updateItem(idx, 'phone', e.target.value)}
                      placeholder="e.g. 050 123 4567"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Another Supervisor */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
          >
            <Plus size={13} className="text-primary" />
            <span>Add Another Supervisor</span>
          </button>
        </div>

        <FormFooter cancelHref="/dashboard/supervisors" submitLabel="Save Supervisors" loading={loading} />
      </form>
    </div>
  );
}
