/**
 * Startup preferences that the MAIN process needs before any window exists.
 *
 * The renderer's settings live in localStorage, which the main process cannot
 * read synchronously at boot — by the time the window loads, `createWindow` has
 * already had to decide whether to show itself and what a close button means.
 * These few flags are therefore mirrored into a tiny JSON file under userData so
 * window behaviour is correct from the very first frame.
 *
 * Kept deliberately small and independent of the renderer's full settings blob:
 * this is the one place where a stale read produces a visibly wrong window.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type StartupState = {
  /** Start hidden in the tray instead of showing the window. */
  startMinimized: boolean;
  /** Closing the window hides it rather than quitting. */
  closeToTray: boolean;
  /** Minimizing the window hides it rather than leaving it on the taskbar. */
  minimizeToTray: boolean;
  /** Register a Windows login item. */
  launchOnStartup: boolean;
};

const DEFAULTS: StartupState = {
  startMinimized: false,
  closeToTray: true,
  minimizeToTray: true,
  launchOnStartup: false
};

function statePath(): string {
  return path.join(app.getPath('userData'), 'startup-state.json');
}

export function readStartupState(): StartupState {
  try {
    const file = statePath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<StartupState>;
    // Merge rather than trust: a field written by an older build may be absent,
    // and `undefined` must never win over the default.
    return {
      startMinimized: typeof parsed.startMinimized === 'boolean' ? parsed.startMinimized : DEFAULTS.startMinimized,
      closeToTray: typeof parsed.closeToTray === 'boolean' ? parsed.closeToTray : DEFAULTS.closeToTray,
      minimizeToTray: typeof parsed.minimizeToTray === 'boolean' ? parsed.minimizeToTray : DEFAULTS.minimizeToTray,
      launchOnStartup: typeof parsed.launchOnStartup === 'boolean' ? parsed.launchOnStartup : DEFAULTS.launchOnStartup
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeStartupState(patch: Partial<StartupState>): StartupState {
  const next = { ...readStartupState(), ...patch };
  try {
    const file = statePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8');
  } catch (error) {
    // Losing this only costs a window that opens when it should have stayed in
    // the tray — never worth taking the app down over.
    console.warn('[startup] could not persist startup state', error);
  }
  return next;
}
