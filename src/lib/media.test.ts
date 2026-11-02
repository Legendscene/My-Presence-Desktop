import { describe, expect, it } from 'vitest';
import { isPlayableVideoUrl } from './media';

describe('isPlayableVideoUrl', () => {
  it('accepts the bundled default wallpaper', () => {
    expect(isPlayableVideoUrl('./assets/backgrounds/default.mp4')).toBe(true);
  });

  it('accepts uploaded local videos regardless of container', () => {
    // These used to be rejected by endsWith('.mp4'), so a user who picked a
    // .webm or .mov background got a blank screen with no error.
    expect(isPlayableVideoUrl('local-video://1712-ab12.webm')).toBe(true);
    expect(isPlayableVideoUrl('local-video://1712-ab12.mov')).toBe(true);
  });

  it('accepts remote links that carry a query string', () => {
    expect(isPlayableVideoUrl('https://cdn.example.com/a/b.mp4?token=xyz')).toBe(true);
    expect(isPlayableVideoUrl('https://cdn.example.com/a/b.webm#t=10')).toBe(true);
  });

  it('rejects empty values', () => {
    expect(isPlayableVideoUrl('')).toBe(false);
    expect(isPlayableVideoUrl('   ')).toBe(false);
    expect(isPlayableVideoUrl(undefined)).toBe(false);
    expect(isPlayableVideoUrl(null)).toBe(false);
  });

  it('rejects non-video sources', () => {
    expect(isPlayableVideoUrl('https://example.com/poster.png')).toBe(false);
    expect(isPlayableVideoUrl('./assets/backgrounds/default.jpg')).toBe(false);
  });

  it('is not fooled by a video extension in the middle of the name', () => {
    expect(isPlayableVideoUrl('https://example.com/a.mp4.html')).toBe(false);
  });
});