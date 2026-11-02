/**
 * Onboarding "exactly once" regression test.
 *
 * The user reported that onboarding reappears on every launch. The renderer
 * persists `onboardingComplete` through a debounced localStorage write, so a
 * launch-quit-relaunch cycle in a real Electron window is the only way to know
 * whether the flag actually survives. A browser tab is NOT a valid test here:
 * the app runs on the file:// origin when packaged and http://127.0.0.1:5173 in
 * dev, and those two never share localStorage.
 *
 * Usage: npm run check:onboarding
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

class CheckFailure extends Error {}

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('\n  FAIL: dist/index.html is missing — run "npm run build" first.\n');
  process.exit(1);
}

// A throwaway profile directory: this must never touch the real userData, where
// the user's real profiles and themes live.
const scratchUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'mypresence-onboarding-'));
app.setPath('userData', scratchUserData);
app.disableHardwareAcceleration();

const SETTINGS_KEY = 'my-presence.settings';

// Built as a source string and evaluated in the renderer, so the key literal has
// to live inside the snippet — a reference to a variable from this file would
// throw a ReferenceError in the page and be swallowed by the catch below.
const readSettingsInPage = `(() => {
  try {
    const raw = localStorage.getItem('${SETTINGS_KEY}');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})()`;

const hardStop = setTimeout(() => {
  console.error('\n  FAIL: timed out after 90000ms\n');
  app.exit(1);
}, 90000);

/**
 * Clicks through the wizard up to (but NOT including) the final "Get Started",
 * so the caller can assert on the very next tick.
 */
async function advanceToLastStep(win) {
  for (let guard = 0; guard < 20; guard++) {
    const state = await win.webContents.executeJavaScript(`(() => {
      const overlay = document.querySelector('.onboarding-overlay');
      if (!overlay) return { done: true };
      const buttons = [...document.querySelectorAll('.onboarding-footer button')];
      const isLast = buttons.some(b => b.textContent.includes('Get Started'));
      if (!isLast) {
        const next = buttons.find(b => b.textContent.includes('Continue'));
        if (next) next.click();
      }
      return { done: false, isLast };
    })()`);
    if (state.done) return;
    if (state.isLast) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new CheckFailure('the wizard never reached its final step');
}

async function newWindow() {
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
  await win.loadFile(indexPath);
  await new Promise((r) => setTimeout(r, 900));
  return win;
}

const onboardingVisible = (win) =>
  win.webContents.executeJavaScript(`Boolean(document.querySelector('.onboarding-overlay'))`);

app.whenReady().then(async () => {
  try {
    // ── Launch 1: a fresh install must ask ────────────────────────────────
    let win = await newWindow();

    if (!(await onboardingVisible(win))) {
      throw new CheckFailure('onboarding did not appear on a fresh install');
    }
    console.log('  launch 1: onboarding shown (correct for a fresh install)');

    await advanceToLastStep(win);    // The final click, and the storage read happen inside ONE script: the click,
    // then two microtasks for React to flush, then the read. No macrotask and no
    // IPC round-trip in between, so the 400ms debounce timer cannot have fired.
    const finishResult = await win.webContents.executeJavaScript(`(async () => {
      const buttons = [...document.querySelectorAll('.onboarding-footer button')];
      const done = buttons.find(b => b.textContent.includes('Get Started'));
      if (!done) return { clicked: false };
      done.click();
      // Let React commit the close.
      await Promise.resolve();
      await Promise.resolve();
      const settings = ${readSettingsInPage};
      return {
        clicked: true,
        overlayGone: !document.querySelector('.onboarding-overlay'),
        settings
      };
    })()`);

    if (!finishResult.clicked) throw new CheckFailure('could not find the Get Started button');
    if (!finishResult.settings || finishResult.settings.onboardingComplete !== true) {
      throw new CheckFailure(
        `onboardingComplete is ${JSON.stringify(finishResult.settings && finishResult.settings.onboardingComplete)} ` +
        'immediately after the wizard finished — expected true. Finishing onboarding must be persisted ' +
        'synchronously, not on a debounce, or a user who quits right after is shown the wizard again.'
      );
    }
    console.log('  launch 1: wizard completed, onboardingComplete=true persisted synchronously');

    // ── Quit and relaunch: this is the reported bug ───────────────────────
    win.destroy();
    win = null;
    await new Promise((r) => setTimeout(r, 600));

    win = await newWindow();
    if (await onboardingVisible(win)) {
      const again = await win.webContents.executeJavaScript(readSettingsInPage);
      throw new CheckFailure(
        `REGRESSION: onboarding appeared again on the second launch even though settings said onboardingComplete=${JSON.stringify(again && again.onboardingComplete)}`
      );
    }
    console.log('  launch 2: onboarding correctly stayed hidden');

    // ── A third launch, with a fresh window but the same profile ──────────
    win.destroy();
    await new Promise((r) => setTimeout(r, 400));
    win = await newWindow();
    if (await onboardingVisible(win)) {
      throw new CheckFailure('REGRESSION: onboarding reappeared on the third launch');
    }
    console.log('  launch 3: onboarding correctly stayed hidden');

    console.log('\n  ONBOARDING OK — shown once, never again.\n');
    clearTimeout(hardStop);
    app.exit(0);
  } catch (error) {
    clearTimeout(hardStop);
    console.error(`\n  FAIL: ${error.message}\n`);
    console.error(`  (scratch profile: ${scratchUserData})\n`);
    app.exit(1);
  }
}).catch((error) => {
  clearTimeout(hardStop);
  console.error(`\n  FAIL: ${error && error.message ? error.message : error}\n`);
  app.exit(1);
});

app.on('window-all-closed', () => {});
