import { Copy, PanelLeftClose, Paintbrush, Palette, Plus, Search, Settings2, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { formatRelative } from '../../lib/utils';
import { SearchInput } from '../ui/forms';
import type { PresenceProfile } from '../../lib/types';

export function ProfilesPanel() {
  const profiles = useAppStore((state) => state.profiles);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const selectProfile = useAppStore((state) => state.selectProfile);
  const createProfile = useAppStore((state) => state.createProfile);
  const duplicateProfile = useAppStore((state) => state.duplicateProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const [profileToDelete, setProfileToDelete] = useState<PresenceProfile | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInputRef.current?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); createProfile(); setActiveTab('editor'); }
      // Ctrl/Cmd+B is the same toggle VS Code and every other docked sidebar uses.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); }
      if (e.key === 'Escape') {
        if (profileToDelete) setProfileToDelete(null);
        else if (search) setSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createProfile, setActiveTab, toggleSidebar, profileToDelete, search, setSearch]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = query
      ? profiles.filter((p) =>
          p.name.toLowerCase().includes(query) ||
          p.details.toLowerCase().includes(query) ||
          p.state.toLowerCase().includes(query)
        )
      : profiles;
    // Most recently edited first. The old build split this into
    // Favorites / Recent / Templates, which showed the same profiles two or
    // three times under headings that described nothing the user had done.
    return [...matched].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [profiles, search]);

  const handleSelectProfile = (id: string) => { selectProfile(id); setActiveTab('editor'); };

  const hasProfiles = filtered.length > 0;

  return (
    <>
      <aside className="profiles-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profiles</p>
            <h2>Library</h2>
          </div>
          <div className="panel-header-actions">
            <span className="profile-count">{profiles.length}</span>
            <button
              className="icon-button"
              title="New profile (Ctrl+N)"
              aria-label="Create new profile"
              onClick={() => { createProfile(); setActiveTab('editor'); }}
            >
              <Plus size={15} />
            </button>
            <button
              className="icon-button"
              title="Hide library (Ctrl+B)"
              aria-label="Hide library panel"
              onClick={toggleSidebar}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>

        <SearchInput
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Find a profile..."
          shortcutHint="⌘K"
        />

        <div className="profile-list" ref={listRef}>
          {!hasProfiles ? (
            <div className="premium-empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon" style={{ width: 36, height: 36 }}>
                {search ? <Search size={16} /> : <Plus size={16} />}
              </div>
              <h3 className="empty-state-title" style={{ fontSize: 13 }}>
                {search ? 'No matches' : 'No profiles yet'}
              </h3>
              <p className="empty-state-description" style={{ fontSize: 12, marginTop: 2 }}>
                {search ? `Nothing matches "${search}".` : 'Create your first presence preset.'}
              </p>
              <div className="empty-state-action" style={{ marginTop: 8 }}>
                <button
                  className="ui-button ui-button--secondary ui-button--sm"
                  onClick={() => (search ? setSearch('') : createProfile())}
                >
                  {search ? 'Clear Search' : 'New Profile'}
                </button>
              </div>
            </div>
          ) : (
            filtered.map((profile) => (
              <motion.button
                layout="position"
                key={profile.id}
                className={`profile-card ${profile.id === selectedProfileId ? 'active' : ''}`}
                onClick={() => handleSelectProfile(profile.id)}
                whileTap={{ scale: 0.99 }}
              >
                {profile.id === selectedProfileId && (
                  <motion.div layoutId="profile-indicator" className="profile-indicator" />
                )}
                <div className="profile-avatar">
                  {profile.status === 'live' && <span className="live-badge" />}
                  <span className="avatar-initials">{profile.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="profile-copy">
                  <div className="profile-title-line">
                    <strong>{profile.name || 'Untitled Profile'}</strong>
                    <time dateTime={profile.updatedAt} className="profile-updated">{formatRelative(profile.updatedAt)}</time>
                  </div>
                  <p className="profile-subtitle">
                    {profile.status === 'live'
                      ? 'Live presence'
                      : profile.details || profile.state || 'No status set'}
                  </p>
                </div>
                <div className="profile-actions">
                  <button
                    type="button"
                    className={`icon-button ${profile.favorite ? 'is-favorite' : ''}`}
                    title={profile.favorite ? 'Remove star' : 'Star this profile'}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(profile.id); }}
                  >
                    <Star size={14} fill={profile.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); duplicateProfile(profile.id); setActiveTab('editor'); }}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); setProfileToDelete(profile); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.button>
            ))
          )}
        </div>

        <div className="panel-nav">
          <button
            className={activeTab === 'assets' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('assets')}
          >
            {activeTab === 'assets' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Palette size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Assets</div>
              <div className="nav-subtitle">Manage images</div>
            </div>
          </button>
          <button
            className={activeTab === 'background' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('background')}
          >
            {activeTab === 'background' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Paintbrush size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Background</div>
              <div className="nav-subtitle">Customize appearance</div>
            </div>
          </button>
          <button
            className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('settings')}
          >
            {activeTab === 'settings' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Settings2 size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Settings</div>
              <div className="nav-subtitle">App preferences</div>
            </div>
          </button>
        </div>

        <button className="floating-add-button" style={{ marginTop: 12 }} onClick={() => { createProfile(); setActiveTab('editor'); }}>
          <Plus size={18} />
          New Profile
        </button>
      </aside>

      <AnimatePresence>
        {profileToDelete && (
          <div className="modal-overlay" onClick={() => setProfileToDelete(null)}>
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="modal-header">
                <div className="modal-danger-icon"><Trash2 size={14} /></div>
                <h3 className="modal-title">Delete Profile</h3>
              </div>
              <p className="modal-description">
                Delete <strong>{profileToDelete.name}</strong>? This cannot be undone.
              </p>
              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn-cancel" onClick={() => setProfileToDelete(null)}>Cancel</button>
                <button type="button" className="modal-btn modal-btn-confirm" onClick={() => { deleteProfile(profileToDelete.id); setProfileToDelete(null); }}>Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}