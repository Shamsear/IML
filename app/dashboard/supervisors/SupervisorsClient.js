'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupervisor, updateSupervisor, deleteSupervisor, createBulkSupervisors } from '@/app/actions/supervisors';
import { UserCheck, Plus, Edit2, Trash2, Mail, Phone, Loader2, X, Search } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import Pagination from '@/components/Pagination';
import { usePermissions } from '@/hooks/usePermissions';

export default function SupervisorsClient({ initialSupervisors }) {
  const router = useRouter();
  const toast = useToast();
  const { isReadOnly } = usePermissions();
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSupervisors(initialSupervisors);
  }, [initialSupervisors]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', danger: false, onConfirm: null });

  // Queue item creator helper
  const createEmptySupervisorItem = (index = 0) => ({
    id: `temp-${Date.now()}-${index}`,
    name: '',
    email: '',
    phone: '',
    isExpanded: true,
    error: '',
  });

  // State array for supervisors queue
  const [items, setItems] = useState([createEmptySupervisorItem(0)]);

  const openAddModal = () => {
    setEditingSupervisor(null);
    setItems([createEmptySupervisorItem(0)]);
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (supervisor) => {
    setEditingSupervisor(supervisor);
    setItems([{
      id: supervisor.id,
      name: supervisor.name,
      email: supervisor.email || '',
      phone: supervisor.phone || '',
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
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptySupervisorItem(prev.length)));
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (!item.name.trim()) {
      updateItemField(idx, 'error', 'Supervisor name is required');
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, isExpanded: false, error: '' } : it));
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      if (prev.length === 1) {
        return [createEmptySupervisorItem(0)];
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
        updateItemField(i, 'error', 'Supervisor name is required');
        handleExpandItem(i);
        setLoading(false);
        return;
      }
    }

    try {
      if (editingSupervisor) {
        // Edit mode (single item)
        const item = items[0];
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('email', item.email);
        formData.append('phone', item.phone);
        await updateSupervisor(editingSupervisor.id, formData);
        setSupervisors(prev => prev.map(s => s.id === editingSupervisor.id ? { ...s, name: item.name, email: item.email, phone: item.phone } : s));
      } else {
        // Create mode (Batch add via FormData serialization)
        const formData = new FormData();
        items.forEach((item, idx) => {
          formData.append(`item_${idx}_name`, item.name);
          formData.append(`item_${idx}_email`, item.email);
          formData.append(`item_${idx}_phone`, item.phone);
        });
        const created = await createBulkSupervisors(formData);
        if (created && created.length > 0) {
          setSupervisors(prev => [...created, ...prev]);
        }
      }

      toast.success(editingSupervisor ? 'Supervisor Updated' : 'Supervisors Created', `${items.length} supervisor(s) saved successfully.`);
      router.refresh();
      setIsFormOpen(false);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmData({
      title: 'Delete Supervisor?',
      message: 'This will unassign them from any promoters.',
      danger: true,
      confirmLabel: 'Delete Supervisor',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteSupervisor(id);
          setSupervisors(prev => prev.filter(s => s.id !== id));
          toast.success('Supervisor Deleted', 'The supervisor has been removed.');
          router.refresh();
        } catch (err) {
          toast.error('Delete Failed', err.message || 'Could not delete supervisor.');
        } finally {
          setLoading(false);
        }
      },
    });
    setConfirmOpen(true);
  };

  const filteredSupervisors = supervisors.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSupervisors.length / itemsPerPage);
  const paginatedSupervisors = filteredSupervisors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Supervisors
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage regional field supervisors responsible for operations and stock.
          </p>
        </div>
        {!isReadOnly && (
          <div className="has-tooltip">
            <button 
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-colors duration-200 cursor-pointer"
            >
              <Plus size={16} /> <span>Add Supervisor</span>
            </button>
            <span className="tooltip-box">Register new team supervisor</span>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {/* Inline Accordion Form Cards Queue */}
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingSupervisor ? 'Edit Supervisor' : 'Register New Supervisors (Batch)'}
              </h2>
              <button 
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer" 
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
                          <div className="w-10 h-10 rounded-sm bg-surface-elevated flex items-center justify-center border border-border text-text-secondary flex-shrink-0">
                            <UserCheck size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-text-primary truncate block">
                              {item.name || <span className="text-text-muted italic">Unnamed Supervisor</span>}
                            </span>
                            <span className="text-[10px] text-text-secondary block mt-0.5 truncate max-w-xs">
                              Email: {item.email || 'Not set'} | Phone: {item.phone || 'Not set'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleExpandItem(idx)}
                              className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors cursor-pointer"
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
                          <span className="text-2xs font-bold text-primary uppercase tracking-wider">Supervisor Entry #{idx + 1}</span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold cursor-pointer"
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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Supervisor Name *</label>
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                              value={item.name}
                              onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                              placeholder="e.g. Shanawas / Zeeshan"
                              required
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Email Address</label>
                            <input
                              type="email"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                              value={item.email}
                              onChange={(e) => updateItemField(idx, 'email', e.target.value)}
                              placeholder="supervisor@imlme.com"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                            <input
                              type="text"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                              value={item.phone}
                              onChange={(e) => updateItemField(idx, 'phone', e.target.value)}
                              placeholder="e.g. +971 50 123 4567"
                            />
                          </div>
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

              {/* Dynamic Add Supervisor Trigger (only when adding new ones) */}
              {!editingSupervisor && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleAddNewItem}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border border-dashed hover:bg-surface-elevated text-text-primary rounded-xl text-xs font-bold cursor-pointer transition-all hover:border-primary"
                  >
                    <Plus size={13} className="text-primary" />
                    <span>Add Another Supervisor</span>
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
                  <span>{editingSupervisor ? 'Save Changes' : `Save Batch of ${items.length} Supervisors`}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Supervisors List */}
        {!isFormOpen && (
          <div className="w-full flex flex-col gap-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search supervisors by name, email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors font-semibold"
              />
            </div>
            {/* Top Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSupervisors.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              itemLabel="supervisors"
            />

            {filteredSupervisors.length === 0 ? (
              searchQuery ? (
                <div className="bg-surface border border-border rounded-xl shadow-sm">
                  <EmptyState
                    icon={UserCheck}
                    title="No supervisors match your search"
                    description="Try a different search term or clear the filter."
                  />
                </div>
              ) : (
                <div className="bg-surface border border-border rounded-xl shadow-sm">
                  <EmptyState
                    icon={UserCheck}
                    title="No supervisors yet"
                    description="Supervisors manage delivery operations between warehouse and stores. Add your first supervisor."
                    actionLabel={isReadOnly ? undefined : "Add Supervisor"}
                    onAction={isReadOnly ? undefined : openAddModal}
                  />
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {paginatedSupervisors.map((supervisor) => (
                  <div 
                    className={`bg-surface border border-border rounded-xl p-5 shadow-sm transition-all duration-200 flex flex-col gap-4 group ${
                      isReadOnly ? '' : 'hover:shadow-md hover:border-primary/40 cursor-pointer'
                    }`} 
                    key={supervisor.id}
                    onClick={() => {
                      if (!isReadOnly) openEditModal(supervisor);
                    }}
                  >
                    <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/10 flex items-center justify-center">
                         <UserCheck size={18} className="text-primary" />
                      </div>
                      <span className="badge bg-surface-elevated text-text-secondary border border-border text-[10px]">
                        {supervisor.staff?.length || 0} Placed Staff
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-lg font-display font-bold text-text-primary">{supervisor.name}</h3>
                      <div className="flex flex-col gap-1.5 mt-2.5">
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Mail size={13} className="text-text-muted flex-shrink-0" />
                          <span className="truncate">{supervisor.email || 'No email registered'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Phone size={13} className="text-text-muted flex-shrink-0" />
                          <span>{supervisor.phone || 'No phone registered'}</span>
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex gap-2 pt-4 border-t border-border mt-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          type="button"
                          onClick={() => openEditModal(supervisor)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <div className="has-tooltip">
                          <button className="inline-flex items-center justify-center p-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer" onClick={() => handleDelete(supervisor.id)}>
                            <Trash2 size={14} />
                          </button>
                          <span className="tooltip-box">Remove supervisor profile</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSupervisors.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              itemLabel="supervisors"
            />
          </div>
        )}
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
