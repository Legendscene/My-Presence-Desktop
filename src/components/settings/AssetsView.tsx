import { Upload, Trash2, FileImage, Film, FolderOpen, Copy, Check, ArrowRight } from 'lucide-react';
import { useMemo, useCallback, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { SearchInput } from '../ui/forms';
import type { AssetItem } from '../../lib/types';

export function AssetsView() {
  const assets = useAppStore((state) => state.assets);
  const addAsset = useAppStore((state) => state.addAsset);
  const deleteAsset = useAppStore((state) => state.deleteAsset);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const profiles = useAppStore((state) => state.profiles);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const setActiveTab = useAppStore((state) => state.setActiveTab);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedFeedback, setAppliedFeedback] = useState<{ id: string; slot: 'large' | 'small' } | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const filtered = useMemo(
    () => assets.filter((asset) => asset.name.toLowerCase().includes(search.toLowerCase())),
    [assets, search]
  );

  const handleImport = useCallback(async () => {
    const bridge = window.myPresenceDesktop;
    if (bridge?.uploadImage) {
      const result = await bridge.uploadImage();
      if (result.ok) {
        const name = result.fileName.replace(/\.[^.]+$/, '') || 'Imported image';
        addAsset({ name, kind: 'library', accent: '#7c6cff', url: result.url });
      }
    }
  }, [addAsset]);

  const handleCopy = useCallback((asset: AssetItem) => {
    const textToCopy = asset.url || asset.name;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1800);
  }, []);

  const handleApply = useCallback((asset: AssetItem, slot: 'largeImage' | 'smallImage') => {
    if (!selectedProfileId) return;
    const value = asset.url || asset.name;
    updateProfile(selectedProfileId, (current) => ({
      ...current,
      assets: {
        ...current.assets,
        [slot]: value,
      },
    }));
    setAppliedFeedback({ id: asset.id, slot: slot === 'largeImage' ? 'large' : 'small' });
    setTimeout(() => setAppliedFeedback(null), 1800);
  }, [selectedProfileId, updateProfile]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof assets> = {};
    for (const asset of filtered) {
      const key = asset.kind === 'library' ? 'Library' : asset.kind === 'large' ? 'Large Images' : 'Small Images';
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="assets-view">
      <div className="assets-header">
        <div>
          <p className="eyebrow">Assets</p>
          <h3>Image & Video Library</h3>
          {activeProfile && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Active Profile: <strong style={{ color: 'var(--text-secondary)' }}>{activeProfile.name}</strong>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  cursor: 'pointer',
                  marginLeft: 8,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                Go to Editor <ArrowRight size={11} />
              </button>
            </p>
          )}
        </div>
        <button className="ui-button ui-button--primary ui-button--sm" onClick={handleImport}>
          <Upload size={12} /> Import
        </button>
      </div>

      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Search assets..."
      />

      {Object.keys(grouped).length === 0 ? (
        <div className="assets-empty">
          <FolderOpen size={32} />
          <h4>No assets found</h4>
          {search ? (
            <p>No assets match "{search}"</p>
          ) : (
            <p>Import images to use them in your profiles</p>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([groupName, groupAssets]) => (
          <div key={groupName} className="assets-group">
            <h4 className="assets-group-label">{groupName}</h4>
            <div className="assets-grid">
              {groupAssets.map((asset) => (
                <div key={asset.id} className="asset-card">
                  <div className="asset-card-preview" style={{ background: `linear-gradient(135deg, ${asset.accent}, #0F172A)` }}>
                    {asset.url ? <img src={asset.url} alt="" /> : asset.kind === 'small' ? <FileImage size={16} /> : <Film size={16} />}
                  </div>
                  <div className="asset-card-body">
                    <strong>{asset.name}</strong>
                    <span>{asset.kind}</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        style={{ flex: 1, fontSize: 10, padding: '2px 4px', height: 22 }}
                        title={`Set as Large Artwork for "${activeProfile?.name || 'active profile'}"`}
                        onClick={() => handleApply(asset, 'largeImage')}
                      >
                        {appliedFeedback?.id === asset.id && appliedFeedback.slot === 'large' ? (
                          <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Check size={10} /> Set
                          </span>
                        ) : (
                          '+ Large'
                        )}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--secondary"
                        style={{ flex: 1, fontSize: 10, padding: '2px 4px', height: 22 }}
                        title={`Set as Small Artwork for "${activeProfile?.name || 'active profile'}"`}
                        onClick={() => handleApply(asset, 'smallImage')}
                      >
                        {appliedFeedback?.id === asset.id && appliedFeedback.slot === 'small' ? (
                          <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Check size={10} /> Set
                          </span>
                        ) : (
                          '+ Small'
                        )}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button--ghost"
                        style={{ width: 22, height: 22, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Copy image URL / key"
                        onClick={() => handleCopy(asset)}
                      >
                        {copiedId === asset.id ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>
                  <button className="asset-card-delete" title="Delete asset" onClick={() => deleteAsset(asset.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
