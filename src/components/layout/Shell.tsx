import { PropsWithChildren, useEffect, useRef, useState, useCallback } from 'react';
import { Settings2, Minus, Square, X } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { discordPresenceService } from '../../services/discordPresence';
import { CommandPalette } from './CommandPalette';

export function Shell({ children }: PropsWithChildren) {
  const shellRef = useRef<HTMLDivElement>(null);
  const setConnectionStatus = useAppStore((state) => state.setConnectionStatus);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const createProfile = useAppStore((state) => state.createProfile);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const bridge = window.myPresenceDesktop;
    if (bridge) {
      bridge.getMeta().catch(() => {});
      const { settings, profiles } = useAppStore.getState();
      // Push the startup flags into the main process on every launch. It cannot
      // read localStorage itself, so without this a reinstall (or a settings
      // change made while the app was closed) leaves the window using whatever
      // the previous run happened to write.
      bridge.setStartupState?.({
        startMinimized: settings.startMinimized,
        closeToTray: settings.closeToTray,
        minimizeToTray: settings.minimizeToTray,
        launchOnStartup: settings.launchOnStartup
      }).catch(() => {});
      void discordPresenceService.resumeIfLive(profiles);
    }

    const unsubscribe = discordPresenceService.subscribe((state) => {
      setConnectionStatus(state.status, state.message);
      // Discord closing the socket (client quit, pipe reset) must not leave a
      // profile stuck showing "Live" — the presence is gone at that point.
      if ((state.status === 'disconnected' || state.status === 'error') && state.activeProfileId) {
        useAppStore.getState().setProfileStatus(state.activeProfileId, 'idle');
      }
    });
    return () => { unsubscribe(); };
  }, [setConnectionStatus]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const state = useAppStore.getState();
        if (state.selectedProfileId) state.toggleFavorite(state.selectedProfileId);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  // The tray menu talks to the renderer through these events. Without a
  // subscriber, Go Live / Pause / Reconnect / Themes / Settings were all no-ops.
  useEffect(() => {
    const unsubscribe = window.myPresenceDesktop?.onTrayAction?.((action) => {
      const state = useAppStore.getState();
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      switch (action) {
        case 'go-live':
          if (profile) {
            state.setProfileStatus(profile.id, 'live');
            void discordPresenceService.start(profile);
          }
          break;
        case 'pause':
          if (profile) state.setProfileStatus(profile.id, 'idle');
          void discordPresenceService.stop();
          break;
        case 'reconnect':
          if (profile) void discordPresenceService.start(profile);
          break;
        case 'themes':
          state.setActiveTab('background');
          break;
        case 'settings':
          state.setActiveTab('settings');
          break;
        default:
          break;
      }
    });
    return () => { unsubscribe?.(); };
  }, []);

  const handlePaletteAction = useCallback((action: string) => {
    setPaletteOpen(false);
    const state = useAppStore.getState();
    if (action === 'create-profile') { createProfile(); setActiveTab('editor'); }
    else if (action === 'duplicate-profile') {
      const pid = state.selectedProfileId;
      if (pid) useAppStore.getState().duplicateProfile(pid);
    }
    else if (action === 'delete-profile') {
      const pid = state.selectedProfileId;
      if (pid) useAppStore.getState().deleteProfile(pid);
    }
    else if (action === 'switch-editor') setActiveTab('editor');
    else if (action === 'switch-assets') setActiveTab('assets');
    else if (action === 'switch-settings') setActiveTab('settings');
    else if (action === 'switch-background') setActiveTab('background');
    else if (action === 'toggle-presence') {
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      if (profile) {
        if (profile.status === 'live') {
          state.setProfileStatus(profile.id, 'idle');
          void discordPresenceService.stop();
        } else {
          state.setProfileStatus(profile.id, 'live');
          void discordPresenceService.start(profile);
        }
      }
    }
    else if (action === 'connect-discord') {
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      if (profile) void discordPresenceService.start(profile);
    }
    else if (action === 'disconnect-discord') {
      const profile = state.profiles.find((p) => p.id === state.selectedProfileId);
      if (profile) state.setProfileStatus(profile.id, 'idle');
      void discordPresenceService.stop();
    }
    else if (action === 'toggle-background') {
      setActiveTab('background');
    }
    else if (action.startsWith('select-profile:')) {
      const pid = action.replace('select-profile:', '');
      state.selectProfile(pid);
      setActiveTab('editor');
    }
    else if (action === 'toggle-favorite') {
      if (state.selectedProfileId) state.toggleFavorite(state.selectedProfileId);
    }
    else if (action.startsWith('theme:')) {
      const appearance = action.replace('theme:', '') as 'dark' | 'light' | 'oled' | 'system';
      state.updateSettings((s) => ({ ...s, appearance }));
    }
    else if (action === 'import-profile') {
      const bridge = window.myPresenceDesktop;
      if (bridge?.uploadImage) bridge.uploadImage().catch(() => {});
    }
  }, [createProfile, setActiveTab]);

  const minimize = () => window.myPresenceDesktop?.minimizeToTray?.();
  const maximize = () => window.myPresenceDesktop?.maximizeWindow?.();
  const closeWindow = () => window.myPresenceDesktop?.hideWindow?.();

  return (
    <div className="shell-root" ref={shellRef}>

      {/* Custom Windows 11 Titlebar */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <div className="titlebar-logo">
            <img src="./ic_app_logo.png" alt="MY PRESENCE" />
          </div>
          <span className="titlebar-label">My Presence</span>
        </div>

        <div className="titlebar-actions">
          <button className="titlebar-btn" onClick={() => setActiveTab('settings')} title="Settings" aria-label="Settings">
            <Settings2 size={14} />
          </button>
          <button className="titlebar-btn" onClick={minimize} title="Minimize" aria-label="Minimize">
            <Minus size={14} />
          </button>
          <button className="titlebar-btn" onClick={maximize} title="Maximize" aria-label="Maximize">
            <Square size={12} />
          </button>
          <button className="titlebar-btn close" onClick={closeWindow} title="Close" aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="shell-content">{children}</div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
      />
    </div>
  );
}
