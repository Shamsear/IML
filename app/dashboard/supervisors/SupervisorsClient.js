'use client';

import { useState } from 'react';
import { createSupervisor, updateSupervisor, deleteSupervisor } from '@/app/actions/supervisors';
import { UserCheck, Plus, Edit2, Trash2, Mail, Phone, Loader2, X, Search } from 'lucide-react';

export default function SupervisorsClient({ initialSupervisors }) {
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSupervisors = supervisors.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAddModal = () => {
    setEditingSupervisor(null);
    setName(''); setEmail(''); setPhone('');
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (supervisor) => {
    setEditingSupervisor(supervisor);
    setName(supervisor.name);
    setEmail(supervisor.email || '');
    setPhone(supervisor.phone || '');
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('phone', phone);
    try {
      if (editingSupervisor) {
        await updateSupervisor(editingSupervisor.id, formData);
      } else {
        await createSupervisor(formData);
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supervisor? This will unassign them from any promoters.')) return;
    setLoading(true);
    try {
      await deleteSupervisor(id);
      setSupervisors(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <UserCheck size={250} />
      </div>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Supervisors
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage regional field supervisors responsible for operations and stock.
          </p>
        </div>
        {!isFormOpen && (
          <button 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
            onClick={openAddModal}
          >
            <Plus size={16} /> <span>Add Supervisor</span>
          </button>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingSupervisor ? 'Edit Supervisor' : 'Add Supervisor'}
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
                <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                <input 
                  type="text" 
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Shanawas" 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="name@imlme.com" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Phone Contact</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="+971 56 123 4567" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setIsFormOpen(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{editingSupervisor ? 'Save Details' : 'Add Supervisor'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search supervisors by name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold"
            />
          </div>
          {filteredSupervisors.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-3 text-text-muted shadow-sm">
              <UserCheck size={48} />
              <h3 className="font-display font-bold text-lg text-text-primary">{searchQuery ? 'No supervisors match your search' : 'No Supervisors Registered'}</h3>
              <p className="text-sm max-w-xs">{searchQuery ? 'Try a different search term.' : 'Click "Add Supervisor" to list your first team supervisor.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSupervisors.map((supervisor) => (
                <div 
                  className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 flex flex-col gap-4 group cursor-pointer" 
                  key={supervisor.id}
                  onClick={() => openEditModal(supervisor)}
                >
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center">
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

                  <div className="flex gap-2 pt-4 border-t border-border mt-2" onClick={(e) => e.stopPropagation()}>
                    <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => openEditModal(supervisor)}>
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button className="inline-flex items-center justify-center p-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-lg text-xs font-semibold transition-all duration-200" onClick={() => handleDelete(supervisor.id)}>
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
