/// <reference types="vite/client" />

type RpcStatusPayload = {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  message: string;
};

type ImageUploadResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type VideoUploadResult =
  | { ok: true; url: string; fileName?: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

type ImageResolveResult =
  | { ok: true; url: string; changed: boolean }
  | { ok: false; error: string };

type ImageFetchDataUrlResult =
  | { ok: true; dataUrl: string; mime: string; animated: boolean }
  | { ok: false; error: string };

/**
 * Settings the main process needs before any window exists, mirrored out of the
 * renderer's settings so boot behaviour is correct from the first frame.
 */
type StartupState = {
  startMinimized: boolean;
  closeToTray: boolean;
  minimizeToTray: boolean;
  launchOnStartup: boolean;
};

declare global {
  /** Injected by Vite's `define` from package.json at build time. */
  const __APP_VERSION__: string;

  interface Window {
    myPresenceDesktop?: {
      getMeta: () => Promise<{
        platform: string;
        darkMode: boolean;
        version: string;
      }>;
      setLaunchOnStartup: (enabled: boolean) => Promise<{ ok: boolean; applied?: boolean; reason?: string }>;
      getLaunchOnStartup: () => Promise<boolean>;
      setStartupState: (patch: Partial<StartupState>) => Promise<StartupState>;
      getStartupState: () => Promise<StartupState>;
      connect: (applicationId: string) => Promise<{ ok: boolean }>;
      setActivity: (activity: unknown) => Promise<{ ok: boolean }>;
      clear: () => Promise<{ ok: boolean }>;
      disconnect: () => Promise<{ ok: boolean }>;
      uploadImage: () => Promise<ImageUploadResult>;
      uploadVideo: () => Promise<VideoUploadResult>;
      saveVideoBytes: (base64: string, fileName: string) => Promise<VideoUploadResult>;
      resolveImageUrl: (url: string) => Promise<ImageResolveResult>;
      fetchImageAsDataUrl: (url: string) => Promise<ImageFetchDataUrlResult>;
      uploadImageBytes: (base64: string, mime: string) => Promise<ImageUploadResult>;
      onStatus: (callback: (payload: RpcStatusPayload) => void) => () => void;
      // New enhanced app control
      hideWindow: () => Promise<void>;
      showWindow: () => Promise<void>;
      minimizeToTray: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      isWindowVisible: () => Promise<boolean>;
      onTrayAction: (callback: (action: string) => void) => () => void;
      getDefaultBackgroundPath: () => Promise<string>;
    };
  }
}

export {};
