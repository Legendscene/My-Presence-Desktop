/**
 * Loads the PACKAGED renderer's index.html from inside app.asar — the exact
 * path Electron serves in a packaged build — and reports whether React mounted.
 *
 * The regular smoke test loads dist/index.html off disk, which is a different
 * code path: inside the asar the file:// URL has to traverse the asar virtual
 * filesystem. A renderer that renders on disk can still come up blank inside
 * the archive.
 *
 * Usage: npx electron scripts/check-packaged-renderer.cjs <app.asar>
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

class Failure extends Error {}

const asarPath = process.argv[2];
if (!asarPath) {
  console.error('\n  FAIL: pass the path to app.asar\n');
  process.exit(1);
}

const hardStop = setTimeout(() => {
  console.error('\n  FAIL: timed out after 45s\n');
  app.exit(1);
}, 45000);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });

  const consoleErrors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });

  const failed = [];
  win.webContents.on('did-fail-load', (_e, code, desc, url) => failed.push(`${code} ${desc} — ${url}`));

  // This is what electron/main.ts builds for a packaged app. path.resolve
  // matters: a relative path produces a relative file:// URL that cannot load.
  const url = `file://${path.resolve(asarPath, 'dist', 'index.html')}`;
  try {
    await win.loadURL(url);
  } catch (error) {
    throw new Failure(`could not load ${url}: ${error.message}`);
  }

  await new Promise((r) => setTimeout(r, 2000));

  let result;
  try {
    result = await win.webContents.executeJavaScript(`(() => {
      const root = document.getElementById('root');
      return {
        nodes: root ? root.querySelectorAll('*').length : 0,
        shell: Boolean(document.querySelector('.shell-root')),
        grid: Boolean(document.querySelector('.app-grid')),
        sidebar: Boolean(document.querySelector('.profiles-panel')),
        bg: getComputedStyle(document.body).backgroundColor,
        text: (root ? root.innerText : '').trim().slice(0, 90)
      };
    })()`);
  } catch (error) {
    throw new Failure(`could not query the packaged renderer: ${error.message}`);
  }

  const problems = [];
  if (result.nodes < 50) problems.push(`only ${result.nodes} DOM nodes rendered — the packaged renderer is blank`);
  if (!result.shell) problems.push('.shell-root missing');
  if (!result.grid) problems.push('.app-grid missing');
  if (!result.sidebar) problems.push('.profiles-panel missing');
  if (failed.length) problems.push(`failed loads:\n      - ${failed.join('\n      - ')}`);

  if (problems.length) throw new Failure(problems.join('\n      - '));

  console.log(`\n  PACKAGED RENDERER OK — ${result.nodes} nodes, sidebar present`);
  console.log(`  text sample: ${JSON.stringify(result.text)}`);
  if (consoleErrors.length) {
    console.log(`  (${consoleErrors.length} console error/warning(s)):`);
    consoleErrors.slice(0, 5).forEach((m) => console.log(`    - ${m}`));
  }
  console.log('');
  clearTimeout(hardStop);
  app.exit(0);
}).catch((error) => {
  clearTimeout(hardStop);
  console.error(`\n  FAIL: ${error.message}\n`);
  app.exit(1);
});

app.on('window-all-closed', () => {});
