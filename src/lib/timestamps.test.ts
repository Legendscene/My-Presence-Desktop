import { describe, expect, it } from 'vitest';
import { effectiveTimestampMode, resolveTimestamps, type TimestampContext } from './timestamps';

const NOW = new Date('2024-05-01T15:30:00.000Z').getTime();
const ctx = (over: Partial<TimestampContext> = {}): TimestampContext => ({
  now: NOW,
  appStartMs: NOW - 60_000,
  ...over
});

describe('effectiveTimestampMode', () => {
  it('treats a missing config as no timer', () => {
    expect(effectiveTimestampMode(undefined)).toBe('none');
    expect(effectiveTimestampMode({})).toBe('none');
  });

  it('infers custom for profiles saved before modes existed', () => {
    // These are the shapes already sitting in users' localStorage.
    expect(effectiveTimestampMode({ start: '2024-01-01T00:00:00.000Z' })).toBe('custom');
    expect(effectiveTimestampMode({ end: '2024-01-01T00:00:00.000Z' })).toBe('custom');
  });

  it('prefers an explicit mode over the legacy fields', () => {
    expect(effectiveTimestampMode({ mode: 'none', start: '2024-01-01T00:00:00.000Z' })).toBe('none');
  });
});

describe('resolveTimestamps', () => {
  it('returns nothing for none', () => {
    expect(resolveTimestamps({ mode: 'none' }, ctx())).toEqual({});
  });

  it('anchors sinceConnection to the connection moment', () => {
    const start = NOW - 5000;
    expect(resolveTimestamps({ mode: 'sinceConnection' }, ctx({ connectionMs: start }))).toEqual({ start });
  });

  it('falls back to now when no connection moment is known yet', () => {
    expect(resolveTimestamps({ mode: 'sinceConnection' }, ctx())).toEqual({ start: NOW });
  });

  it('anchors sinceAppStart to app launch, not now', () => {
    const appStart = NOW - 3_600_000;
    expect(resolveTimestamps({ mode: 'sinceAppStart' }, ctx({ appStartMs: appStart }))).toEqual({ start: appStart });
  });

  it('resolves localTime to the start of the current local day', () => {
    const { start } = resolveTimestamps({ mode: 'localTime' }, ctx());
    expect(start).toBeDefined();
    const asDate = new Date(start!);
    expect(asDate.getHours()).toBe(0);
    expect(asDate.getMinutes()).toBe(0);
    expect(asDate.getSeconds()).toBe(0);
  });

  it('omits a custom end until the end picker is enabled', () => {
    const end = '2024-05-02T00:00:00.000Z';
    expect(resolveTimestamps({ mode: 'custom', start: '2024-05-01T00:00:00.000Z', end }, ctx())).toEqual({
      start: new Date('2024-05-01T00:00:00.000Z').getTime()
    });
  });

  it('includes a custom end once endEnabled is set', () => {
    const end = '2024-05-02T00:00:00.000Z';
    const { start, end: resolvedEnd } = resolveTimestamps(
      { mode: 'custom', start: '2024-05-01T00:00:00.000Z', end, endEnabled: true },
      ctx()
    );
    expect(start).toBe(new Date('2024-05-01T00:00:00.000Z').getTime());
    expect(resolvedEnd).toBe(new Date(end).getTime());
  });

  it('drops unparseable custom dates instead of emitting NaN', () => {
    // NaN in the payload would make Discord silently drop the whole activity.
    expect(resolveTimestamps({ mode: 'custom', start: 'not-a-date', endEnabled: true, end: '???' }, ctx())).toEqual({
      start: undefined,
      end: undefined
    });
  });

  it('is stable: preview and RPC agree because both call this', () => {
    const ts = { mode: 'sinceUpdate' as const };
    const a = resolveTimestamps(ts, ctx({ lastUpdateMs: NOW - 900 }));
    const b = resolveTimestamps(ts, ctx({ lastUpdateMs: NOW - 900 }));
    expect(a).toEqual(b);
  });
});