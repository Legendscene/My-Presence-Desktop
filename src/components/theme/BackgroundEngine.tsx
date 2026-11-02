import { useCallback, useEffect, useRef } from 'react';
import { getDefaultBackgroundVideo } from '../../lib/defaultBackground';
import { isPlayableVideoUrl } from '../../lib/media';
import { useAppStore } from '../../lib/store';
import type { Theme } from '../../lib/types';

const DARK_BG = '#0b0b0f';
const LIGHT_BG = '#f5f5f0';
const DEFAULT_VIDEO = getDefaultBackgroundVideo();

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clearVars(el: HTMLElement) {
  const vars = [
    '--theme-accent', '--theme-blur', '--theme-brightness', '--theme-opacity',
    '--theme-glass', '--theme-radius', '--theme-noise', '--theme-bg',
  ];
  vars.forEach((v) => el.style.removeProperty(v));
}

function getVideoSrc(activeTheme: Theme | undefined, settings: { backgroundSource: string }): string {
  if (activeTheme?.videoUrl) return activeTheme.videoUrl;
  if (settings.backgroundSource) return settings.backgroundSource;
  return DEFAULT_VIDEO;
}

export function BackgroundEngine() {
  const settings = useAppStore((s) => s.settings);
  const themes = useAppStore((s) => s.themes);
  const activeTheme = themes.find((t) => t.id === settings.activeThemeId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevVideoSrc = useRef<string>('');
  // Once we've swapped in the fallback we must stop re-assigning the broken
  // source on the next effect run, otherwise the element flip-flops between the
  // failing URL and default.mp4 on every theme tweak.
  const usingFallback = useRef(false);

  // React detaches the ref before the effect runs, so remember the last real
  // element. Without this, switching away from a video theme leaves the element
  // playing (audio in particular) off-screen.
  const captureVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) videoRef.current = el;
  }, []);

  const videoSrc = getVideoSrc(activeTheme, settings);
  const useVideo = isPlayableVideoUrl(videoSrc);

  useEffect(() => {
    const root = document.documentElement;
    const isLight = settings.appearance === 'light'
      || (settings.appearance === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

    clearVars(root);

    if (settings.appearance === 'oled') {
      root.setAttribute('data-theme', 'oled');
    } else if (isLight) {
      root.setAttribute('data-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
    }

    if (activeTheme) {
      root.style.setProperty('--theme-accent', activeTheme.accentColor);
      root.style.setProperty('--theme-blur', `${activeTheme.blurAmount}px`);
      // These two must stay UNITLESS. They are consumed as
      // `calc(var(--theme-opacity) / 100)`; writing "100%" made that
      // `calc(100% / 100)` = 1%, which rendered the live-preview card at 1%
      // opacity and applied brightness(0.01) to the app root.
      root.style.setProperty('--theme-brightness', `${activeTheme.brightness}`);
      root.style.setProperty('--theme-opacity', `${activeTheme.opacity}`);
      root.style.setProperty('--theme-glass', `${activeTheme.glassStrength}px`);
      root.style.setProperty('--theme-radius', `${activeTheme.cornerRadius}px`);
      root.style.setProperty('--theme-noise', activeTheme.noiseOverlay ? '1' : '0');

      const baseBg = isLight ? LIGHT_BG : settings.appearance === 'oled' ? '#000' : DARK_BG;
      root.style.setProperty('--theme-bg', hexToRgba(baseBg, 0.55));
    }
  }, [settings.appearance, activeTheme, settings.activeThemeId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (useVideo) {
      if (videoSrc !== prevVideoSrc.current) {
        usingFallback.current = false;
        video.src = videoSrc;
        prevVideoSrc.current = videoSrc;
      }
      const muted = activeTheme ? activeTheme.muted : true;
      const loop = activeTheme ? activeTheme.loop : true;
      const volume = activeTheme ? (activeTheme.muted ? 0 : activeTheme.volume / 100) : 0;
      const playbackSpeed = activeTheme ? activeTheme.playbackSpeed : 1;
      video.playbackRate = playbackSpeed;
      video.volume = volume;
      video.muted = muted;
      video.loop = loop;
      // Ensure autoplay works reliably
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented, will retry on user interaction
          video.addEventListener('canplay', () => video.play().catch(() => {}), { once: true });
        });
      }
    } else {
      video.pause();
      video.removeAttribute('src');
      video.load();
      prevVideoSrc.current = '';
      usingFallback.current = false;
    }
  }, [useVideo, videoSrc, activeTheme]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibility = () => {
      if (!useVideo) return;
      if (document.hidden) { video.pause(); }
      else { video.play().catch(() => {}); }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Fallback to default.mp4 on video load error — once, and without letting
    // the source effect undo it on the next render.
    const handleError = () => {
      if (usingFallback.current) return;
      usingFallback.current = true;
      prevVideoSrc.current = DEFAULT_VIDEO;
      video.src = DEFAULT_VIDEO;
      video.play().catch(() => {});
    };
    video.addEventListener('error', handleError);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      video.removeEventListener('error', handleError);
    };
  }, [useVideo]);

  // Stop playback when the component goes away entirely (app shutdown).
  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  const objectFit = activeTheme?.videoFit === 'fit' ? 'contain' : 'cover';
  const hasOverlay = (activeTheme?.overlayOpacity ?? 0) > 0;

  const brightness = activeTheme?.brightness ?? 100;
  const blurAmount = activeTheme?.blurAmount ?? 0;
  const opacity = (activeTheme?.opacity ?? 100) / 100;
  const commonFilter = `brightness(${brightness}%)`;

  const overlay = activeTheme && hasOverlay ? (
    <div style={{
      position: 'absolute', inset: 0,
      background: activeTheme.overlayColor,
      opacity: activeTheme.overlayOpacity / 100,
      transition: 'opacity 0.4s ease',
    }} />
  ) : null;

  // "Blur fill" scales the video up until it covers the frame, then blurs the
  // overflow behind a sharp copy - the standard fix for pillarbox/letterbox on
  // a wallpaper of the wrong aspect ratio.
  const blurFill = activeTheme?.videoFit === 'blur';

  if (useVideo) {
    return (
      <div className="background-engine-layer" style={{
        position: 'fixed', inset: 0, zIndex: -1,
        overflow: 'hidden', pointerEvents: 'none',
        opacity,
        transition: 'opacity 0.4s ease',
      }}>
        {blurFill && (
          <video
            aria-hidden
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            src={videoSrc}
            style={{
              position: 'absolute', inset: '-8%',
              width: '116%', height: '116%',
              objectFit: 'cover',
              filter: 'blur(24px) brightness(0.75)',
              transform: 'scale(1.02)'
            }}
          />
        )}
        <video
          ref={captureVideo}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: blurFill ? 'contain' : objectFit,
            display: 'block',
            filter: `${commonFilter} blur(${blurAmount}px)`
          }}
        />
        {overlay}
      </div>
    );
  }

  let bgStyle: React.CSSProperties = { backgroundColor: 'transparent' };
  if (activeTheme?.backgroundType === 'image' && activeTheme.imageUrl) {
    bgStyle = { backgroundImage: `url(${activeTheme.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' };
  } else if (activeTheme?.backgroundType === 'gradient') {
    bgStyle = { background: `linear-gradient(${activeTheme.gradientAngle}deg, ${activeTheme.gradientStart}, ${activeTheme.gradientEnd})` };
  } else if (activeTheme?.backgroundType === 'solid') {
    bgStyle = { backgroundColor: activeTheme.solidColor };
  }

  return (
    <div className="background-engine-layer" style={{
      position: 'fixed', inset: 0, zIndex: -1,
      overflow: 'hidden', pointerEvents: 'none',
      ...bgStyle,
      filter: activeTheme ? `${commonFilter} blur(${blurAmount}px)` : 'none',
      opacity,
      transition: 'opacity 0.4s ease, filter 0.4s ease, background 0.4s ease, background-image 0.4s ease',
    }}>
      {overlay}
    </div>
  );
}
