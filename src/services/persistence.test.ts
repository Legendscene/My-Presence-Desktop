import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, PresenceProfile } from '../lib/types';
import { defaultSettings } from '../lib/seed';
import { persistence } from './persistence';

// Local fixtures rather than app seed data: the app ships no sample profiles
// any more, and these tests are about write coalescing, not about content.
const makeProfile = (id: string): PresenceProfile => ({
  id,
  name: id,
  favorite: false,
  details: '',
  state: '',
  applicationId: '',
  activityType: 'Playing',
  instance: false,
  status: 'idle',
  buttonsEnabled: true,
  buttons: [],
  assets: { largeImage: '', largeText: '', smallImage: '', smallText: '' },
  timestamps: { mode: 'none' },
  party: { id: '', currentSize: 1, maxSize: 5 },
  secrets: { join: '', spectate: '', match: '' },
  notes: '',
  updatedAt: new Date().toISOString()
});
const sampleProfiles: PresenceProfile[] = [makeProfile('a'), makeProfile('b'), makeProfile('c')];

// localStorage is a window API. persistence() reads it lazily on every call, so
// stubbing the global before each test is enough — no module reset required.
const store = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => {
  store.set(key, value);
});
const getItem = vi.fn((key: string) => store.get(key) ?? null);

beforeEach(() => {
  // Any write still queued by a previous test must not leak into the counts.
  persistence.flush();
  store.clear();
  setItem.mockClear();
  getItem.mockClear();
  vi.stubGlobal('localStorage', {
    getItem,
    setItem,
    removeItem: vi.fn((key: string) => void store.delete(key)),
    clear: vi.fn(() => store.clear())
  });
  vi.useFakeTimers();
});

afterEach(() => {
  persistence.flush();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('persistence', () => {
  it('coalesces a burst of writes into a single store write', () => {
    const profiles = sampleProfiles as PresenceProfile[];

    // Simulates typing in the editor: one save per keystroke. Before this was
    // debounced, every one of these did a synchronous JSON.stringify + write.
    for (let i = 0; i < 20; i++) {
      persistence.saveProfiles(profiles.slice(0, 1));
      vi.advanceTimersByTime(16);
    }

    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('writes the newest value, not the first', () => {
    persistence.saveProfiles(sampleProfiles.slice(0, 1));
    persistence.saveProfiles(sampleProfiles);
    vi.advanceTimersByTime(500);

    const saved = JSON.parse(store.get('my-presence.profiles') ?? '[]') as PresenceProfile[];
    expect(saved).toHaveLength(sampleProfiles.length);
  });

  it('writes live state through immediately so a crash cannot lose it', () => {
    // Whether a presence is live decides if the app reconnects on next launch.
    persistence.saveLiveState({ isLive: true, profileId: 'abc' });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(persistence.loadLiveState()).toEqual({ isLive: true, profileId: 'abc' });
  });

  it('flush() pushes pending debounced writes out on demand', () => {
    persistence.saveSettings(defaultSettings as AppSettings);
    persistence.flush();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(persistence.loadSettings()).toEqual(defaultSettings);
  });

  it('keeps separate keys independent', () => {
    persistence.saveProfiles([]);
    persistence.saveAssets([]);
    vi.advanceTimersByTime(500);
    expect(store.has('my-presence.profiles')).toBe(true);
    expect(store.has('my-presence.assets')).toBe(true);
    expect(store.has('my-presence.themes')).toBe(false);
  });

  it('returns null instead of throwing when storage is unavailable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      }
    });
    expect(() => persistence.saveProfiles([])).not.toThrow();
    expect(persistence.loadProfiles()).toBeNull();
    warn.mockRestore();
  });

  it('round-trips values through JSON', () => {
    persistence.saveThemes([]);
    vi.advanceTimersByTime(500);
    expect(persistence.loadThemes()).toEqual([]);
  });
});