import { getDefaultBackgroundVideo } from './defaultBackground';
import type { AppSettings, Theme } from './types';

// No seeded profiles or assets ship with the app. The library used to fall back
// to two fabricated presets ("Deep Work", "Launch Mode") and five fake assets on
// a fresh install, so the first thing every new user saw was content they had
// not made and could not explain. A fresh install now starts genuinely empty and
// the empty states point at creating your own profile.
export const defaultThemes: Theme[] = [
  {
    id: 'theme-dark-default',
    name: 'Default Wallpaper',
    backgroundType: 'video',
    solidColor: '#0b0b0f',
    gradientStart: '#6366f1',
    gradientEnd: '#06b6d4',
    gradientAngle: 135,
    imageUrl: '',
    videoUrl: getDefaultBackgroundVideo(),
    accentColor: '#6366f1',
    blurAmount: 0,
    brightness: 100,
    opacity: 100,
    noiseOverlay: true,
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
    sortOrder: 0
  },
  {
    id: 'theme-oled',
    name: 'OLED Black',
    backgroundType: 'solid',
    solidColor: '#000000',
    gradientStart: '#000000',
    gradientEnd: '#0a0a0a',
    gradientAngle: 135,
    imageUrl: '',
    videoUrl: '',
    accentColor: '#a78bfa',
    blurAmount: 0,
    brightness: 100,
    opacity: 100,
    noiseOverlay: false,
    glassStrength: 5,
    cornerRadius: 16,
    videoFit: 'fill',
    overlayColor: '#000000',
    overlayOpacity: 0,
    muted: true,
    volume: 50,
    playbackSpeed: 1,
    loop: true,
    scope: 'app',
    sortOrder: 1
  },
  {
    id: 'theme-gradient',
    name: 'Aurora',
    backgroundType: 'gradient',
    solidColor: '#0b0b0f',
    gradientStart: '#0f0c29',
    gradientEnd: '#302b63',
    gradientAngle: 135,
    imageUrl: '',
    videoUrl: '',
    accentColor: '#818cf8',
    blurAmount: 0,
    brightness: 100,
    opacity: 100,
    noiseOverlay: true,
    glassStrength: 15,
    cornerRadius: 12,
    videoFit: 'fill',
    overlayColor: '#000000',
    overlayOpacity: 0,
    muted: true,
    volume: 50,
    playbackSpeed: 1,
    loop: true,
    scope: 'app',
    sortOrder: 2
  },
  {
    id: 'theme-light',
    name: 'Daylight',
    backgroundType: 'solid',
    solidColor: '#f5f5f0',
    gradientStart: '#f5f5f0',
    gradientEnd: '#e8e4e0',
    gradientAngle: 135,
    imageUrl: '',
    videoUrl: '',
    accentColor: '#6366f1',
    blurAmount: 0,
    brightness: 100,
    opacity: 100,
    noiseOverlay: false,
    glassStrength: 8,
    cornerRadius: 12,
    videoFit: 'fill',
    overlayColor: '#ffffff',
    overlayOpacity: 0,
    muted: true,
    volume: 50,
    playbackSpeed: 1,
    loop: true,
    scope: 'app',
    sortOrder: 3
  }
];

// Ids of the fabricated content that older builds seeded into the library on a
// fresh install. Anyone who ran the app before has those rows sitting in
// localStorage, so removing the constants alone would not empty anyone's library
// — they get pruned once, on load. Anything the user created or renamed keeps
// its own generated id and is untouched.
export const SEED_PROFILE_IDS = ['focus-deep-work', 'launch-mode'] as const;
export const SEED_ASSET_IDS = ['a1', 'a2', 'a3', 'a4', 'a5'] as const;

export const defaultSettings: AppSettings = {
  sidebarCollapsed: false,
  appearance: 'dark',
  launchOnStartup: false,
  startMinimized: false,
  minimizeToTray: true,
  closeToTray: true,
  restorePreviousSession: true,
  autoReconnect: true,
  reduceMotion: false,
  notifications: true,
  autoUpdates: true,
  videoPauseWhenHidden: true,
  hardwareAcceleration: true,
  activeThemeId: 'theme-dark-default',
  backgroundSource: '',
  onboardingComplete: false
};
