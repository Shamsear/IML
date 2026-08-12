'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveCombinedAllocation, updateStaff } from '@/app/actions/staff';
import { 
  Shirt, ArrowLeft, Loader2, Save, Users, Building2, Calendar, FileText, CheckCircle2, XCircle
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import CustomSelect from '@/components/CustomSelect';

const shirtSizes = ['Small', 'Medium', 'Large', 'Xl', 'X-large', 'Xref', 'Xxl'];

export default function AssignClient({ staffList, stores, initialAllocation = null, editStaffObj = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStaffId = searchParams.get('staffId');
  const isEditMode = !!initialAllocation;
  const isEditStaffMode = !!editStaffObj;

  // Form states
  const [isNewPromoter, setIsNewPromoter] = useState(!isEditMode && !preselectedStaffId && !isEditStaffMode);
  const [promoterName, setPromoterName] = useState('');
  const [promoterPhone, setPromoterPhone] = useState('');
  const [promoterShirtSize, setPromoterShirtSize] = useState('Medium');
  const [existingStaffId, setExistingStaffId] = useState('');

  const [storeId, setStoreId] = useState('');
  const [uniformQty, setUniformQty] = useState('1');
  const [capQty, setCapQty] = useState('1');
  
  // Working Period Date fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Return statuses (for edit mode)
  const [uniformReturned, setUniformReturned] = useState(false);
  const [capReturned, setCapReturned] = useState(false);

  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      setUniformReturned(initialAllocation.uniformReturned || false);
      setCapReturned(initialAllocation.capReturned || false);
      setNotes(initialAllocation.notes || '');

      // Parse working period "YYYY-MM-DD to YYYY-MM-DD"
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

  const handleSubmit = async (e) => {
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
    if (parseInt(uniformQty, 10) === 0 && parseInt(capQty, 10) === 0) {
      setError('Please specify quantity for at least one uniform or cap.');
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

      let workingPeriodStr = '';
      if (startDate && endDate) {
        workingPeriodStr = `${startDate} to ${endDate}`;
      } else if (startDate) {
        workingPeriodStr = `From ${startDate}`;
      }
      formData.append('workingPeriod', workingPeriodStr);
      formData.append('notes', notes);

      // Return flags (only meaningful in edit mode)
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

  return (
    <div className="flex flex-col gap-6 font-sans max-w-3xl mx-auto">
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
          <h1 className="text-2xl font-display font-extrabold text-text-primary tracking-tight mt-0.5">
            {isEditStaffMode ? 'Edit Promoter Profile' : isEditMode ? 'Modify Uniform Assignment' : 'New Uniform Issue & Assignment'}
          </h1>
        </div>
      </header>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 text-xs font-semibold text-center animate-slide-down">
          {error}
        </div>
      )}

      {/* Main Combined Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* SECTION 1: PROMOTER IDENTIFICATION */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-display font-extrabold text-sm text-text-primary flex items-center gap-2 pb-3 border-b border-border">
            <Users size={16} className="text-primary" />
            <span>1. Promoter Profile Details</span>
          </h3>

          {!isEditMode && !isEditStaffMode && (
            <div className="flex items-center gap-6 pb-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input 
                  type="radio" 
                  name="promoterType" 
                  checked={isNewPromoter} 
                  onChange={() => setIsNewPromoter(true)}
                  className="accent-primary" 
                />
                <span>Register a New Promoter</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input 
                  type="radio" 
                  name="promoterType" 
                  checked={!isNewPromoter} 
                  onChange={() => setIsNewPromoter(false)}
                  className="accent-primary" 
                />
                <span>Choose Existing Promoter</span>
              </label>
            </div>
          )}

          {isEditMode || isEditStaffMode ? (
            /* EDIT MODE or STAFF EDIT MODE: Direct inputs for promoter info */
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
          ) : isNewPromoter ? (
            /* NEW PROMOTER FORM */
            <div className="flex flex-col gap-4 animate-slide-down">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    value={promoterName} 
                    onChange={(e) => setPromoterName(e.target.value)} 
                    placeholder="e.g. Saima Ijaz" 
                    required 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                  <input 
                    type="text" 
                    className="w-full bg-surface text-text-primary placeholder:text-text-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    value={promoterPhone} 
                    onChange={(e) => setPromoterPhone(e.target.value)} 
                    placeholder="+971 55 123 4567" 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Shirt Size</label>
                <CustomSelect
                  options={shirtSizes.map(size => ({ value: size, label: size }))}
                  value={promoterShirtSize}
                  onChange={(val) => setPromoterShirtSize(val)}
                  required
                />
              </div>
            </div>
          ) : (
            /* EXISTING PROMOTER SELECTOR */
            <div className="flex flex-col gap-1.5 animate-slide-down">
              <label className="text-xs font-semibold text-text-secondary">Select Registered Promoter</label>
              <CustomSelect
                options={staffList.map(s => ({ value: s.id, label: `${s.name} (Shirt Size: ${s.shirtSize || 'M'})` }))}
                value={existingStaffId}
                onChange={(val) => {
                  setExistingStaffId(val);
                  const p = staffList.find(s => s.id === val);
                  if (p && p.storeId) {
                    setStoreId(p.storeId);
                  }
                }}
                placeholder="Choose promoter..."
              />
            </div>
          )}
        </div>

        {/* SECTION 2: PLACEMENT & QUANTITY ASSIGNMENT (Hidden in Edit Staff mode) */}
        {!isEditStaffMode && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-slide-down">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Uniform Shirt Qty Given</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  value={uniformQty}
                  onChange={(e) => setUniformQty(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Cap Qty Given</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  value={capQty}
                  onChange={(e) => setCapQty(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: WORKING PERIOD & STATUS (Hidden in Edit Staff mode) */}
        {!isEditStaffMode && (
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-slide-down">
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
    </div>
  );
}
