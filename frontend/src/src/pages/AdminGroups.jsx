import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useGroups, useGroupDetails } from '../hooks/useGroups';

const COLOR_PRESETS = [
  { label: 'Indigo', value: '#4f46e5', bg: 'bg-indigo-500' },
  { label: 'Emerald', value: '#10b981', bg: 'bg-emerald-500' },
  { label: 'Violet', value: '#8b5cf6', bg: 'bg-violet-500' },
  { label: 'Amber', value: '#f59e0b', bg: 'bg-amber-500' },
  { label: 'Rose', value: '#f43f5e', bg: 'bg-rose-500' },
  { label: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-500' },
  { label: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' }
];

const CHAPTERS = [
  'All',
  'Kochi',
  'Thiruvananthapuram',
  'Kozhikode',
  'Bengaluru',
  'Other Indian Cities',
  'Overseas'
];

export default function AdminGroups() {
  const navigate = useNavigate();
  const { groups, loading, error, createGroup, updateGroup, deleteGroup, refetch } = useGroups();

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#4f46e5' });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // Manage members modal state
  const [activeGroupId, setActiveGroupId] = useState(null);

  // Search filter for groups list
  const [groupSearch, setGroupSearch] = useState('');

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups;
    const q = groupSearch.toLowerCase().trim();
    return groups.filter(g => 
      g.name.toLowerCase().includes(q) || 
      (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, groupSearch]);

  const showNotification = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback({ message: '', type: '' });
    }, 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', color: '#4f46e5' });
    setModalOpen(true);
  };

  const handleOpenEditModal = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#4f46e5'
    });
    setModalOpen(true);
  };

  const handleSubmitGroup = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setActionLoading(true);
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, formData);
        showNotification('Group updated successfully!');
      } else {
        await createGroup(formData);
        showNotification('Group created successfully!');
      }
      setModalOpen(false);
    } catch (err) {
      showNotification(err.message || 'Operation failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${group.name}"? Members will remain in the database, but this group will be removed.`
    );
    if (!confirmDelete) return;

    try {
      await deleteGroup(group.id);
      showNotification('Group deleted successfully!');
    } catch (err) {
      showNotification(err.message || 'Failed to delete group', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-700 dark:text-slate-300"
              title="Back to Dashboard"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>Member Groups</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                  {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Organize members into targeted groups for quick event invitations
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 text-sm"
          >
            <span className="material-symbols-outlined text-lg">group_add</span>
            <span className="hidden sm:inline">Create Group</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Notification Toast */}
        {feedback.message && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium transition-all ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <span className="material-symbols-outlined text-xl">
              {feedback.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">
              search
            </span>
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups by name or description..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {groupSearch && (
              <button
                onClick={() => setGroupSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Ready for event invitations</span>
          </div>
        </div>

        {/* Groups Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="animate-spin rounded-full size-12 border-3 border-slate-200 dark:border-slate-700 border-t-primary mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Loading member groups...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-rose-200 dark:border-rose-900">
            <span className="material-symbols-outlined text-4xl text-rose-500 mb-2">warning</span>
            <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
            <button
              onClick={refetch}
              className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-16 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
            <div className="size-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mb-4 text-indigo-500">
              <span className="material-symbols-outlined text-3xl">groups_2</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {groupSearch ? 'No matching groups found' : 'No Member Groups Yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
              {groupSearch
                ? `No groups match "${groupSearch}". Try clearing your search query.`
                : 'Create your first group (e.g., "Core Committee", "VIP Members", "Tech Founders") and manually add members to invite them all in 1 click!'}
            </p>
            {groupSearch ? (
              <button
                onClick={() => setGroupSearch('')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Create First Group
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredGroups.map((group) => {
              const groupColor = group.color || '#4f46e5';
              return (
                <div
                  key={group.id}
                  className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  {/* Top Color Accent Line */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: groupColor }}
                  />

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-11 rounded-xl flex items-center justify-center text-white shadow-sm font-bold text-base flex-shrink-0"
                          style={{ backgroundColor: groupColor }}
                        >
                          <span className="material-symbols-outlined text-2xl">diversity_3</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-primary transition-colors">
                            {group.name}
                          </h3>
                          <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span className="size-2 rounded-full" style={{ backgroundColor: groupColor }} />
                            <span>{group.member_count || 0} {(group.member_count === 1) ? 'Member' : 'Members'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Dropdown / Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(group)}
                          className="size-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-center transition-colors"
                          title="Edit Group"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group)}
                          className="size-8 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors"
                          title="Delete Group"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed flex-1">
                      {group.description || 'No description provided.'}
                    </p>

                    {/* Manage Members Button */}
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                      <button
                        onClick={() => setActiveGroupId(group.id)}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-700/40 dark:hover:bg-indigo-950/40 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200/80 dark:border-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">manage_accounts</span>
                        <span>Manage Members ({group.member_count || 0})</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Group Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Committee, VIP Guests, Tech Leads"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the purpose of this group..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Theme Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: preset.value })}
                      className={`size-8 rounded-full transition-transform flex items-center justify-center ${
                        formData.color === preset.value ? 'scale-110 ring-2 ring-offset-2 ring-primary dark:ring-offset-slate-900' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                    >
                      {formData.color === preset.value && (
                        <span className="material-symbols-outlined text-white text-sm">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !formData.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {activeGroupId && (
        <GroupMembersModal
          groupId={activeGroupId}
          onClose={() => {
            setActiveGroupId(null);
            refetch();
          }}
          onNotify={showNotification}
        />
      )}

      <BottomNav />
    </div>
  );
}

/**
 * Dedicated Group Members Modal with Tabbed UI:
 * Tab 1: Current Members (view & remove)
 * Tab 2: Add Members (search database, chapter filter, select multiple, add in bulk)
 */
function GroupMembersModal({ groupId, onClose, onNotify }) {
  const {
    group,
    members,
    availableMembers,
    loading,
    error,
    fetchAvailableMembers,
    addMembers,
    removeMember,
    refetch
  } = useGroupDetails(groupId);

  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'add'
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('All');
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Filter current members locally
  const filteredCurrentMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone_number?.includes(q) ||
        m.company?.toLowerCase().includes(q) ||
        m.itlc_chapter_name?.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  // Load available members whenever activeTab is 'add' or search/chapter changes
  useEffect(() => {
    if (activeTab === 'add') {
      const timer = setTimeout(() => {
        fetchAvailableMembers({
          search: memberSearch,
          chapter: selectedChapter === 'All' ? '' : selectedChapter
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [activeTab, memberSearch, selectedChapter, fetchAvailableMembers]);

  const handleToggleSelectMember = (id) => {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMemberIds(next);
  };

  const handleSelectAllAvailable = () => {
    if (selectedMemberIds.size === availableMembers.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(availableMembers.map((m) => m.id)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedMemberIds.size === 0) return;
    setSubmitting(true);
    try {
      const count = selectedMemberIds.size;
      await addMembers(Array.from(selectedMemberIds));
      setSelectedMemberIds(new Set());
      setActiveTab('current');
      onNotify(`Added ${count} member(s) to ${group?.name}!`);
    } catch (err) {
      onNotify(err.message || 'Failed to add members', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (member) => {
    const confirmRemove = window.confirm(
      `Remove ${member.full_name} from "${group?.name}"?`
    );
    if (!confirmRemove) return;

    try {
      await removeMember(member.id);
      onNotify(`Removed ${member.full_name} from group.`);
    } catch (err) {
      onNotify(err.message || 'Failed to remove member', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: group?.color || '#4f46e5' }}
            >
              <span className="material-symbols-outlined">diversity_3</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {group?.name || 'Group Members'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {members.length} members currently in this group
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Tabs */}
            <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('current');
                  setMemberSearch('');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'current'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">group</span>
                <span>Current Members ({members.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('add');
                  setMemberSearch('');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'add'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>Add Members</span>
              </button>
            </div>

            {/* Quick Actions for Add Tab */}
            {activeTab === 'add' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllAvailable}
                  disabled={availableMembers.length === 0}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
                >
                  {selectedMemberIds.size === availableMembers.length && availableMembers.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedMemberIds.size === 0 || submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>{submitting ? 'Adding...' : `Add Selected (${selectedMemberIds.size})`}</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Inputs */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={
                  activeTab === 'current'
                    ? 'Filter group members by name, company, email...'
                    : 'Search approved members database to add...'
                }
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {activeTab === 'add' && (
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {CHAPTERS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch === 'All' ? 'All Chapters' : ch}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="animate-spin rounded-full size-10 border-2 border-slate-300 dark:border-slate-700 border-t-primary mb-3" />
              <p className="text-xs text-slate-500">Loading...</p>
            </div>
          ) : activeTab === 'current' ? (
            /* Current Members List */
            filteredCurrentMembers.length === 0 ? (
              <div className="py-16 text-center">
                <div className="size-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <span className="material-symbols-outlined text-3xl">person_off</span>
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {members.length === 0 ? 'No members added yet' : 'No matching members found'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  {members.length === 0
                    ? 'Switch to the "Add Members" tab above to manually select and add approved members to this group.'
                    : 'Try clearing your search query.'}
                </p>
                {members.length === 0 && (
                  <button
                    onClick={() => setActiveTab('add')}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>Add Members Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCurrentMembers.map((member) => (
                  <div
                    key={member.id}
                    className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {member.profile_image ? (
                          <img
                            src={member.profile_image}
                            alt={member.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          member.full_name?.charAt(0) || 'M'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {member.full_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {member.designation ? `${member.designation} ` : ''}
                          {member.company ? `• ${member.company}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          {member.itlc_chapter_name && (
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {member.itlc_chapter_name}
                            </span>
                          )}
                          {member.email && <span>{member.email}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(member)}
                      className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center shrink-0 transition-colors"
                      title="Remove from Group"
                    >
                      <span className="material-symbols-outlined text-base">person_remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Add Members List */
            availableMembers.length === 0 ? (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-2">
                  check_circle
                </span>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No additional approved members available
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  All matching approved members are already part of this group.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 pb-1">
                  Showing {availableMembers.length} available members. Check the box to add to this group:
                </p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {availableMembers.map((member) => {
                    const isSelected = selectedMemberIds.has(member.id);
                    return (
                      <div
                        key={member.id}
                        onClick={() => handleToggleSelectMember(member.id)}
                        className={`py-3 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectMember(member.id)}
                            className="size-4 rounded text-primary focus:ring-primary/40 border-slate-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                            {member.profile_image ? (
                              <img
                                src={member.profile_image}
                                alt={member.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              member.full_name?.charAt(0) || 'M'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {member.full_name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {member.designation ? `${member.designation} • ` : ''}
                              {member.company || 'ITLC Member'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                              {member.itlc_chapter_name && (
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  {member.itlc_chapter_name}
                                </span>
                              )}
                              {member.email && <span>{member.email}</span>}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'current'
              ? `${members.length} member(s) enrolled`
              : `${selectedMemberIds.size} of ${availableMembers.length} selected`}
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {activeTab === 'add' && (
              <button
                onClick={handleAddSelected}
                disabled={selectedMemberIds.size === 0 || submitting}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                <span>{submitting ? 'Adding...' : `Add Selected (${selectedMemberIds.size})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
