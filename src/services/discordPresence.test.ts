import { describe, expect, it } from 'vitest';
import { mapProfileToActivity } from './discordPresence';
import type { PresenceProfile } from '../lib/types';

const baseProfile: PresenceProfile = {
  id: 'p1',
  name: 'Test',
  favorite: false,
  details: '',
  state: '',
  applicationId: '',
  activityType: 'Playing',
  instance: false,
  status: 'idle',
  buttonsEnabled: true,
  buttons: [
    { id: 'b1', label: '', url: '' },
    { id: 'b2', label: '', url: '' }
  ],
  assets: { largeImage: '', largeText: '', largeUrl: '', smallImage: '', smallText: '', smallUrl: '' },
  timestamps: { mode: 'none' },
  party: { id: '', currentSize: 1, maxSize: 5 },
  secrets: { join: '', spectate: '', match: '' },
  notes: '',
  updatedAt: new Date().toISOString()
};

const ctx = { now: Date.now(), appStartMs: Date.now() - 1000 };
const withProfile = (patch: Partial<PresenceProfile> = {}) => ({ ...baseProfile, ...patch });

describe('mapProfileToActivity', () => {
  it('always emits a type Discord accepts', () => {
    expect(mapProfileToActivity(withProfile({ activityType: 'Playing' }), ctx).type).toBe(0);
    expect(mapProfileToActivity(withProfile({ activityType: 'Listening' }), ctx).type).toBe(2);
    expect(mapProfileToActivity(withProfile({ activityType: 'Watching' }), ctx).type).toBe(3);
    expect(mapProfileToActivity(withProfile({ activityType: 'Competing' }), ctx).type).toBe(5);
  });

  it('falls Streaming back to Playing, which SET_ACTIVITY rejects', () => {
    // Streaming (1) needs a separate stream flow; sending it makes Discord
    // drop the entire activity rather than showing it as Playing.
    expect(mapProfileToActivity(withProfile({ activityType: 'Streaming' }), ctx).type).toBe(0);
  });

  it('trims text and omits empty fields entirely', () => {
    const activity = mapProfileToActivity(withProfile({ details: '  Coding  ', state: '   ' }), ctx);
    expect(activity.details).toBe('Coding');
    expect('state' in activity).toBe(false);
  });

  it('drops buttons that are incomplete or not http(s)', () => {
    const activity = mapProfileToActivity(
      withProfile({
        buttons: [
          { id: '1', label: 'Good', url: 'https://example.org' },
          { id: '2', label: '', url: 'https://example.org' },
          { id: '3', label: 'Bad scheme', url: 'javascript:alert(1)' }
        ]
      }),
      ctx
    );
    expect(activity.buttons).toEqual([{ label: 'Good', url: 'https://example.org' }]);
  });

  it('sends no buttons when the toggle is off', () => {
    const activity = mapProfileToActivity(
      withProfile({
        buttonsEnabled: false,
        buttons: [{ id: '1', label: 'Hidden', url: 'https://example.org' }]
      }),
      ctx
    );
    expect(activity.buttons).toBeUndefined();
  });

  it('keeps at most two buttons — Discord rejects a third', () => {
    const activity = mapProfileToActivity(
      withProfile({
        buttons: [
          { id: '1', label: 'One', url: 'https://a.example' },
          { id: '2', label: 'Two', url: 'https://b.example' },
          { id: '3', label: 'Three', url: 'https://c.example' }
        ]
      }),
      ctx
    );
    expect(activity.buttons).toHaveLength(2);
  });

  it('omits assets entirely when none are set', () => {
    expect(mapProfileToActivity(withProfile(), ctx).assets).toBeUndefined();
  });

  it('omits party unless an id is present', () => {
    expect(mapProfileToActivity(withProfile(), ctx).party).toBeUndefined();
    const withParty = mapProfileToActivity(withProfile({ party: { id: 'room', currentSize: 2, maxSize: 8 } }), ctx);
    expect(withParty.party).toEqual({ id: 'room', size: [2, 8] });
  });

  it('includes instance only when enabled', () => {
    expect(mapProfileToActivity(withProfile(), ctx).instance).toBeUndefined();
    expect(mapProfileToActivity(withProfile({ instance: true }), ctx).instance).toBe(true);
  });
});