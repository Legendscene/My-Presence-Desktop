import type { AppSettings, AssetItem, PresenceProfile, Theme } from '../lib/types';

export type LiveState = {
  isLive: boolean;
  profileId: string;
};

const KEYS = {
  profiles: 'my-presence.profiles',
  assets: 'my-presence.assets',
  settings: 'my-presence.settings',
  live: 'my-presence.live',
  themes: 'my-presence.themes'
} as const;

// Every keystroke in the editor runs an update, and each one used to
// JSON.stringify the whole profiles array and write it to localStorage —
// synchronous, on the main thread, per character. Coalescing writes over a short
// window keeps typing smooth; a trailing write guarantees nothing is lost.
const WRITE_DEBOUNCE_MS = 400;

type PendingWrite = {
  value: unknown;
  timer: ReturnType<typeof setTimeout> | null;
  // True while `value` has not been written to storage yet. Without this flag a
  // flush() would re-write every key it has ever seen, even long-finished ones.
  dirty: boolean;
};

const pending: Record<string, PendingWrite> = {};

function available(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function read<T>(key: string): T | null {
  if (!available()) return null;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeNow<T>(key: string, value: T) {
  if (!available()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // A full or unavailable quota (e.g. disabled storage in a packaged app)
    // must not take the UI down with it.
    console.warn(`[persistence] could not save "${key}"`, error);
  }
}

function write<T>(key: string, value: T, { immediate = false } = {}) {
  if (!available()) return;

  const entry = pending[key] ?? (pending[key] = { value: undefined, timer: null, dirty: false });
  entry.value = value;
  entry.dirty = true;
  if (entry.timer) clearTimeout(entry.timer);

  if (immediate) {
    entry.timer = null;
    entry.dirty = false;
    writeNow(key, value);
    return;
  }

  entry.timer = setTimeout(() => {
    entry.timer = null;
    if (!entry.dirty) return;
    entry.dirty = false;
    writeNow(key, entry.value);
  }, WRITE_DEBOUNCE_MS);
}

/** Force any debounced writes out now. Called before the window unloads. */
function flush() {
  Object.keys(pending).forEach((key) => {
    const entry = pending[key];
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    if (!entry.dirty) return;
    entry.dirty = false;
    writeNow(key, entry.value);
  });
}

if (typeof window !== 'undefined') {
  // 'pagehide' fires for close/reload in Electron where 'beforeunload' may not.
  window.addEventListener('pagehide', flush);
}

export const persistence = {
  loadProfiles: (): PresenceProfile[] | null => read(KEYS.profiles),
  saveProfiles: (value: PresenceProfile[]) => write(KEYS.profiles, value),
  loadAssets: (): AssetItem[] | null => read(KEYS.assets),
  saveAssets: (value: AssetItem[]) => write(KEYS.assets, value),
  loadSettings: (): AppSettings | null => read(KEYS.settings),
  saveSettings: (value: AppSettings) => write(KEYS.settings, value),
  // Finishing onboarding must survive an immediate quit. It went through the
  // debounced path, so a user who clicked "Get Started" and closed the window
  // straight after was greeted by the wizard again on the next launch.
  saveSettingsNow: (value: AppSettings) => write(KEYS.settings, value, { immediate: true }),
  loadLiveState: (): LiveState | null => read(KEYS.live),
  // Whether a presence is live is the one value we must never lose to a crash
  // or a debounce window, so it is written through immediately.
  saveLiveState: (value: LiveState) => write(KEYS.live, value, { immediate: true }),
  loadThemes: (): Theme[] | null => read(KEYS.themes),
  saveThemes: (value: Theme[]) => write(KEYS.themes, value),
  flush
};