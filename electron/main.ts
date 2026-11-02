import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, protocol, shell, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { discordRpcClient, type DiscordActivity } from './discordRpc';
import { pickAndUploadImage, resolveImageUrl, fetchImageAsDataUrl, uploadBytes } from './imageUpload';
import { readStartupState, writeStartupState, type StartupState } from './startupState';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Re-read on demand rather than caching at module scope: the renderer's first
// `app:startup-state` call can land after the user has already changed a
// setting, and a stale cache would keep the window behaving the old way.
const startup = readStartupState;

function getDefaultBackgroundPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'public', 'assets', 'backgrounds', 'default.mp4');
  }
  return path.join(app.getAppPath(), 'assets', 'backgrounds', 'default.mp4');
}

function ensureBackgroundsDir(): string {
  const dir = path.join(app.getPath('userData'), 'backgrounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function copyFileToBackgrounds(filePath: string): string {
  const dir = ensureBackgroundsDir();
  const ext = path.extname(filePath);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const destPath = path.join(dir, fileName);
  fs.copyFileSync(filePath, destPath);
  return destPath;
}

// Dropped/pasted files never have a path on disk yet, so the renderer sends the
// bytes and we persist them ourselves. Storing them under userData (instead of
// a blob: URL) is what makes a dropped background survive an app restart.
function saveBackgroundBytes(data: Buffer, originalName: string): string {
  const dir = ensureBackgroundsDir();
  const ext = path.extname(originalName).toLowerCase() || '.mp4';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const destPath = path.join(dir, fileName);
  fs.writeFileSync(destPath, data);
  return destPath;
}

// Resolve a `local-video://<name>` request to a real file, refusing anything
// that tries to escape the backgrounds directory (e.g. "..%2F..%2FWindows").
function resolveBackgroundFile(requestUrl: string): string | null {
  const requested = path.basename(decodeURIComponent(requestUrl.replace(/^local-video:\/\//i, '')));
  if (!requested || requested === '.' || requested === '..') return null;

  const dir = ensureBackgroundsDir();
  const filePath = path.resolve(dir, requested);
  const dirPrefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (!filePath.startsWith(dirPrefix)) return null;

  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null;
}

// Only a run that actually came from the login item should come up in the tray.
// `process.argv` alone is not enough: it survives a normal launch on some
// systems, which previously made the app open invisibly and look broken.
const launchedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin === true
  || process.argv.includes('--hidden');

function loadTrayIcon() {
  try {
    return nativeImage.createFromPath(path.join(app.getAppPath(), 'ic_app_logo.png'));
  } catch {
    // Fallback to a minimal transparent icon
    return nativeImage.createEmpty();
  }
}

function showMainWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendTrayAction(action: string) {
  mainWindow?.webContents.send('tray:action', action);
}

function createTray() {
  if (tray) return;
  tray = new Tray(loadTrayIcon());
  tray.setToolTip('MY PRESENCE');

  const menu = Menu.buildFromTemplate([
    { label: 'Show My Presence', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Go Live', click: () => sendTrayAction('go-live') },
    { label: 'Pause Presence', click: () => sendTrayAction('pause') },
    { label: 'Reconnect', click: () => sendTrayAction('reconnect') },
    { type: 'separator' },
    { label: 'Themes', click: () => { showMainWindow(); sendTrayAction('themes'); } },
    { label: 'Settings', click: () => { showMainWindow(); sendTrayAction('settings'); } },
    { type: 'separator' },
    { label: 'Exit', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => showMainWindow());
  tray.on('click', () => showMainWindow());
}

function createWindow() {
  const state = startup();

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1240,
    minHeight: 780,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#1e1f22',
    icon: path.join(app.getAppPath(), 'ic_app_logo.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Nothing in the renderer should be able to navigate the window away from our
  // own bundle; external links are handed to the OS browser instead.
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const allowed = isDev ? /^http:\/\/127\.0\.0\.1:5173\//i.test(target) : /^file:\/\//i.test(target);
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//i.test(target)) void shell.openExternal(target);
    }
  });
  mainWindow.webContents.on('will-attach-webview', (event) => { event.preventDefault(); });

  const url = isDev ? 'http://127.0.0.1:5173' : `file://${path.join(app.getAppPath(), 'dist', 'index.html')}`;
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) { void shell.openExternal(target); }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    // Stay in the tray when the run came from the login item, or when the user
    // asked to start minimized. Every other launch shows the window.
    if (launchedAtLogin || state.startMinimized) return;
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    // Only intercept when the user asked us to keep running, and never on a
    // real quit. `isQuitting` is the authoritative signal for the latter.
    if (!isQuitting && startup().closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Electron's 'minimize' event carries no cancellable event object, so
  // minimize-to-tray has to be implemented by overriding `minimize()` itself.
  // Otherwise the window still minimizes to the taskbar and the tray icon and
  // the visible window become two separate things.
  const nativeMinimize = mainWindow.minimize.bind(mainWindow);
  mainWindow.minimize = () => {
    if (startup().minimizeToTray) mainWindow?.hide();
    else nativeMinimize();
  };

  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { showMainWindow(); });

  app.whenReady().then(() => {
    // Serve user-picked background videos over a custom scheme so <video> can
    // load them without the renderer needing filesystem access.
    protocol.registerFileProtocol('local-video', (request, callback) => {
      const filePath = resolveBackgroundFile(request.url);
      if (filePath) {
        callback({ path: filePath });
      } else {
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    });

    // Remove native menu bar entirely
    Menu.setApplicationMenu(null);

    discordRpcClient.onStatus((payload) => {
      mainWindow?.webContents.send('rpc:status', payload);
    });

    createTray();
    createWindow();

    // Auto-open DevTools in development
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'bottom' });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  isQuitting = true;
  discordRpcClient.disconnect();
});

// Enhanced IPC handlers
ipcMain.handle('app:get-meta', () => ({
  platform: process.platform,
  darkMode: nativeTheme.shouldUseDarkColors,
  version: app.getVersion()
}));

ipcMain.handle('app:set-login-item', (_event, enabled: boolean) => {
  const on = Boolean(enabled);
  writeStartupState({ launchOnStartup: on });

  // In development the executable is electron.exe itself, so an entry registered
  // without an explicit path made Windows launch a bare Electron shell at login
  // — that is the "electron opens something random on startup" bug. Dev runs
  // therefore never touch the real login items; they only record the intent.
  if (isDev) {
    return { ok: true, applied: false, reason: 'dev' as const };
  }

  app.setLoginItemSettings({
    openAtLogin: on,
    openAsHidden: true,
    args: ['--hidden'],
    path: process.execPath
  });
  return { ok: true, applied: true as const };
});

ipcMain.handle('app:get-login-item', () => app.getLoginItemSettings().openAtLogin);

/**
 * The renderer mirrors its startup-relevant settings here so the main process
 * can act on them before the next window exists (show-or-hide at boot, and what
 * the close button means).
 */
ipcMain.handle('app:startup-state', (_event, patch?: Partial<StartupState>) => {
  if (patch && typeof patch === 'object') writeStartupState(patch);
  return readStartupState();
});

ipcMain.handle('app:hide', () => { mainWindow?.hide(); });
ipcMain.handle('app:show', () => { showMainWindow(); });
ipcMain.handle('app:minimize-to-tray', () => { mainWindow?.hide(); });
ipcMain.handle('app:is-visible', () => mainWindow?.isVisible() ?? false);
ipcMain.handle('app:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('rpc:connect', async (_event, applicationId: string) => {
  await discordRpcClient.connect(applicationId);
  return { ok: true };
});

ipcMain.handle('rpc:set-activity', async (_event, activity: DiscordActivity) => {
  await discordRpcClient.setActivity(activity);
  return { ok: true };
});

ipcMain.handle('rpc:clear', async () => {
  await discordRpcClient.clearActivity();
  return { ok: true };
});

ipcMain.handle('rpc:disconnect', async () => {
  discordRpcClient.disconnect();
  return { ok: true };
});

ipcMain.handle('image:upload', async () => {
  return pickAndUploadImage(mainWindow);
});

// Videos are local-only (Discord can't show them), so they go straight into
// userData and come back as a local-video:// URL — never a remote host.
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv'];
const MAX_VIDEO_BYTES = 400 * 1024 * 1024;

function toVideoUploadResult(destPath: string) {
  return { ok: true as const, url: `local-video://${path.basename(destPath)}`, fileName: path.basename(destPath) };
}

ipcMain.handle('video:upload', async () => {
  const selection = mainWindow
    ? await dialog.showOpenDialog(mainWindow, {
        title: 'Choose a video',
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: VIDEO_EXTENSIONS.map((ext) => ext.slice(1)) }]
      })
    : await dialog.showOpenDialog({
        title: 'Choose a video',
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: VIDEO_EXTENSIONS.map((ext) => ext.slice(1)) }]
      });
  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false as const, canceled: true as const };
  }
  const filePath = selection.filePaths[0];
  return toVideoUploadResult(copyFileToBackgrounds(filePath));
});

// Drag-and-drop: the renderer only holds the bytes, so we write them to disk
// here. A blob: URL would be persisted to the theme and break on next launch.
ipcMain.handle('video:save-bytes', async (_event, payload: { base64: string; fileName: string }) => {
  try {
    const data = Buffer.from(payload?.base64 ?? '', 'base64');
    if (!data.length) return { ok: false as const, error: 'That file was empty.' };
    if (data.length > MAX_VIDEO_BYTES) {
      return { ok: false as const, error: `That video is too big (${(data.length / 1048576).toFixed(0)} MB). Keep it under 400 MB.` };
    }
    const ext = path.extname(payload?.fileName ?? '').toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(ext)) {
      return { ok: false as const, error: 'Use an MP4, WebM or MOV file.' };
    }
    return toVideoUploadResult(saveBackgroundBytes(data, payload.fileName));
  } catch {
    return { ok: false as const, error: 'Could not save that video.' };
  }
});

ipcMain.handle('image:resolve', async (_event, url: string) => {
  return resolveImageUrl(url);
});

ipcMain.handle('image:fetch-data-url', async (_event, url: string) => {
  return fetchImageAsDataUrl(url);
});

ipcMain.handle('image:upload-bytes', async (_event, payload: { base64: string; mime: string }) => {
  return uploadBytes(payload.base64, payload.mime);
});

ipcMain.handle('bg:get-default-path', () => {
  return getDefaultBackgroundPath();
});
