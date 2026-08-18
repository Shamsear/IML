'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveCombinedAllocation, updateStaff, saveBulkCombinedAllocations } from '@/app/actions/staff';
import { 
  Shirt, ArrowLeft, Loader2, Save, Users, Building2, Calendar, FileText, CheckCircle2, XCircle, Edit2, Trash2, Plus
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

const shirtSizes = ['Small', 'Medium', 'Large', 'Xl', 'X-large', 'Xref', 'Xxl'];

export default function AssignClient({ staffList, stores, initialAllocation = null, editStaffObj = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStaffId = searchParams.get('staffId');
  const isEditMode = !!initialAllocation;
  const isEditStaffMode = !!editStaffObj;

  // Single Item states (Only used for Edit Mode)
  const [isNewPromoter, setIsNewPromoter] = useState(!isEditMode && !preselectedStaffId && !isEditStaffMode);
  const [promoterName, setPromoterName] = useState('');
  const [promoterPhone, setPromoterPhone] = useState('');
  const [promoterShirtSize, setPromoterShirtSize] = useState('Medium');
  const [existingStaffId, setExistingStaffId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [uniformQty, setUniformQty] = useState('0'); // Legacy
  const [capQty, setCapQty] = useState('0'); // Legacy
  const [allocatedItems, setAllocatedItems] = useState([]); // Dynamic items
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [uniformReturned, setUniformReturned] = useState(false);
  const [capReturned, setCapReturned] = useState(false);
  const [notes, setNotes] = useState('');

  // Bulk Queue items state (Used for Add Mode)
  const createEmptyItem = (index) => ({
    id: `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    isNewPromoter: true,
    promoterName: '',
    promoterPhone: '',
    promoterShirtSize: 'Medium',
    existingStaffId: '',
    storeId: '',
    allocatedItems: [{ id: `init-${Date.now()}`, type: '', size: 'Medium', qty: '1', returned: false }],
    startDate: '',
    endDate: '',
    notes: '',
    isExpanded: true,
    error: '',
  });

  const [items, setItems] = useState([createEmptyItem(0)]);

  // Common UI states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Derive list of previously used item types for datalist autocomplete
  const uniqueItemTypes = useMemo(() => {
    const types = new Set();
    if (Array.isArray(staffList)) {
      staffList.forEach(s => {
        (s.allocations || []).forEach(a => {
          if (a.allocatedItems) {
            const itemsList = typeof a.allocatedItems === 'string'
              ? JSON.parse(a.allocatedItems)
              : a.allocatedItems;
            if (Array.isArray(itemsList)) {
              itemsList.forEach(item => {
                if (item.type) {
                  types.add(item.type.trim());
                }
              });
            }
          }
        });
      });
    }
    return Array.from(types);
  }, [staffList]);

  // Pre-fill states from editStaffObj (Edit promoter profile only)
  useEffect(() => {
    if (editStaffObj) {
      setIsNewPromoter(false);
      setPromoterName(editStaffObj.name || '');
      setPromoterPhone(editStaffObj.phone || '');
      setPromoterShirtSize(editStaffObj.shirtSize || 'Medium');
      setStoreId(editStaffObj.storeId || '');
    }
  }, [editStaffObj]);

  // Pre-fill states from preselected staffId
  useEffect(() => {
    if (preselectedStaffId && !isEditMode && !isEditStaffMode) {
      setIsNewPromoter(false);
      setExistingStaffId(preselectedStaffId);
      const promoter = staffList.find(s => s.id === preselectedStaffId);
      if (promoter && promoter.storeId) {
        setStoreId(promoter.storeId);
      }
    }
  }, [preselectedStaffId, isEditMode, isEditStaffMode, staffList]);

  // Pre-fill states in edit mode
  useEffect(() => {
    if (initialAllocation) {
      setIsNewPromoter(false);
      setPromoterName(initialAllocation.staff?.name || '');
      setPromoterPhone(initialAllocation.staff?.phone || '');
      setPromoterShirtSize(initialAllocation.staff?.shirtSize || 'Medium');
      setExistingStaffId(initialAllocation.staffId);

      setStoreId(initialAllocation.storeId || '');
      setUniformQty(String(initialAllocation.uniformQty || 0));
      setCapQty(String(initialAllocation.capQty || 0));
      
      let parsedItems = [];
      if (initialAllocation.allocatedItems) {
        parsedItems = typeof initialAllocation.allocatedItems === 'string' 
          ? JSON.parse(initialAllocation.allocatedItems) 
          : initialAllocation.allocatedItems;
      }
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        parsedItems = [{ id: `init-${Date.now()}`, type: '', size: 'Medium', qty: '1', returned: false }];
      }
      setAllocatedItems(parsedItems);

      setUniformReturned(initialAllocation.uniformReturned || false);
      setCapReturned(initialAllocation.capReturned || false);
      setNotes(initialAllocation.notes || '');

      const period = initialAllocation.workingPeriod || '';
      if (period.includes(' to ')) {
        const parts = period.split(' to ');
        setStartDate(parts[0] || '');
        setEndDate(parts[1] || '');
      } else if (period.startsWith('From ')) {
        setStartDate(period.replace('From ', '') || '');
      } else {
        setStartDate(period);
      }
    }
  }, [initialAllocation]);

  const handleAddAllocatedItem = () => {
    setAllocatedItems(prev => [...prev, { id: `item-${Date.now()}`, type: '', size: 'Medium', qty: '1', returned: false }]);
  };

  const handleUpdateAllocatedItem = (idx, field, value) => {
    const updated = [...allocatedItems];
    updated[idx][field] = value;
    setAllocatedItems(updated);
  };

  const handleRemoveAllocatedItem = (idx) => {
    setAllocatedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Single Item Submit Handler (Edit Modes)
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Flow A: Edit promoter profile details only
    if (isEditStaffMode) {
      if (!promoterName) {
        setError('Promoter name is required.');
        return;
      }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('name', promoterName);
        formData.append('phone', promoterPhone);
        formData.append('shirtSize', promoterShirtSize);
        formData.append('storeId', storeId || '');

        await updateStaff(editStaffObj.id, formData);
        router.push('/dashboard/staff');
        router.refresh();
      } catch (err) {
        setError(err.message || 'Failed to update promoter profile.');
        setLoading(false);
      }
      return;
    }
    
    // Flow B: Issue or Edit Allocation
    if (!isNewPromoter && !existingStaffId && !isEditMode) {
      setError('Please select an existing promoter or register a new one.');
      return;
    }
    if (isNewPromoter && !promoterName && !isEditMode) {
      setError('Promoter name is required.');
      return;
    }
    if (!storeId) {
      setError('Store placement is required.');
      return;
    }
    
    const validItems = allocatedItems.filter(item => item.type.trim() && parseInt(item.qty, 10) > 0);
    const hasLegacy = parseInt(uniformQty, 10) > 0 || parseInt(capQty, 10) > 0;
    if (validItems.length === 0 && !hasLegacy) {
      setError('Please add at least one uniform item with a valid type and quantity.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('isNewPromoter', String(isNewPromoter));
      formData.append('promoterName', promoterName);
      formData.append('promoterPhone', promoterPhone);
      formData.append('promoterShirtSize', promoterShirtSize);
      formData.append('existingStaffId', existingStaffId);
      formData.append('storeId', storeId);
      formData.append('uniformQty', uniformQty);
      formData.append('capQty', capQty);
      formData.append('allocatedItems', JSON.stringify(validItems));

      let workingPeriodStr = '';
      if (startDate && endDate) {
        workingPeriodStr = `${startDate} to ${endDate}`;
      } else if (startDate) {
        workingPeriodStr = `From ${startDate}`;
      }
      formData.append('workingPeriod', workingPeriodStr);
      formData.append('notes', notes);

      formData.append('uniformReturned', String(uniformReturned));
      formData.append('capReturned', String(capReturned));

      await saveCombinedAllocation(formData, initialAllocation?.id || null);
      
      router.push('/dashboard/staff');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Failed to save uniform assignment.');
      setLoading(false);
    }
  };

  // Bulk Queue Action Handlers
  const handleAddNewItem = () => {
    setItems(prev => prev.map(item => ({ ...item, isExpanded: false })).concat(createEmptyItem(prev.length)));
  };

  const handleRemoveItem = (idx) => {
    if (items.length > 1) {
      setItems(prev => {
        const updated = prev.filter((_, i) => i !== idx);
        if (!updated.some(item => item.isExpanded)) {
          updated[updated.length - 1].isExpanded = true;
        }
        return updated;
      });
    }
  };

  const updateItemField = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleExpandItem = (idx) => {
    setItems(prev => prev.map((item, i) => ({ ...item, isExpanded: i === idx })));
  };

  const handleFinishItem = (idx) => {
    const item = items[idx];
    if (item.isNewPromoter && !item.promoterName.trim()) {
      updateItemField(idx, 'error', 'Promoter name is required');
      return;
    }
    if (!item.isNewPromoter && !item.existingStaffId) {
      updateItemField(idx, 'error', 'Please select an existing promoter');
      return;
    }
    if (!item.storeId) {
      updateItemField(idx, 'error', 'Store placement is required');
      return;
    }
    updateItemField(idx, 'isExpanded', false);
    updateItemField(idx, 'error', '');
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Bulk Validation Loop
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.isNewPromoter && !item.promoterName.trim()) {
        updateItemField(i, 'error', 'Promoter name is required');
        updateItemField(i, 'isExpanded', true);
        setLoading(false);
        return;
      }
      if (!item.isNewPromoter && !item.existingStaffId) {
        updateItemField(i, 'error', 'Please select an existing promoter');
        updateItemField(i, 'isExpanded', true);
        setLoading(false);
        return;
      }
      if (!item.storeId) {
        updateItemField(i, 'error', 'Store placement is required');
        updateItemField(i, 'isExpanded', true);
        setLoading(false);
        return;
      }
      const validItems = (item.allocatedItems || []).filter(i => i.type.trim() && parseInt(i.qty, 10) > 0);
      const hasLegacy = parseInt(item.uniformQty || 0, 10) > 0 || parseInt(item.capQty || 0, 10) > 0;
      if (validItems.length === 0 && !hasLegacy) {
        updateItemField(i, 'error', 'Please add at least one uniform item with a valid type and quantity');
        updateItemField(i, 'isExpanded', true);
        setLoading(false);
        return;
      }
    }

    try {
      const payload = {
        items: items.map(item => {
          let workingPeriodStr = '';
          if (item.startDate && item.endDate) {
            workingPeriodStr = `${item.startDate} to ${item.endDate}`;
          } else if (item.startDate) {
            workingPeriodStr = `From ${item.startDate}`;
          }
          const validAllocated = (item.allocatedItems || []).filter(i => i.type.trim() && parseInt(i.qty, 10) > 0);
          return {
            isNewPromoter: item.isNewPromoter,
            promoterName: item.promoterName,
            promoterPhone: item.promoterPhone,
            promoterShirtSize: item.promoterShirtSize,
            existingStaffId: item.existingStaffId,
            storeId: item.storeId,
            uniformQty: parseInt(item.uniformQty, 10) || 0,
            capQty: parseInt(item.capQty, 10) || 0,
            allocatedItems: validAllocated,
            workingPeriod: workingPeriodStr,
            notes: item.notes,
          };
        })
      };

      await saveBulkCombinedAllocations(payload);
      router.push('/dashboard/staff');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Failed to save uniform assignments.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans max-w-4xl mx-auto pb-10 relative">
      <div className="absolute top-0 right-0 pointer-events-none opacity-5 overflow-hidden">
        <Shirt size={250} />
      </div>
      {/* Back Header */}
      <header className="flex items-center gap-4 pb-4 border-b border-border">
        <button
          onClick={() => router.push('/dashboard/staff')}
          className="p-2 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer border border-border bg-surface"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Staff Operations</span>
          <h1 className="text-3xl font-display font-extrabold text-text-primary tracking-tight mt-0.5">
            {isEditStaffMode ? 'Edit Promoter Profile' : isEditMode ? 'Modify Uniform Assignment' : 'New Uniform Issue & Assignment'}
          </h1>
        </div>
      </header>

      <datalist id="uniform-types">
        {uniqueItemTypes.map(type => (
          <option key={type} value={type} />
        ))}
      </datalist>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 text-xs font-semibold text-center animate-slide-down">
          {error}
        </div>
      )}

      {/* RENDER EDIT MODE (SINGLE ITEM) */}
      {(isEditMode || isEditStaffMode) ? (
        <form onSubmit={handleSingleSubmit} className="flex flex-col gap-6">
          {/* SECTION 1: PROMOTER IDENTIFICATION */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="font-display font-extrabold text-sm text-text-primary flex items-center gap-2 pb-3 border-b border-border">
              <Users size={16} className="text-primary" />
              <span>1. Promoter Profile Details</span>
            </h3>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    value={promoterName} 
                    onChange={(e) => setPromoterName(e.target.value)} 
                    placeholder="Promoter Name" 
                    required 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    value={promoterPhone} 
                    onChange={(e) => setPromoterPhone(e.target.value)} 
                    placeholder="Phone number" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Shirt Size</label>
                  <CustomSelect
                    options={shirtSizes.map(size => ({ value: size, label: size }))}
                    value={promoterShirtSize}
                    onChange={(val) => setPromoterShirtSize(val)}
                    required
                  />
                </div>
                {isEditStaffMode && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Default Store Placement</label>
                    <CustomSelect
                      options={[{ value: '', label: '-- Unassigned --' }, ...stores.map(store => ({ value: store.id, label: `${store.name} (${store.region || 'DXB'})` }))]}
                      value={storeId}
                      onChange={(val) => setStoreId(val)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: PLACEMENT & QUANTITY ASSIGNMENT */}
          {!isEditStaffMode && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="font-display font-extrabold text-sm text-text-primary flex items-center gap-2 pb-3 border-b border-border">
                <Building2 size={16} className="text-primary" />
                <span>2. Placement &amp; Asset Assignment</span>
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Assigned Store Placement</label>
                <CustomSelect
                  options={stores.map(store => ({ value: store.id, label: `${store.name} (${store.region || 'DXB'})` }))}
                  value={storeId}
                  onChange={(val) => setStoreId(val)}
                  placeholder="Choose outlet store..."
                />
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <label className="text-xs font-semibold text-text-secondary">Assigned Uniform Items</label>
                {allocatedItems.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5 flex flex-col gap-1.5">
                      <label className="text-[10px] text-text-muted">Item Type</label>
                      <input
                        type="text"
                        placeholder="e.g. Chef Hat, Abaya, Frock"
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        value={item.type}
                        onChange={(e) => handleUpdateAllocatedItem(idx, 'type', e.target.value)}
                        list="uniform-types"
                        required
                      />
                    </div>
                    <div className="col-span-4 flex flex-col gap-1.5">
                      <label className="text-[10px] text-text-muted">Size</label>
                      <CustomSelect
                        options={[...shirtSizes.map(s => ({ value: s, label: s })), { value: 'N/A', label: 'N/A' }]}
                        value={item.size}
                        onChange={(val) => handleUpdateAllocatedItem(idx, 'size', val)}
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <label className="text-[10px] text-text-muted">Qty</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                        value={item.qty}
                        onChange={(e) => handleUpdateAllocatedItem(idx, 'qty', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pb-1">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAllocatedItem(idx)}
                        className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddAllocatedItem}
                  className="w-fit mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border hover:border-primary hover:text-primary text-text-secondary rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add Another Item
                </button>
              </div>

              {(parseInt(uniformQty, 10) > 0 || parseInt(capQty, 10) > 0) && (
                <div className="mt-4 p-4 border border-warning/30 bg-warning/5 rounded-xl flex flex-col gap-3">
                  <span className="text-xs font-bold text-warning flex items-center gap-1.5">Legacy Assignment (Read-only)</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-sm text-text-secondary">Uniform Qty: <strong className="text-text-primary">{uniformQty}</strong></div>
                    <div className="text-sm text-text-secondary">Cap Qty: <strong className="text-text-primary">{capQty}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: WORKING PERIOD & STATUS */}
          {!isEditStaffMode && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <h3 className="font-display font-extrabold text-sm text-text-primary flex items-center gap-2 pb-3 border-b border-border">
                <Calendar size={16} className="text-primary" />
                <span>3. Duration &amp; Return Status</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Campaign Start Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Campaign End Date</label>
                  <input
                    type="date"
                    className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {isEditMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <label className="flex items-center gap-3 p-3 bg-surface-elevated/40 border border-border rounded-xl cursor-pointer hover:bg-surface-elevated/60 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={uniformReturned} 
                      onChange={(e) => setUniformReturned(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary" 
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-text-primary">Uniform Shirt Returned</span>
                      <span className="text-[10px] text-text-secondary">Toggle once promoter returns the shirt</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-surface-elevated/40 border border-border rounded-xl cursor-pointer hover:bg-surface-elevated/60 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={capReturned} 
                      onChange={(e) => setCapReturned(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary" 
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-text-primary">Cap Returned</span>
                      <span className="text-[10px] text-text-secondary">Toggle once promoter returns the cap</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                  <FileText size={13} />
                  <span>Remarks / Delivery Notes</span>
                </label>
                <textarea
                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-20 resize-none"
                  placeholder="e.g. Brand new yellow uniform, delivered to Lulu Hypermarket."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* SUBMIT BUTTONS */}
          <div className="flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={() => router.push('/dashboard/staff')}
              className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{isEditStaffMode || isEditMode ? 'Save Changes' : 'Confirm Assignment'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* RENDER ADD MODE (BULK QUEUE ACCORDION LIST) */
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            {items.map((item, idx) => {
              const store = stores.find(s => s.id === item.storeId);
              const existingStaff = staffList.find(s => s.id === item.existingStaffId);
              const promoterDisplayName = item.isNewPromoter
                ? (item.promoterName || `Promoter Entry #${idx + 1}`)
                : (existingStaff?.name || `Selected Existing Promoter`);

              return (
                <div 
                  key={item.id} 
                  className={`bg-surface border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden
                    ${item.isExpanded ? 'border-primary ring-2 ring-primary/5' : 'border-border hover:border-text-secondary/30'}
                  `}
                >
                  {/* 1. COLLAPSED PREVIEW CARD */}
                  {!item.isExpanded && (
                    <div 
                      onClick={() => handleExpandItem(idx)}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-elevated/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            {promoterDisplayName}
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider
                              ${item.isNewPromoter ? 'bg-success/15 text-success border border-success/20' : 'bg-info/15 text-info border border-info/20'}
                            `}>
                              {item.isNewPromoter ? 'New' : 'Existing'}
                            </span>
                          </span>
                          <span className="text-[10px] text-text-secondary block mt-0.5">
                            Placed at: <strong className="text-text-primary">{store?.name || 'Unassigned'}</strong>
                            <span className="mx-1 text-text-muted">•</span>
                            Shirts: <strong className="text-text-primary">{item.uniformQty}</strong>, Caps: <strong className="text-text-primary">{item.capQty}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleExpandItem(idx)}
                          className="p-1.5 hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-md transition-colors"
                          title="Expand Entry"
                        >
                          <Edit2 size={13} />
                        </button>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                            title="Remove Entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. EXPANDED FORM CARD */}
                  {item.isExpanded && (
                    <div className="p-6 sm:p-8 flex flex-col gap-6">
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Promoter Assignment #{idx + 1}</span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="inline-flex items-center gap-1 text-xs text-danger hover:underline font-semibold"
                          >
                            <Trash2 size={12} />
                            <span>Remove Assignment</span>
                          </button>
                        )}
                      </div>

                      {item.error && (
                        <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg p-2.5 text-xs font-semibold flex items-center gap-2">
                          <XCircle size={14} />
                          <span>{item.error}</span>
                        </div>
                      )}

                      {/* SECTION 1: PROMOTER IDENTIFICATION */}
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-6 pb-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                            <input 
                              type="radio" 
                              name={`promoterType-${item.id}`} 
                              checked={item.isNewPromoter} 
                              onChange={() => updateItemField(idx, 'isNewPromoter', true)}
                              className="accent-primary" 
                            />
                            <span>Register a New Promoter</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                            <input 
                              type="radio" 
                              name={`promoterType-${item.id}`} 
                              checked={!item.isNewPromoter} 
                              onChange={() => updateItemField(idx, 'isNewPromoter', false)}
                              className="accent-primary" 
                            />
                            <span>Choose Existing Promoter</span>
                          </label>
                        </div>

                        {item.isNewPromoter ? (
                          <div className="flex flex-col gap-4 animate-slide-down">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                                  value={item.promoterName} 
                                  onChange={(e) => updateItemField(idx, 'promoterName', e.target.value)} 
                                  placeholder="e.g. Saima Ijaz" 
                                  required 
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                                <input 
                                  type="text" 
                                  className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                                  value={item.promoterPhone} 
                                  onChange={(e) => updateItemField(idx, 'promoterPhone', e.target.value)} 
                                  placeholder="+971 55 123 4567" 
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-text-secondary">Shirt Size</label>
                              <CustomSelect
                                options={shirtSizes.map(size => ({ value: size, label: size }))}
                                value={item.promoterShirtSize}
                                onChange={(val) => updateItemField(idx, 'promoterShirtSize', val)}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 animate-slide-down">
                            <label className="text-xs font-semibold text-text-secondary">Select Registered Promoter</label>
                            <CustomSelect
                              options={staffList.map(s => ({ value: s.id, label: `${s.name} (Shirt Size: ${s.shirtSize || 'M'})` }))}
                              value={item.existingStaffId}
                              onChange={(val) => {
                                updateItemField(idx, 'existingStaffId', val);
                                const p = staffList.find(s => s.id === val);
                                if (p && p.storeId) {
                                  updateItemField(idx, 'storeId', p.storeId);
                                }
                              }}
                              placeholder="Choose promoter..."
                            />
                          </div>
                        )}
                      </div>

                      {/* SECTION 2: PLACEMENT & QUANTITY ASSIGNMENT */}
                      <div className="flex flex-col gap-4 pt-4 border-t border-border/60">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary">Assigned Store Placement</label>
                          <CustomSelect
                            options={stores.map(store => ({ value: store.id, label: `${store.name} (${store.region || 'DXB'})` }))}
                            value={item.storeId}
                            onChange={(val) => updateItemField(idx, 'storeId', val)}
                            placeholder="Choose outlet store..."
                          />
                        </div>

                        <div className="flex flex-col gap-3 mt-2">
                          <label className="text-xs font-semibold text-text-secondary">Assigned Uniform Items</label>
                          {(item.allocatedItems || []).map((allocItem, allocIdx) => (
                            <div key={allocItem.id} className="grid grid-cols-12 gap-3 items-end">
                              <div className="col-span-5 flex flex-col gap-1.5">
                                <label className="text-[10px] text-text-muted">Item Type</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Chef Hat, Abaya"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                  value={allocItem.type}
                                  onChange={(e) => {
                                    const updatedAllocItems = [...(item.allocatedItems || [])];
                                    updatedAllocItems[allocIdx].type = e.target.value;
                                    updateItemField(idx, 'allocatedItems', updatedAllocItems);
                                  }}
                                  list="uniform-types"
                                  required
                                />
                              </div>
                              <div className="col-span-4 flex flex-col gap-1.5">
                                <label className="text-[10px] text-text-muted">Size</label>
                                <CustomSelect
                                  options={[...shirtSizes.map(s => ({ value: s, label: s })), { value: 'N/A', label: 'N/A' }]}
                                  value={allocItem.size}
                                  onChange={(val) => {
                                    const updatedAllocItems = [...(item.allocatedItems || [])];
                                    updatedAllocItems[allocIdx].size = val;
                                    updateItemField(idx, 'allocatedItems', updatedAllocItems);
                                  }}
                                />
                              </div>
                              <div className="col-span-2 flex flex-col gap-1.5">
                                <label className="text-[10px] text-text-muted">Qty</label>
                                <input
                                  type="number"
                                  min="1"
                                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                  value={allocItem.qty}
                                  onChange={(e) => {
                                    const updatedAllocItems = [...(item.allocatedItems || [])];
                                    updatedAllocItems[allocIdx].qty = e.target.value;
                                    updateItemField(idx, 'allocatedItems', updatedAllocItems);
                                  }}
                                  required
                                />
                              </div>
                              <div className="col-span-1 flex justify-center pb-1">
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const updatedAllocItems = (item.allocatedItems || []).filter((_, i) => i !== allocIdx);
                                    updateItemField(idx, 'allocatedItems', updatedAllocItems);
                                  }}
                                  className="p-1.5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-md transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const updatedAllocItems = [...(item.allocatedItems || []), { id: `item-${Date.now()}`, type: '', size: 'Medium', qty: '1', returned: false }];
                              updateItemField(idx, 'allocatedItems', updatedAllocItems);
                            }}
                            className="w-fit mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border hover:border-primary hover:text-primary text-text-secondary rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Plus size={14} /> Add Another Item
                          </button>
                        </div>
                      </div>

                      {/* SECTION 3: WORKING PERIOD & STATUS */}
                      <div className="flex flex-col gap-4 pt-4 border-t border-border/60">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Campaign Start Date</label>
                            <input
                              type="date"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                              value={item.startDate}
                              onChange={(e) => updateItemField(idx, 'startDate', e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-text-secondary">Campaign End Date</label>
                            <input
                              type="date"
                              className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                              value={item.endDate}
                              onChange={(e) => updateItemField(idx, 'endDate', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                            <FileText size={13} />
                            <span>Remarks / Delivery Notes</span>
                          </label>
                          <textarea
                            className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all h-20 resize-none"
                            placeholder="e.g. Brand new uniform package."
                            value={item.notes}
                            onChange={(e) => updateItemField(idx, 'notes', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-border">
                        <button
                          type="button"
                          onClick={() => handleFinishItem(idx)}
                          className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-lg shadow cursor-pointer"
                        >
                          Finish &amp; Collapse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add entry row trigger button */}
          <button
            type="button"
            onClick={handleAddNewItem}
            className="w-full py-4 border-2 border-dashed border-border hover:border-primary/50 text-text-secondary hover:text-primary rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all bg-surface/50 hover:bg-surface duration-200 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Another Promoter Assignment</span>
          </button>

          {/* SUBMIT BUTTONS */}
          <div className="flex justify-end gap-3 mt-4 pt-5 border-t border-border">
            <button 
              type="button" 
              onClick={() => router.push('/dashboard/staff')}
              className="px-5 py-2.5 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>Issue &amp; Save All Assignments</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

