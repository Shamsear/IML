'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteStaff, returnUniformItem, bulkReturnUniformItems } from '@/app/actions/staff';
import { 
  Users, Plus, Trash2, Phone, Shirt, Search, Loader2, 
  CheckCircle, Building2, Inbox, Calendar, Edit2, AlertCircle, X
} from 'lucide-react';

export default function StaffClient({ initialStaff, stores }) {
  const router = useRouter();
  const [staffList, setStaffList] = useState(initialStaff);
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'promoters'
  
  // Loading & search state
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all'); // 'all', 'active', 'returned'
  
  // Bulk selection state
  const [selectedAllocIds, setSelectedAllocIds] = useState([]);

  // Return Modal states
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnAllocIds, setReturnAllocIds] = useState([]);
  const [returnPromoterNames, setReturnPromoterNames] = useState([]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnError, setReturnError] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Construct flat list of all allocations
  const allAllocations = staffList.flatMap(staff => 
    (staff.allocations || []).map(alloc => ({
      ...alloc,
      staffId: staff.id,
      staffName: staff.name,
      staffPhone: staff.phone,
      staffShirtSize: staff.shirtSize,
    }))
  ).sort((a, b) => new Date(b.givenDate) - new Date(a.givenDate));

  // Compute summary stats
  const totalAllocationsCount = allAllocations.length;
  
  const activeAllocationsCount = allAllocations.filter(a => {
    const needUniformReturn = a.uniformQty > 0 && !a.uniformReturned;
    const needCapReturn = a.capQty > 0 && !a.capReturned;
    return needUniformReturn || needCapReturn;
  }).length;

  const returnedAllocationsCount = allAllocations.filter(a => {
    const hasUniform = a.uniformQty > 0;
    const hasCap = a.capQty > 0;
    const uniformReturnedOk = !hasUniform || a.uniformReturned;
    const capReturnedOk = !hasCap || a.capReturned;
    return uniformReturnedOk && capReturnedOk && (hasUniform || hasCap);
  }).length;

  const totalActiveQty = allAllocations.reduce((acc, a) => {
    const activeUniform = (a.uniformQty > 0 && !a.uniformReturned) ? a.uniformQty : 0;
    const activeCap = (a.capQty > 0 && !a.capReturned) ? a.capQty : 0;
    return acc + activeUniform + activeCap;
  }, 0);

  const getOverdueStatus = (alloc) => {
    const isFullyReturned = (alloc.uniformQty === 0 || alloc.uniformReturned) && 
                            (alloc.capQty === 0 || alloc.capReturned);
    if (isFullyReturned) return false;

    const period = alloc.workingPeriod || '';
    if (period.includes(' to ')) {
      const parts = period.split(' to ');
      const endDateStr = parts[1]?.trim();
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        return new Date() > endDate;
      }
    }
    return false;
  };

  const overdueAllocationsCount = allAllocations.filter(a => getOverdueStatus(a)).length;

  const handlePromoterDelete = async (id) => {
    if (!confirm('Delete this promoter profile? All associated allocations will be deleted.')) return;
    setLoading(true);
    try {
      await deleteStaff(id);
      setStaffList(prev => prev.filter(s => s.id !== id));
    } catch (err) { 
      alert(err.message || 'Failed to delete promoter.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const openSingleReturnModal = (alloc) => {
    setReturnAllocIds([alloc.id]);
    setReturnPromoterNames([alloc.staffName]);
    setReturnNotes('');
    setReturnError('');
    setIsReturnModalOpen(true);
  };

  const openBulkReturnModal = () => {
    const selectedAllocs = allAllocations.filter(a => selectedAllocIds.includes(a.id));
    const names = selectedAllocs.map(a => a.staffName);
    setReturnAllocIds(selectedAllocIds);
    setReturnPromoterNames(names);
    setReturnNotes('');
    setReturnError('');
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnNotes.trim()) {
      setReturnError('Return remarks are required.');
      return;
    }
    setIsSubmittingReturn(true);
    setReturnError('');
    try {
      if (returnAllocIds.length === 1) {
        await returnUniformItem(returnAllocIds[0], 'both', returnNotes);
      } else {
        await bulkReturnUniformItems(returnAllocIds, returnNotes);
      }
      setIsReturnModalOpen(false);
      setSelectedAllocIds([]);
      window.location.reload();
    } catch (err) {
      setReturnError(err.message || 'Failed to submit return.');
      setIsSubmittingReturn(false);
    }
  };

  // Filter lists
  const filteredPromoters = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (staff.phone && staff.phone.includes(searchQuery)) ||
    (staff.store && staff.store.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAllocations = allAllocations.filter(alloc => {
    const matchesSearch = 
      alloc.staffName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (alloc.store?.name || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (alloc.workingPeriod || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (alloc.notes || '').toLowerCase().includes(ledgerSearch.toLowerCase());

    const isFullyReturned = (alloc.uniformQty === 0 || alloc.uniformReturned) && 
                            (alloc.capQty === 0 || alloc.capReturned);

    const matchesStatus = 
      ledgerFilter === 'all' ||
      (ledgerFilter === 'active' && !isFullyReturned) ||
      (ledgerFilter === 'returned' && isFullyReturned);

    return matchesSearch && matchesStatus;
  });

  // Calculate bulk selection helper sets
  const activeFilteredAllocations = filteredAllocations.filter(a => {
    const isFullyReturned = (a.uniformQty === 0 || a.uniformReturned) && 
                            (a.capQty === 0 || a.capReturned);
    return !isFullyReturned;
  });

  const isAllSelected = activeFilteredAllocations.length > 0 && 
                        activeFilteredAllocations.every(a => selectedAllocIds.includes(a.id));

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Uniform Assigning &amp; Tracking
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Allocate promoter uniforms and caps, track active store placements, working periods, and manage returns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => router.push('/dashboard/staff/assign')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <Shirt size={14} /> <span>Issue Uniform / Add Promoter</span>
          </button>
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Shirt size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Total Allocated Logs</span>
            <span className="text-2xl font-display font-extrabold text-text-primary">{totalAllocationsCount}</span>
          </div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center flex-shrink-0">
            <Inbox size={20} />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Active Allocations</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-warning">{activeAllocationsCount}</span>
              {overdueAllocationsCount > 0 && (
                <span className="text-[10px] font-extrabold text-danger bg-danger/10 border border-danger/15 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="Past working period end date and not returned">
                  {overdueAllocationsCount} overdue
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center flex-shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Returned &amp; Closed</span>
            <span className="text-2xl font-display font-extrabold text-success">{returnedAllocationsCount}</span>
          </div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center flex-shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Total Items in Field</span>
            <span className="text-2xl font-display font-extrabold text-text-primary">{totalActiveQty}</span>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border gap-6">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 font-display font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2
            ${activeTab === 'ledger' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-text-secondary hover:text-text-primary'
            }
          `}
        >
          <Inbox size={15} />
          <span>Allocations Ledger</span>
        </button>
        <button
          onClick={() => setActiveTab('promoters')}
          className={`pb-3 font-display font-bold text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2
            ${activeTab === 'promoters' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-text-secondary hover:text-text-primary'
            }
          `}
        >
          <Users size={15} />
          <span>Promoters Directory</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="w-full flex flex-col gap-4">
        {activeTab === 'ledger' ? (
          /* TAB 1: ALLOCATIONS LEDGER */
          <div className="flex flex-col gap-4">
            
            {/* Bulk Actions Bar */}
            {selectedAllocIds.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center justify-between animate-slide-down shadow-sm">
                <div className="flex items-center gap-2 text-xs text-text-primary font-bold">
                  <CheckCircle size={16} className="text-primary" />
                  <span>Selected {selectedAllocIds.length} active allocation{selectedAllocIds.length > 1 ? 's' : ''} for return</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openBulkReturnModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-success hover:bg-success-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Bulk Return Items
                  </button>
                  <button
                    onClick={() => setSelectedAllocIds([])}
                    className="px-3.5 py-1.5 bg-surface hover:bg-surface-elevated text-text-secondary rounded-lg text-xs font-semibold border border-border transition-all cursor-pointer"
                  >
                    Cancel Selection
                  </button>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2 bg-surface-elevated px-3 py-2 rounded-lg border border-border flex-1 max-w-sm">
                <Search size={15} className="text-text-muted" />
                <input 
                  type="text" 
                  className="bg-transparent border-none outline-none text-xs text-text-primary placeholder:text-text-muted w-full" 
                  placeholder="Search ledger by promoter, store, working period..." 
                  value={ledgerSearch} 
                  onChange={(e) => setLedgerSearch(e.target.value)} 
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 bg-surface-elevated p-0.5 rounded-lg border border-border">
                {[
                  { value: 'all', label: 'All Allocations' },
                  { value: 'active', label: 'Active (Out)' },
                  { value: 'returned', label: 'Returned' },
                ].map((btn) => (
                  <button
                    key={btn.value}
                    onClick={() => setLedgerFilter(btn.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer
                      ${ledgerFilter === btn.value
                        ? 'bg-surface text-text-primary shadow-sm border border-border'
                        : 'text-text-secondary hover:text-text-primary border border-transparent'
                      }
                    `}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              {filteredAllocations.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                  <Shirt size={48} />
                  <h3 className="font-display font-bold text-lg text-text-primary">No Allocations Logged</h3>
                  <p className="text-sm max-w-xs">No promoter uniform assignments match your filter parameters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <th className="py-3 px-5 w-12 text-left">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                            checked={isAllSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const activeIds = activeFilteredAllocations.map(a => a.id);
                                setSelectedAllocIds(activeIds);
                              } else {
                                setSelectedAllocIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-3 px-5">Promoter</th>
                        <th className="py-3 px-5">Store Location</th>
                        <th className="py-3 px-5">Uniform Qty</th>
                        <th className="py-3 px-5">Cap Qty</th>
                        <th className="py-3 px-5">Working Period</th>
                        <th className="py-3 px-5">Issued Date</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {filteredAllocations.map((alloc) => {
                        const showUniformAction = alloc.uniformQty > 0 && !alloc.uniformReturned;
                        const showCapAction = alloc.capQty > 0 && !alloc.capReturned;
                        const isFullyReturned = !showUniformAction && !showCapAction;
                        return (
                          <tr key={alloc.id} className="hover:bg-surface-elevated/20 transition-colors">
                            <td className="py-3.5 px-5 w-12">
                              {!isFullyReturned ? (
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary cursor-pointer"
                                  checked={selectedAllocIds.includes(alloc.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedAllocIds(prev => [...prev, alloc.id]);
                                    } else {
                                      setSelectedAllocIds(prev => prev.filter(id => id !== alloc.id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  disabled
                                  checked
                                  className="w-4 h-4 rounded text-success/40 accent-success/30 cursor-not-allowed"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex flex-col">
                                <span className="font-semibold text-xs text-text-primary">{alloc.staffName}</span>
                                <span className="text-[10px] text-text-secondary mt-0.5">Size: <strong>{alloc.staffShirtSize || 'M'}</strong></span>
                              </div>
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-1 text-xs text-text-secondary">
                                <Building2 size={13} className="text-text-muted flex-shrink-0" />
                                <span className="truncate max-w-[160px] font-semibold text-text-primary">{alloc.store?.name || 'Unknown Store'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              {alloc.uniformQty > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs font-mono">{alloc.uniformQty}</span>
                                  {alloc.uniformReturned ? (
                                    <span className="px-1.5 py-0.5 bg-success/15 text-success text-[9px] font-bold rounded">Returned</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-warning/15 text-warning text-[9px] font-bold rounded">Active</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-muted text-xs">---</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              {alloc.capQty > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs font-mono">{alloc.capQty}</span>
                                  {alloc.capReturned ? (
                                    <span className="px-1.5 py-0.5 bg-success/15 text-success text-[9px] font-bold rounded">Returned</span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 bg-warning/15 text-warning text-[9px] font-bold rounded">Active</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-muted text-xs">---</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-xs font-medium text-text-primary whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-text-primary">{alloc.workingPeriod || '---'}</span>
                                {getOverdueStatus(alloc) && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-danger bg-danger/10 border border-danger/25 px-1.5 py-0.5 rounded w-fit uppercase">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-xs text-text-secondary font-mono whitespace-nowrap">
                              {new Date(alloc.givenDate).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => router.push(`/dashboard/staff/assign?id=${alloc.id}`)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:bg-surface-elevated text-text-primary rounded text-[10px] font-bold transition-all cursor-pointer"
                                  title="Edit Assignment"
                                >
                                  <Edit2 size={10} /> <span>Edit</span>
                                </button>
                                {(showUniformAction || showCapAction) ? (
                                  <button
                                    onClick={() => openSingleReturnModal(alloc)}
                                    className="px-2 py-1 bg-success hover:bg-success-hover text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                    title="Mark both uniform and cap as returned"
                                  >
                                    Return Items
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-success uppercase tracking-wider block pr-2">
                                    Fully Returned
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 2: PROMOTERS DIRECTORY */
          <div className="flex flex-col gap-4">
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
              <span className="text-xs font-semibold text-text-secondary">{filteredPromoters.length} promoters</span>
            </div>

            {/* Table */}
            <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
              {filteredPromoters.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3 text-text-muted">
                  <Users size={48} />
                  <h3 className="font-display font-bold text-lg text-text-primary">No Promoters Found</h3>
                  <p className="text-sm max-w-xs">Register promoters first to assign them uniforms.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-text-secondary uppercase tracking-wider bg-surface-elevated/40">
                        <th className="py-3 px-5">Promoter</th>
                        <th className="py-3 px-5">Contact</th>
                        <th className="py-3 px-5">Shirt Size</th>
                        <th className="py-3 px-5">Current Store Placement</th>
                        <th className="py-3 px-5">Uniform Inventory</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-primary">
                      {filteredPromoters.map((staff) => (
                        <tr 
                          key={staff.id} 
                          className="hover:bg-surface-elevated/30 transition-all duration-150 cursor-pointer font-medium"
                          onClick={() => router.push(`/dashboard/staff/assign?editStaffId=${staff.id}`)}
                        >
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
                          <td className="py-3.5 px-5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const activeCount = staff.allocations?.filter(a => {
                                return (a.uniformQty > 0 && !a.uniformReturned) || (a.capQty > 0 && !a.capReturned);
                              }).reduce((acc, a) => acc + (a.uniformReturned ? 0 : a.uniformQty) + (a.capReturned ? 0 : a.capQty), 0) || 0;
                              
                              const totalCount = staff.allocations?.reduce((acc, a) => acc + a.uniformQty + a.capQty, 0) || 0;
                              return (
                                <button
                                  onClick={() => router.push(`/dashboard/staff/assign?staffId=${staff.id}`)}
                                  className={`text-xs inline-flex items-center gap-1.5 font-semibold hover:underline ${activeCount > 0 ? 'text-warning font-bold' : 'text-text-secondary'}`}
                                >
                                  <Shirt size={12} />
                                  <span>{activeCount} active / {totalCount} total</span>
                                </button>
                              );
                            })()}
                          </td>
                          <td className="py-3.5 px-5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                className="p-1.5 hover:bg-primary/10 text-text-secondary hover:text-primary rounded-md transition-colors" 
                                onClick={() => router.push(`/dashboard/staff/assign?staffId=${staff.id}`)} 
                                title="Issue Uniform"
                              >
                                <Shirt size={13} />
                              </button>
                              <button 
                                className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors" 
                                onClick={() => router.push(`/dashboard/staff/assign?editStaffId=${staff.id}`)} 
                                title="Edit Promoter Profile"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors" onClick={() => handlePromoterDelete(staff.id)} title="Delete Promoter">
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
        )}
      </div>

      {/* Return Remarks Modal Dialog */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-elevated/20">
              <h3 className="font-display font-extrabold text-base text-text-primary flex items-center gap-2">
                <CheckCircle className="text-success" size={18} />
                <span>Process Uniform Return</span>
              </h3>
              <button 
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleReturnSubmit} className="p-5 flex flex-col gap-4">
              {returnError && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2.5 text-xs font-semibold text-center">
                  {returnError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-text-secondary uppercase">Promoter(s) Returning Assets</span>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto">
                  {returnPromoterNames.map((name, idx) => (
                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/10">
                      {name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Return Remarks / Condition (Required)</label>
                <textarea
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-24 resize-none"
                  placeholder="e.g. Returned both yellow shirt and cap in perfect, clean condition."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-4 py-2 bg-success hover:bg-success-hover disabled:bg-success/50 text-white font-semibold text-xs rounded-lg shadow-sm transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingReturn && <Loader2 size={12} className="animate-spin" />}
                  <span>Confirm Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
