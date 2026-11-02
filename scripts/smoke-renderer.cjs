/**
 * Production smoke test.
 *
 * Loads the BUILT renderer over file:// in a real Electron window — exactly how
 * a packaged user sees it — and asserts the React tree actually mounted.
 *
 * This exists because the app once shipped with `base: '/'` in Vite, which made
 * the build emit `/assets/index-<hash>.js`. Under file:// that resolves to the
 * drive root, so the window came up blank. `tsc` and `vite build` both pass in
 * that state; only actually loading the page catches it.
 *
 * Usage: npm run smoke
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('\n  SMOKE FAIL: dist/index.html is missing — run "npm run build" first.\n');
  process.exit(1);
}

// Thrown to unwind out of the async handler. app.exit() alone does NOT stop
// execution, which previously let a failing run continue on to print a
// success line and exit 0.
class SmokeFailure extends Error {}

const HARD_TIMEOUT_MS = 60000;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1500,
    height: 980,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  const consoleErrors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });

  const failedRequests = [];
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    failedRequests.push(`${errorCode} ${errorDescription} — ${url}`);
  });

  try {
    await win.loadFile(indexPath);
  } catch (error) {
    throw new SmokeFailure(`could not load ${indexPath}: ${error.message}`);
  }

  // Give React a beat to mount and the entry chunk to evaluate.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  let result;
  try {
    result = await win.webContents.executeJavaScript(`(() => {
      const root = document.getElementById('root');
      const text = (root && root.innerText || '').trim();
      // NB: performance.getEntriesByType('resource') reports nothing useful for
      // file:// URLs (zero-size entries), so the blank-window regression is
      // asserted structurally below instead — a page that never ran its entry
      // chunk renders 1 node and none of the app classes.
      return {
        hasRoot: Boolean(root),
        childCount: root ? root.childElementCount : 0,
        nodeCount: root ? root.querySelectorAll('*').length : 0,
        title: document.title,
        shell: Boolean(document.querySelector('.shell-root')),
        grid: Boolean(document.querySelector('.app-grid')),
        sidebar: Boolean(document.querySelector('.profiles-panel')),
        stylesApplied: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)',
        // A blank screen still has a title, so assert on rendered text too.
        textSample: text.slice(0, 120)
      };
    })()`);
  } catch (error) {
    throw new SmokeFailure(`could not query the renderer: ${error.message}`);
  }

  const problems = [];
  if (!result.hasRoot) problems.push('#root is missing from index.html');
  if (result.childCount === 0) problems.push('#root is empty — React never mounted');
  if (result.nodeCount < 50) problems.push(`only ${result.nodeCount} DOM nodes rendered (expected a full app tree)`);
  if (!result.shell) problems.push('.shell-root not found — the app shell did not render');
  if (!result.grid) problems.push('.app-grid not found — layout did not render');
  if (!result.sidebar) problems.push('.profiles-panel not found — profile library did not render');
  if (!result.stylesApplied) problems.push('the stylesheet never applied — CSS did not resolve relative to dist/');
  if (failedRequests.length) problems.push(`failed resource loads:\n      - ${failedRequests.join('\n      - ')}`);

  if (problems.length) {
    throw new SmokeFailure(problems.join('\n      - '));
  }

  console.log(`\n  SMOKE OK — ${result.nodeCount} nodes, "${result.title}"`);
  console.log(`  text sample: ${JSON.stringify(result.textSample)}`);
  if (consoleErrors.length) {
    console.log(`  (${consoleErrors.length} console warning(s)/error(s) during load)`);
    consoleErrors.slice(0, 5).forEach((m) => console.log(`    - ${m}`));
  }
  console.log('');
  app.exit(0);
}).catch((error) => {
  clearTimeout(hardStop);
  console.error(`\n  SMOKE FAIL: ${error.message}\n`);
  app.exit(1);
});

const hardStop = setTimeout(() => {
  console.error(`\n  SMOKE FAIL: timed out after ${HARD_TIMEOUT_MS}ms — the renderer never finished loading.\n`);
  app.exit(1);
}, HARD_TIMEOUT_MS);

app.on('window-all-closed', () => {});