'use client';

import { useState } from 'react';
import { createStaff, updateStaff, deleteStaff } from '@/app/actions/staff';
import { Users, Plus, Edit2, Trash2, Phone, Shirt, Search, Loader2, X } from 'lucide-react';

const shirtSizes = ['Small', 'Medium', 'Large', 'Xl', 'X-large', 'Xref', 'Xxl'];

export default function StaffClient({ initialStaff, stores }) {
  const [staffList, setStaffList] = useState(initialStaff);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shirtSize, setShirtSize] = useState('Medium');
  const [storeId, setStoreId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const openAddModal = () => {
    setEditingStaff(null);
    setName(''); setPhone(''); setShirtSize('Medium'); setStoreId('');
    setError('');
    setIsFormOpen(true);
  };

  const openEditModal = (staff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setPhone(staff.phone || '');
    setShirtSize(staff.shirtSize || 'Medium');
    setStoreId(staff.storeId || '');
    setError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('shirtSize', shirtSize);
    formData.append('storeId', storeId);
    try {
      if (editingStaff) { await updateStaff(editingStaff.id, formData); }
      else { await createStaff(formData); }
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this staff member?')) return;
    setLoading(true);
    try {
      await deleteStaff(id);
      setStaffList(prev => prev.filter(s => s.id !== id));
    } catch (err) { alert(err.message || 'Failed.'); }
    finally { setLoading(false); }
  };

  const filteredStaffList = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (staff.phone && staff.phone.includes(searchQuery)) ||
    (staff.store && staff.store.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Promoters &amp; Staff
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Track active field promoters, shirt sizes, and store outlet placements.
          </p>
        </div>
        {!isFormOpen && (
          <button 
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" 
            onClick={openAddModal}
          >
            <Plus size={16} /> <span>Add Promoter</span>
          </button>
        )}
      </header>

      <div className="flex flex-col gap-6">
        {isFormOpen && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="font-display font-bold text-lg text-text-primary">
                {editingStaff ? 'Edit Promoter' : 'Register Promoter'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Saima Ijaz" 
                    required 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="+971 55 123 4567" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Shirt Size</label>
                  <select 
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    value={shirtSize} 
                    onChange={(e) => setShirtSize(e.target.value)} 
                    required
                  >
                    {shirtSizes.map(size => (<option key={size} value={size}>{size}</option>))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Placed Store</label>
                  <select 
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none" 
                    value={storeId} 
                    onChange={(e) => setStoreId(e.target.value)}
                  >
                    <option value="">-- Unassigned --</option>
                    {stores.map(store => (<option key={store.id} value={store.id}>{store.name} ({store.region || 'DXB'})</option>))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button type="button" className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-sm font-semibold transition-all duration-200" onClick={() => setIsFormOpen(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200" disabled={loading}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{editingStaff ? 'Save Profile' : 'Register Promoter'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 bg-surface-elevated px-3 py-2 rounded-lg border border-border flex-1 max-w-sm">
              <Search size={15} className="text-text-muted" />
              <input 
                type="text" 
                className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted w-full" 
                placeholder="Search promoters by name, phone, store..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
            <span className="text-xs font-semibold text-text-secondary">{filteredStaffList.length} found</span>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            {filteredStaffList.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                <Users size={48} />
                <h3 className="font-display font-bold text-lg text-text-primary">No Promoters Found</h3>
                <p className="text-sm max-w-xs">No promoters match your search parameters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                      <th className="py-3 px-5">Promoter</th>
                      <th className="py-3 px-5">Contact</th>
                      <th className="py-3 px-5">Shirt</th>
                      <th className="py-3 px-5">Store</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary">
                    {filteredStaffList.map((staff) => (
                      <tr key={staff.id} className="hover:bg-surface-elevated/20 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {staff.name.charAt(0)}
                            </div>
                            <span className="font-semibold">{staff.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <Phone size={13} className="text-text-muted flex-shrink-0" />
                            <span>{staff.phone || 'No Contact'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className="badge badge-info text-[10px] inline-flex items-center gap-0.5">
                            <Shirt size={10} /> 
                            <span>{staff.shirtSize || 'M'}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <span className={`text-xs ${staff.store ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
                            {staff.store ? staff.store.name : 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors" onClick={() => openEditModal(staff)}>
                              <Edit2 size={13} />
                            </button>
                            <button className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors" onClick={() => handleDelete(staff.id)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
