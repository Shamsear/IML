'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSupervisor } from '@/app/actions/supervisors';
import { UserCheck, Plus, Edit2, Trash2, Mail, Phone, Loader2, X, Search } from 'lucide-react';
import Link from 'next/link';
import EmptyState from '@/components/EmptyState';

export default function SupervisorsClient({ initialSupervisors }) {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState(initialSupervisors);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSupervisors = supervisors.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Supervisors
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage regional field supervisors responsible for operations and stock.
          </p>
        </div>
        <div className="has-tooltip">
          <Link 
            href="/dashboard/supervisors/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg shadow-md hover:shadow-lg transition-colors duration-200"
          >
            <Plus size={16} /> <span>Add Supervisor</span>
          </Link>
          <span className="tooltip-box">Register new team supervisor</span>
        </div>
      </header>

      <div className="flex flex-col gap-6">


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
                  actionLabel="Add Supervisor"
                  actionHref="/dashboard/supervisors/new"
                />
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSupervisors.map((supervisor) => (
                <div 
                  className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 flex flex-col gap-4 group cursor-pointer" 
                  key={supervisor.id}
                  onClick={() => router.push(`/dashboard/supervisors/${supervisor.id}/edit`)}
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
                    <Link 
                      href={`/dashboard/supervisors/${supervisor.id}/edit`} 
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-surface border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-colors duration-200"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </Link>
                    <div className="has-tooltip">
                      <button className="inline-flex items-center justify-center p-2 bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 rounded-lg text-xs font-semibold transition-colors duration-200" onClick={() => handleDelete(supervisor.id)}>
                        <Trash2 size={14} />
                      </button>
                      <span className="tooltip-box">Remove supervisor profile</span>
                    </div>
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
