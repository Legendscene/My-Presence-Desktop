import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelative, validateUrl } from './utils';

describe('validateUrl', () => {
  it('passes http and https links', () => {
    expect(validateUrl('https://example.com')).toBe('');
    expect(validateUrl('http://example.com/path?q=1')).toBe('');
  });

  it('treats an empty value as valid so it is not marked mid-typing', () => {
    expect(validateUrl('')).toBe('');
  });

  it('rejects non-web schemes', () => {
    // Discord renders these as clickable buttons; a javascript: URL here would
    // be handed straight to the Discord client.
    expect(validateUrl('javascript:alert(1)')).not.toBe('');
    expect(validateUrl('file:///etc/passwd')).not.toBe('');
    expect(validateUrl('data:text/html,<script>')).not.toBe('');
  });

  it('rejects malformed input', () => {
    expect(validateUrl('not a url')).not.toBe('');
    expect(validateUrl('example.com')).not.toBe('');
  });
});

describe('formatRelative', () => {
  const now = new Date('2024-05-01T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('describes very recent edits as just now', () => {
    expect(formatRelative('2024-05-01T11:59:59.000Z')).toBe('Updated just now');
  });

  it('reports minutes, hours and days', () => {
    expect(formatRelative('2024-05-01T11:45:00.000Z')).toBe('Updated 15 min ago');
    expect(formatRelative('2024-05-01T09:00:00.000Z')).toBe('Updated 3h ago');
    expect(formatRelative('2024-04-28T12:00:00.000Z')).toBe('Updated 3d ago');
  });

  it('does not report a future timestamp as "just now"', () => {
    // Clock skew between machines (or a bad saved value) used to produce
    // "Updated just now" for something edited in the future.
    expect(formatRelative('2024-05-01T12:30:00.000Z')).not.toBe('Updated just now');
  });
});