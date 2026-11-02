// Chromium can decode all of these, but a <video> src is only usable if it
// actually points at a video file. Uploaded backgrounds arrive as
// `local-video://<name>` (any of these extensions), and pasted links routinely
// carry a query string — so a naive `endsWith('.mp4')` check silently disables
// every one of them.
const VIDEO_EXTENSION_RE = /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i;

export function isPlayableVideoUrl(src: string | undefined | null): boolean {
  const value = (src ?? '').trim();
  if (!value) return false;
  return VIDEO_EXTENSION_RE.test(value) || value.startsWith('local-video://');
}