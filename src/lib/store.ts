import { create } from 'zustand';
import { getDefaultBackgroundVideo } from './defaultBackground';
import { defaultSettings, defaultThemes, SEED_ASSET_IDS, SEED_PROFILE_IDS } from './seed';
import { persistence } from '../services/persistence';
import { effectiveTimestampMode } from './timestamps';
import type { AppSettings, AssetItem, ConnectionStatus, PresenceProfile, Theme } from './types';

export type TabKey = 'editor' | 'assets' | 'settings' | 'background';

type StoreState = {
  profiles: PresenceProfile[];
  selectedProfileId: string;
  search: string;
  activeTab: TabKey;
  assets: AssetItem[];
  settings: AppSettings;
  themes: Theme[];
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  onboardingOpen: boolean;
  selectProfile: (profileId: string) => void;
  updateProfile: (profileId: string, updater: (profile: PresenceProfile) => PresenceProfile) => void;
  createProfile: () => void;
  duplicateProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  addAsset: (asset: Omit<AssetItem, 'id' | 'updatedAt'>) => void;
  deleteAsset: (assetId: string) => void;
  toggleFavorite: (profileId: string) => void;
  setSearch: (value: string) => void;
  setActiveTab: (tab: TabKey) => void;
  setConnectionStatus: (status: ConnectionStatus, message: string) => void;
  setProfileStatus: (profileId: string, status: PresenceProfile['status']) => void;
  updateSettings: (updater: (settings: AppSettings) => AppSettings) => void;
  createTheme: () => void;
  duplicateTheme: (themeId: string) => void;
  deleteTheme: (themeId: string) => void;
  updateTheme: (themeId: string, updater: (theme: Theme) => Theme) => void;
  reorderThemes: (themes: Theme[]) => void;
  setActiveTheme: (themeId: string | null) => void;
  exportTheme: (themeId: string) => string;
  importTheme: (json: string) => boolean;
  setOnboardingOpen: (open: boolean) => void;
  completeOnboarding: () => void;
  resetDefaultTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
};

export function useActiveTheme(): Theme | undefined {
  return useAppStore((s) => {
    const id = s.settings.activeThemeId;
    return id ? s.themes.find((t) => t.id === id) : undefined;
  });
}

export function useProfile(): PresenceProfile | undefined {
  return useAppStore((s) => s.profiles.find((p) => p.id === s.selectedProfileId));
}

const sanitizeProfileImages = (profiles: PresenceProfile[]): PresenceProfile[] =>
  profiles.map((profile) => {
    const keepUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : '');
    const buttons = (profile.buttons ?? []).map((button) =>
      /(^https?:\/\/)?(www\.)?example\.com/i.test(button.url.trim()) ? { ...button, url: '' } : button
    );
    const timestamps = {
      ...profile.timestamps,
      mode: effectiveTimestampMode(profile.timestamps),
      endEnabled: profile.timestamps.endEnabled ?? Boolean(profile.timestamps.end)
    };
    return {
      ...profile,
      // 'live' is a runtime fact, not saved state: a profile that was live when
      // the app last closed is NOT connected now. Reconnect is driven by
      // persistence.loadLiveState() instead, so restoring 'live' here would show
      // a green badge and a "Live – Click to Stop" button for a presence Discord
      // has never received.
      status: 'idle' as const,
      buttonsEnabled: profile.buttonsEnabled ?? true,
      buttons,
      timestamps,
      assets: {
        ...profile.assets,
        largeImage: keepUrl(profile.assets.largeImage),
        smallImage: keepUrl(profile.assets.smallImage)
      }
    };
  });

// Older builds seeded two fabricated profiles and five fake assets into an
// empty library. They are pruned once here so an existing install ends up with
// only what the user actually made; the ids below are the only ones those rows
// could ever have had.
const seedProfileIds = new Set<string>(SEED_PROFILE_IDS);
const seedAssetIds = new Set<string>(SEED_ASSET_IDS);

const pruneSeedData = <T extends { id: string }>(rows: T[], seedIds: Set<string>): T[] =>
  rows.filter((row) => !seedIds.has(row.id));

const loadedProfiles = persistence.loadProfiles();
const loadedAssets = persistence.loadAssets();
const storedProfiles = sanitizeProfileImages(pruneSeedData(loadedProfiles ?? [], seedProfileIds));
const storedAssets = pruneSeedData(loadedAssets ?? [], seedAssetIds);

// Persist the prune immediately so the removed rows do not come back on the
// next load if nothing else writes profiles/assets in this session.
if ((loadedProfiles?.length ?? 0) !== storedProfiles.length) persistence.saveProfiles(storedProfiles);
if ((loadedAssets?.length ?? 0) !== storedAssets.length) persistence.saveAssets(storedAssets);
const storedSettings = persistence.loadSettings() ?? defaultSettings;
const storedThemes = persistence.loadThemes() ?? defaultThemes;

const persistState = (partial: Partial<StoreState>) => {
  if (partial.profiles) persistence.saveProfiles(partial.profiles);
  if (partial.assets) persistence.saveAssets(partial.assets);
  if (partial.settings) persistence.saveSettings(partial.settings);
  if (partial.themes) persistence.saveThemes(partial.themes);
};

// Startup flags the main process reads from userData before any window exists.
// Kept in one place so the store and the bridge can never disagree about which
// settings matter.
const STARTUP_KEYS = ['startMinimized', 'closeToTray', 'minimizeToTray', 'launchOnStartup'] as const;

const syncStartupState = (settings: AppSettings) => {
  const patch: Partial<Record<(typeof STARTUP_KEYS)[number], boolean>> = {};
  for (const key of STARTUP_KEYS) patch[key] = Boolean(settings[key]);
  void window.myPresenceDesktop?.setStartupState?.(patch).catch(() => {});
};

const createBlankProfile = (): PresenceProfile => {
  const now = new Date().toISOString();
  return {
    id: `profile-${crypto.randomUUID()}`,
    name: 'New Presence',
    favorite: false,
    details: '',
    state: '',
    applicationId: '',
    activityType: 'Playing',
    instance: false,
    status: 'idle',
    buttonsEnabled: true,
    buttons: [
      { id: crypto.randomUUID(), label: '', url: '' },
      { id: crypto.randomUUID(), label: '', url: '' }
    ],
    assets: {
      largeImage: '',
      largeText: '',
      largeUrl: '',
      smallImage: '',
      smallText: '',
      smallUrl: ''
    },
    timestamps: { mode: 'none' },
    party: {
      id: '',
      currentSize: 1,
      maxSize: 5
    },
    secrets: {
      join: '',
      spectate: '',
      match: ''
    },
    notes: '',
    updatedAt: now
  };
};

export const useAppStore = create<StoreState>((set, get) => ({
  profiles: storedProfiles,
  selectedProfileId: storedProfiles[0]?.id ?? '',
  search: '',
  activeTab: 'editor',
  assets: storedAssets,
  settings: storedSettings,
  themes: storedThemes,
  connectionStatus: 'disconnected',
  statusMessage: 'Not connected',
  onboardingOpen: !storedSettings.onboardingComplete,

  selectProfile: (selectedProfileId) => set({ selectedProfileId }),
  updateProfile: (profileId, updater) =>
    set((state) => {
      const profiles = state.profiles.map((profile) =>
        profile.id === profileId ? { ...updater(profile), updatedAt: new Date().toISOString() } : profile
      );
      persistState({ profiles });
      return { profiles };
    }),
  createProfile: () =>
    set((state) => {
      const profile = createBlankProfile();
      const profiles = [profile, ...state.profiles];
      persistState({ profiles });
      return { profiles, selectedProfileId: profile.id, activeTab: 'editor' as TabKey };
    }),
  duplicateProfile: (profileId) =>
    set((state) => {
      const target = state.profiles.find((p) => p.id === profileId);
      if (!target) return state;
      const duplicate = {
        ...target,
        id: `profile-${crypto.randomUUID()}`,
        name: `${target.name} Copy`,
        status: 'idle' as const,
        updatedAt: new Date().toISOString()
      };
      const profiles = [duplicate, ...state.profiles];
      persistState({ profiles });
      return { profiles, selectedProfileId: duplicate.id };
    }),
  deleteProfile: (profileId) =>
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== profileId);
      persistState({ profiles });
      return { profiles, selectedProfileId: profiles[0]?.id ?? '' };
    }),
  addAsset: (asset) =>
    set((state) => {
      const nextAsset: AssetItem = {
        ...asset,
        id: `asset-${crypto.randomUUID()}`,
        updatedAt: new Date().toISOString()
      };
      const assets = [nextAsset, ...state.assets];
      persistState({ assets });
      return { assets };
    }),
  deleteAsset: (assetId) =>
    set((state) => {
      const assets = state.assets.filter((asset) => asset.id !== assetId);
      persistState({ assets });
      return { assets };
    }),
  toggleFavorite: (profileId) =>
    set((state) => {
      const profiles = state.profiles.map((p) =>
        p.id === profileId ? { ...p, favorite: !p.favorite, updatedAt: new Date().toISOString() } : p
      );
      persistState({ profiles });
      return { profiles };
    }),
  setSearch: (search) => set({ search }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setConnectionStatus: (connectionStatus, statusMessage) => set({ connectionStatus, statusMessage }),
  setProfileStatus: (profileId, status) =>
    set((state) => {
      const target = state.profiles.find((p) => p.id === profileId);
      if (!target || target.status === status) return state;
      const profiles = state.profiles.map((p) => (p.id === profileId ? { ...p, status } : p));
      persistState({ profiles });
      return { profiles };
    }),
  updateSettings: (updater) =>
    set((state) => {
      const settings = updater(state.settings);
      persistState({ settings });
      syncStartupState(settings);
      return { settings };
    }),

  // Theme actions
  createTheme: () =>
    set((state) => {
      const theme: Theme = {
        id: `theme-${crypto.randomUUID()}`,
        name: `Theme ${state.themes.length + 1}`,
        backgroundType: 'solid',
        solidColor: '#0b0b0f',
        gradientStart: '#6366f1',
        gradientEnd: '#06b6d4',
        gradientAngle: 135,
        imageUrl: '',
        videoUrl: '',
        accentColor: '#6366f1',
        blurAmount: 0,
        brightness: 100,
        opacity: 100,
        noiseOverlay: false,
        glassStrength: 10,
        cornerRadius: 12,
        videoFit: 'fill',
        overlayColor: '#000000',
        overlayOpacity: 0,
        muted: true,
        volume: 50,
        playbackSpeed: 1,
        loop: true,
        scope: 'app',
        sortOrder: state.themes.length,
      };
      const themes = [...state.themes, theme];
      persistState({ themes });
      return { themes };
    }),
  duplicateTheme: (themeId) =>
    set((state) => {
      const target = state.themes.find((t) => t.id === themeId);
      if (!target) return state;
      const duplicate = { ...target, id: `theme-${crypto.randomUUID()}`, name: `${target.name} Copy`, sortOrder: state.themes.length };
      const themes = [...state.themes, duplicate];
      persistState({ themes });
      return { themes };
    }),
  deleteTheme: (themeId) =>
    set((state) => {
      const themes = state.themes.filter((t) => t.id !== themeId);
      const activeThemeId = state.settings.activeThemeId === themeId ? null : state.settings.activeThemeId;
      persistState({ themes });
      const settings = { ...state.settings, activeThemeId };
      persistState({ settings });
      return { themes, settings };
    }),
  updateTheme: (themeId, updater) =>
    set((state) => {
      const themes = state.themes.map((t) => (t.id === themeId ? updater(t) : t));
      persistState({ themes });
      return { themes };
    }),
  reorderThemes: (themes) => {
    persistState({ themes });
    set({ themes });
  },
  setActiveTheme: (themeId) =>
    set((state) => {
      const settings = { ...state.settings, activeThemeId: themeId };
      persistState({ settings });
      return { settings };
    }),
  resetDefaultTheme: () =>
    set((state) => {
      const settings = { ...state.settings, backgroundSource: '' };
      persistState({ settings });
      const themes: Theme[] = state.themes.map((t) =>
        t.id === state.settings.activeThemeId
          ? {
              ...t,
              backgroundType: 'video' as const,
              videoUrl: getDefaultBackgroundVideo(),
              imageUrl: '',
              blurAmount: 0,
              brightness: 100,
              opacity: 100,
              noiseOverlay: true,
              muted: true,
              volume: 50,
              playbackSpeed: 1,
              loop: true,
              videoFit: 'fill' as const,
              overlayOpacity: 0,
            }
          : t
      );
      persistState({ themes });
      return { themes, settings };
    }),
  exportTheme: (themeId) => {
    const state = get();
    const theme = state.themes.find((t) => t.id === themeId);
    if (!theme) return '';
    return JSON.stringify(theme, null, 2);
  },
  importTheme: (json) => {
    try {
      const theme = JSON.parse(json) as Theme;
      if (!theme.id || !theme.name) return false;
      theme.id = `theme-${crypto.randomUUID()}`;
      theme.name = `${theme.name} (imported)`;
      const state = get();
      const themes = [...state.themes, theme];
      persistState({ themes });
      set({ themes });
      return true;
    } catch { return false; }
  },
  setSidebarCollapsed: (sidebarCollapsed) =>
    set((state) => {
      const settings = { ...state.settings, sidebarCollapsed };
      persistState({ settings });
      return { settings };
    }),
  toggleSidebar: () => {
    const next = !(get().settings.sidebarCollapsed ?? false);
    get().setSidebarCollapsed(next);
  },

  setOnboardingOpen: (open) => set({ onboardingOpen: open }),
  completeOnboarding: () =>
    set((state) => {
      const settings = { ...state.settings, onboardingComplete: true };
      // Written through immediately. On the debounced path a user who finished
      // the wizard and then quit the app within the debounce window lost the
      // flag and were shown the whole wizard again on the next launch.
      persistence.saveSettingsNow(settings);
      syncStartupState(settings);
      return { settings, onboardingOpen: false };
    })
}));
