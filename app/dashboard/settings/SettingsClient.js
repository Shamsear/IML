'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Bell, 
  Info, 
  Trash2, 
  CheckCircle2, 
  Users, 
  UserPlus, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Pencil, 
  Lock, 
  Sparkles, 
  X, 
  AlertCircle, 
  Loader2, 
  Shield, 
  User, 
  Share2 
} from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { createUser, updateUser, deleteUser, getUsers } from '@/app/actions/users';

function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
}

function generateRandomPassword() {
  const prefixes = ['Viewer', 'Auditor', 'Review', 'Stock', 'Inventory', 'Client'];
  const symbols = ['@', '#', '$', '!', '&'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${symbol}${num}`;
}

export default function SettingsClient({ config, user, initialUsers = [] }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'system'
  const [usersList, setUsersList] = useState(initialUsers);
  const [cacheStatus, setCacheStatus] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const toast = useToast();

  // Push notifications
  const [pushStatus, setPushStatus] = useState('default');

  // Cache confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '' });

  // User management modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [createdUserModal, setCreatedUserModal] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'VIEWER',
    showPassword: true,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'VIEWER',
    isActive: true,
    showPassword: false,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete user state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Revealed passwords state: { [userId]: boolean }
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  const togglePasswordReveal = (userId) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleCopy = async (text, key) => {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      toast.success('Copied!', 'Text copied to clipboard.');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      toast.error('Copy Failed', 'Could not copy to clipboard.');
    }
  };

  const handleCopyCredentials = (u) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = [
      `Inventory System Access Credentials`,
      `Name: ${u.name}`,
      `Username: ${u.username}`,
      `Password: ${u.clearPassword || '(Contact Admin)'}`,
      `Role: ${u.role === 'VIEWER' ? 'Read-Only Viewer' : 'Administrator'}`,
      `Login URL: ${origin}/login`
    ].join('\n');
    handleCopy(text, `full-${u.id}`);
  };

  // Open create modal with fresh state
  const handleOpenCreateModal = () => {
    const randomPass = generateRandomPassword();
    setCreateForm({
      name: '',
      username: '',
      password: randomPass,
      role: 'VIEWER',
      showPassword: true,
    });
    setCreateError('');
    setIsCreateOpen(true);
  };

  // Auto-fill username when name is entered if username is still empty or default
  const handleNameChange = (val) => {
    setCreateForm(prev => {
      const cleanName = val.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
      const shouldUpdateUsername = !prev.username || prev.username === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
      return {
        ...prev,
        name: val,
        username: shouldUpdateUsername ? cleanName : prev.username
      };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    try {
      if (!createForm.name.trim()) throw new Error('Please enter the full name.');
      if (!createForm.username.trim()) throw new Error('Please enter a username.');
      if (!createForm.password.trim()) throw new Error('Please enter a password.');
      if (createForm.password.trim().length < 4) throw new Error('Password must be at least 4 characters long.');

      const newUser = await createUser({
        name: createForm.name,
        username: createForm.username,
        password: createForm.password,
        role: createForm.role,
      });

      // Update state
      setUsersList(prev => [newUser, ...prev]);
      setIsCreateOpen(false);

      // Open credentials view modal so admin can view/copy right away
      setCreatedUserModal(newUser);
      toast.success('Account Created', `User "${newUser.name}" successfully created.`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create user account.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      password: '',
      role: u.role,
      isActive: u.isActive,
      showPassword: false,
    });
    setEditError('');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    setEditError('');

    try {
      const updated = await updateUser(editingUser.id, {
        name: editForm.name,
        username: editForm.username,
        role: editForm.role,
        isActive: editForm.isActive,
        password: editForm.password ? editForm.password : undefined,
      });

      setUsersList(prev => prev.map(u => u.id === updated.id ? updated : u));
      setIsEditOpen(false);
      setEditingUser(null);
      toast.success('User Updated', `Account "${updated.name}" updated successfully.`);
    } catch (err) {
      setEditError(err.message || 'Failed to update user account.');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePromptDelete = (u) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteUser(userToDelete.id);
      setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
      toast.success('User Deleted', `Account "${userToDelete.name}" has been deleted.`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      toast.error('Delete Failed', err.message || 'Could not delete user.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Not Supported', 'This browser does not support desktop push notifications.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission === 'granted') {
        setConfirmData({ title: 'Notifications Enabled', message: 'Push notifications are now active for this browser.' });
        setConfirmOpen(true);
      } else if (permission === 'denied') {
        toast.error('Permission Denied', 'Please reset site settings in your browser address bar to allow notifications.');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const handleClearCache = async () => {
    setCacheStatus('Clearing...');
    try {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
        
        if ('caches' in window) {
          const keys = await caches.keys();
          for (let key of keys) {
            await caches.delete(key);
          }
        }
      }
      
      localStorage.clear();
      setCacheStatus('Cleared!');
      setConfirmData({ title: 'Cache Cleared', message: 'Service worker registrations and asset cache have been cleared. The page will reload.' });
      setConfirmOpen(true);
    } catch (e) {
      console.error(e);
      setCacheStatus('Failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 font-sans">
      {/* Header */}
      <header className="pb-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text-primary tracking-tight">
            Settings &amp; Access Control
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-1">
            Manage system users, viewer accounts, permissions, and diagnostic preferences
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/80 border border-border rounded-xl self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-surface text-text-primary shadow-xs border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users size={14} className={activeTab === 'users' ? 'text-primary' : ''} />
            <span>User Accounts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-bold">
              {usersList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === 'system'
                ? 'bg-surface text-text-primary shadow-xs border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Settings size={14} className={activeTab === 'system' ? 'text-primary' : ''} />
            <span>System Diagnostics</span>
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="bg-success/10 border border-success/20 text-success rounded-lg p-4 text-xs font-semibold flex items-center gap-2.5 animate-slide-down">
          <CheckCircle2 size={15} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Confirmation modal for cache clearing */}
      <ConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setCacheStatus(''); setSuccessMsg(''); }}
        type="success"
        title={confirmData.title}
        message={confirmData.message}
      />

      {/* Confirmation modal for user deletion */}
      <ConfirmModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setUserToDelete(null); }}
        onConfirm={handleConfirmDelete}
        type="confirm"
        danger={true}
        title="Delete User Account?"
        message={`Are you sure you want to permanently delete the account for "${userToDelete?.name}" (@${userToDelete?.username})? This action cannot be undone.`}
        confirmLabel={deleteLoading ? "Deleting..." : "Delete User"}
      />

      {/* TAB 1: USER ACCOUNTS & VIEWER CREDENTIALS */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">
          {/* Action Bar & Summary Card */}
          <div className="bg-surface border border-border p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-primary">
                  User Accounts &amp; Viewer Management
                </h2>
                <p className="text-xs text-text-secondary mt-0.5 max-w-xl leading-relaxed">
                  Viewer accounts have strictly <strong>zero write permissions</strong>. They can view, audit, search, and export reports, but cannot add, edit, or delete any data.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer shadow-xs hover:shadow shrink-0"
            >
              <UserPlus size={16} />
              <span>Create Viewer Account</span>
            </button>
          </div>

          {/* Users Table (Desktop) */}
          <div className="hidden md:block bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                System Accounts ({usersList.length})
              </span>
              <span className="text-2xs text-text-muted">
                Passwords can be revealed and copied by System Administrators
              </span>
            </div>

            <table className="min-w-full divide-y divide-border text-left">
              <thead>
                <tr className="bg-surface-elevated/20 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                  <th className="py-3 pl-5 pr-4">User Details</th>
                  <th className="py-3 px-4">Role &amp; Permissions</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Password</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 pl-4 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80 text-xs">
                {usersList.map((u) => {
                  const isCurrent = u.id === user?.id;
                  const isViewer = u.role === 'VIEWER';
                  const isRevealed = !!revealedPasswords[u.id];

                  return (
                    <tr key={u.id} className="hover:bg-surface-elevated/30 transition-colors">
                      {/* Name & Username */}
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isViewer ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          }`}>
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text-primary text-xs truncate">{u.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-primary/10 text-primary border border-primary/20">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-text-muted truncate">
                              @{u.username}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isViewer ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                            <Shield size={12} />
                            <span>Read-Only Viewer</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <ShieldCheck size={12} />
                            <span>Administrator</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.isActive ? 'text-success' : 'text-danger'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-success' : 'bg-danger'}`} />
                          <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                        </span>
                      </td>

                      {/* Password */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 bg-surface-elevated/70 border border-border rounded-lg px-2.5 py-1">
                          <KeyRound size={13} className="text-text-muted shrink-0" />
                          <span className={`font-mono text-xs select-all ${isRevealed ? 'font-bold text-text-primary' : 'text-text-muted tracking-wider'}`}>
                            {u.clearPassword ? (isRevealed ? u.clearPassword : '••••••••') : '(Hashed in DB)'}
                          </span>

                          {u.clearPassword && (
                            <>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(u.id)}
                                title={isRevealed ? 'Hide Password' : 'Show Password'}
                                className="p-1 hover:bg-surface text-text-muted hover:text-text-primary rounded transition-colors cursor-pointer ml-1"
                              >
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopy(u.clearPassword, `pass-${u.id}`)}
                                title="Copy Password"
                                className="p-1 hover:bg-surface text-text-muted hover:text-primary rounded transition-colors cursor-pointer"
                              >
                                {copiedKey === `pass-${u.id}` ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-text-muted text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(u)}
                            title="Copy Full Login Credentials"
                            className="p-1.5 rounded-lg border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            {copiedKey === `full-${u.id}` ? <Check size={14} className="text-success" /> : <Share2 size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            title="Edit User Account"
                            className="p-1.5 rounded-lg border border-border hover:bg-surface-elevated text-text-secondary hover:text-primary transition-colors cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handlePromptDelete(u)}
                              title="Delete User Account"
                              className="p-1.5 rounded-lg border border-border hover:bg-danger/10 text-text-muted hover:text-danger hover:border-danger/30 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Users Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3">
            {usersList.map((u) => {
              const isCurrent = u.id === user?.id;
              const isViewer = u.role === 'VIEWER';
              const isRevealed = !!revealedPasswords[u.id];

              return (
                <div key={u.id} className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isViewer ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}>
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text-primary text-sm truncate">{u.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary">You</span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-text-muted">@{u.username}</span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      isViewer ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}>
                      {isViewer ? 'Viewer' : 'Admin'}
                    </span>
                  </div>

                  {/* Password Bar */}
                  <div className="flex items-center justify-between p-2.5 bg-surface-elevated/70 rounded-xl border border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound size={14} className="text-text-muted shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Password</span>
                        <span className={`font-mono text-xs ${isRevealed ? 'font-bold text-text-primary' : 'text-text-muted tracking-wider'}`}>
                          {u.clearPassword ? (isRevealed ? u.clearPassword : '••••••••') : '(Hashed in DB)'}
                        </span>
                      </div>
                    </div>

                    {u.clearPassword && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => togglePasswordReveal(u.id)}
                          className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text-primary"
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(u.clearPassword, `pass-${u.id}`)}
                          className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-primary"
                        >
                          {copiedKey === `pass-${u.id}` ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/80">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${u.isActive ? 'text-success' : 'text-danger'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-success' : 'bg-danger'}`} />
                      <span>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCredentials(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-semibold text-text-secondary hover:text-text-primary"
                      >
                        <Share2 size={13} />
                        <span>Copy All</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(u)}
                        className="p-1.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-primary"
                      >
                        <Pencil size={14} />
                      </button>

                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handlePromptDelete(u)}
                          className="p-1.5 rounded-lg bg-surface border border-border text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM DIAGNOSTICS & CACHE */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left Side: Navigation Info */}
          <div className="md:col-span-1 flex flex-col gap-4">
            <div className="bg-surface border border-border p-5 rounded-2xl shadow-xs">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">System Parameters</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Review runtime environment configurations, database endpoints, and active security policies.
              </p>
            </div>
            
            <div className="bg-surface border border-border p-5 rounded-2xl shadow-xs flex flex-col gap-3">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Security Policy</span>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="text-success flex-shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-text-primary block">SSL Connection Enforced</span>
                  <span className="text-[11px] text-text-secondary block mt-0.5 leading-relaxed">
                    Database and ImageKit interactions require secure transport channels.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Configuration Blocks */}
          <div className="md:col-span-2 flex flex-col gap-6">
            {/* Browser Push Notifications */}
            <div className="bg-surface border border-border p-6 rounded-2xl shadow-xs flex flex-col gap-4">
              <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
                <Bell size={18} className="text-primary" />
                <span>Browser Push Notifications</span>
              </h3>
              
              <p className="text-xs text-text-secondary leading-relaxed">
                Enable real-time push notifications in this browser to receive automatic alerts when items are inbound, outbound, or overdue.
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-elevated/40 p-4 rounded-xl border border-border">
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-secondary block">Notification Permission</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md mt-1 border
                    ${pushStatus === 'granted' ? 'bg-success/10 text-success border-success/20' : 
                      pushStatus === 'denied' ? 'bg-danger/10 text-danger border-danger/20' : 'bg-warning/10 text-warning border-warning/20'}
                  `}>
                    {pushStatus === 'granted' ? 'Allowed & Active' : 
                     pushStatus === 'denied' ? 'Blocked by Browser' : 'Not Configured (Default)'}
                  </span>
                </div>
                
                <div>
                  {pushStatus !== 'granted' && (
                    <button 
                      type="button"
                      onClick={handleEnableNotifications}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-xs"
                    >
                      <Bell size={14} />
                      <span>Enable Push Notifications</span>
                    </button>
                  )}
                  {pushStatus === 'granted' && (
                    <span className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                      <CheckCircle2 size={14} className="text-success" />
                      <span>Configured in this browser</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostics Utilities */}
            <div className="bg-surface border border-border p-6 rounded-2xl shadow-xs flex flex-col gap-4">
              <h3 className="font-display font-bold text-base text-text-primary flex items-center gap-2 pb-2 border-b border-border">
                <Info size={18} className="text-text-secondary" />
                <span>System Cache &amp; Diagnostics</span>
              </h3>
              
              <p className="text-xs text-text-secondary leading-relaxed">
                If assets (logos, images, text layouts) are not rendering correctly after a code change, you can force-clear your local browser's Service Worker registries and asset cache buckets.
              </p>
              
              <div className="flex justify-start">
                <button 
                  type="button"
                  onClick={handleClearCache}
                  disabled={!!cacheStatus}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-danger/10 hover:bg-danger text-danger hover:text-white rounded-xl text-xs font-bold border border-danger/20 transition-all duration-200 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{cacheStatus || 'Clear Browser Application Cache'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">Create User Account</h3>
                  <p className="text-xs text-text-secondary">
                    Set custom name, username, and password for the user
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 flex flex-col gap-4">
              {createError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Full Name / Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dubai Audit Team, External Auditor"
                  value={createForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Username (For Login) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono">@</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. audit_viewer"
                    value={createForm.username}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Custom Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, password: generateRandomPassword() }))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Generate New</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={createForm.showPassword ? "text" : "password"}
                    required
                    placeholder="Enter custom password..."
                    value={createForm.password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 cursor-pointer"
                  >
                    {createForm.showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="text-[11px] text-text-muted">
                  You will be able to view and copy this password anytime from this Settings page.
                </span>
              </div>

              {/* Role Selection */}
              <div className="flex flex-col gap-2 pt-1">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Access Role *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    createForm.role === 'VIEWER' 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                      : 'border-border bg-surface-elevated/20 hover:border-border/80'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="createRole"
                        value="VIEWER"
                        checked={createForm.role === 'VIEWER'}
                        onChange={() => setCreateForm(prev => ({ ...prev, role: 'VIEWER' }))}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="font-bold text-xs text-text-primary">Read-Only Viewer</span>
                    </div>
                    <span className="text-[11px] text-text-muted mt-1 pl-5">
                      Full view, audit, search &amp; export. Strictly zero write permissions.
                    </span>
                  </label>

                  <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    createForm.role === 'ADMIN' 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                      : 'border-border bg-surface-elevated/20 hover:border-border/80'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="createRole"
                        value="ADMIN"
                        checked={createForm.role === 'ADMIN'}
                        onChange={() => setCreateForm(prev => ({ ...prev, role: 'ADMIN' }))}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="font-bold text-xs text-text-primary">Administrator</span>
                    </div>
                    <span className="text-[11px] text-text-muted mt-1 pl-5">
                      Full access to create, edit, delete data, and manage settings.
                    </span>
                  </label>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {createLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>{createLoading ? 'Creating Account...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: POST-CREATION CREDENTIALS DISPLAY */}
      {createdUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-in-95 duration-150">
            {/* Header */}
            <div className="p-6 bg-emerald-500/10 border-b border-emerald-500/20 text-center flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="font-display font-black text-lg text-text-primary">
                Account Created Successfully!
              </h3>
              <p className="text-xs text-text-secondary max-w-xs">
                Here are the login credentials for <strong>{createdUserModal.name}</strong>:
              </p>
            </div>

            {/* Credentials Card */}
            <div className="p-5 flex flex-col gap-3">
              <div className="bg-surface-elevated border border-border rounded-xl p-4 flex flex-col gap-2.5">
                {/* Username */}
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <span className="text-[11px] font-bold text-text-secondary uppercase">Username</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-text-primary select-all">
                      {createdUserModal.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(createdUserModal.username, 'modal-user')}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedKey === 'modal-user' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <span className="text-[11px] font-bold text-text-secondary uppercase">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-primary px-2 py-0.5 rounded bg-primary/10 select-all">
                      {createdUserModal.clearPassword}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(createdUserModal.clearPassword, 'modal-pass')}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedKey === 'modal-pass' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <span className="text-[11px] font-bold text-text-secondary uppercase">Role</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                    {createdUserModal.role === 'VIEWER' ? 'Read-Only Viewer' : 'Administrator'}
                  </span>
                </div>

                {/* Login URL */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-secondary uppercase">Login Page</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-muted truncate max-w-[180px]">
                      {typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(typeof window !== 'undefined' ? `${window.location.origin}/login` : '', 'modal-url')}
                      className="p-1 rounded hover:bg-surface text-text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      {copiedKey === 'modal-url' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Copy All Button */}
              <button
                type="button"
                onClick={() => handleCopyCredentials(createdUserModal)}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs"
              >
                {copiedKey === `full-${createdUserModal.id}` ? (
                  <>
                    <Check size={15} />
                    <span>All Credentials Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={15} />
                    <span>Copy All Credentials to Clipboard</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCreatedUserModal(null)}
                className="w-full py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                Close &amp; Back to Users List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT USER MODAL */}
      {isEditOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col scale-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-elevated/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">Edit Account: {editingUser.name}</h3>
                  <p className="text-xs text-text-secondary">
                    Update user name, role, status, or set a new password
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              {editError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Full Name / Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Set New Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Change Password (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, password: generateRandomPassword() }))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={editForm.showPassword ? "text" : "password"}
                    placeholder="Leave blank to keep existing password..."
                    value={editForm.password}
                    onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-surface-elevated/40 text-text-primary placeholder:text-text-muted border border-border rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 cursor-pointer"
                  >
                    {editForm.showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="text-[11px] text-text-muted">
                  If changed, the new password will immediately be viewable by administrators.
                </span>
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary"
                  >
                    <option value="VIEWER">Read-Only Viewer</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Account Status
                  </label>
                  <select
                    value={editForm.isActive ? "true" : "false"}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.value === "true" }))}
                    className="w-full bg-surface-elevated/40 text-text-primary border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary"
                  >
                    <option value="true">Active (Can Login)</option>
                    <option value="false">Disabled (Suspended)</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {editLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>{editLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
