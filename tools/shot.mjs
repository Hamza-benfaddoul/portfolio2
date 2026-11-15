#!/usr/bin/env node
// shot.mjs — render a page in headless Chrome and save screenshots. Zero dependencies (Node >= 22).
//
// Usage:
//   node shot.mjs <file-or-url> <outDir> [options]
//
// Options:
//   --preset desktop|wide|laptop|tablet|mobile|small   viewport preset (default desktop = 1440x900)
//   --w N --h N --dpr N --mobile                       override the preset
//   --mode tiles|full|viewport|both                    tiles = one viewport-sized shot per scroll step (default)
//                                                      full  = one downscaled overview of the whole page
//                                                      both  = tiles + full
//   --name PREFIX                                      file name prefix (default: preset name)
//   --max-tiles N                                      cap on tiles (default 18)
//   --wait MS                                          settle time after load (default 900)
//   --settle MS                                        settle time after each scroll step (default 450)
//   --eval "JS"                                        run JS in the page after load (may return a promise)
//   --selector "CSS"                                   capture only this element (use with --scale 2 for detail)
//   --scale N                                          image scale for --selector (default 1)
//   --scheme dark|light                                emulate prefers-color-scheme
//   --reduced-motion                                   emulate prefers-reduced-motion: reduce
//   --no-js                                            disable JavaScript (tests the no-JS fallback)
//   --full-width N                                     pixel width of the --mode full overview (default 700)
//
// Prints a JSON report: files written, page metrics, horizontal-overflow offenders,
// console errors, failed network requests. Exit code 0 unless the page failed to load.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PRESETS = {
  desktop: { w: 1440, h: 900, dpr: 1, mobile: false },
  wide: { w: 1920, h: 1080, dpr: 1, mobile: false },
  laptop: { w: 1280, h: 720, dpr: 1, mobile: false },
  tablet: { w: 820, h: 1180, dpr: 1, mobile: true },
  mobile: { w: 390, h: 844, dpr: 2, mobile: true },
  small: { w: 320, h: 640, dpr: 2, mobile: true },
};
const FLAGS = new Set(['mobile', 'reduced-motion', 'no-js', 'help']);

const argv = process.argv.slice(2);
const opts = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (FLAGS.has(k)) opts[k] = true;
    else opts[k] = argv[++i];
  } else pos.push(a);
}
if (opts.help || pos.length < 2) {
  console.error('usage: node shot.mjs <file-or-url> <outDir> [--preset desktop|mobile|tablet|small|laptop|wide] [--mode tiles|full|both|viewport] [--name p] [--eval js] [--selector css] [--scale n] [--scheme dark|light] [--reduced-motion] [--no-js]');
  process.exit(2);
}
const [target, outDir] = pos;
const presetName = opts.preset || 'desktop';
const preset = PRESETS[presetName];
if (!preset) { console.error('unknown preset ' + presetName); process.exit(2); }
const W = Number(opts.w || preset.w);
const H = Number(opts.h || preset.h);
const DPR = Number(opts.dpr || preset.dpr);
const MOBILE = Boolean(opts.mobile || preset.mobile);
const MODE = opts.mode || 'tiles';
const NAME = opts.name || presetName;
const MAX_TILES = Number(opts['max-tiles'] || 18);
const WAIT = Number(opts.wait || 900);
const SETTLE = Number(opts.settle || 450);
const FULL_WIDTH = Number(opts['full-width'] || 700);
const SCALE = Number(opts.scale || 1);

const url = /^(https?|file|data|about):/i.test(target) ? target : pathToFileURL(path.resolve(target)).href;
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDir = mkdtempSync(path.join(tmpdir(), 'shot-chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDir}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
  '--mute-audio', '--disable-background-networking', '--disable-sync', '--disable-translate',
  '--allow-file-access-from-files', `--window-size=${W},${H}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let done = false;
function cleanup() {
  if (done) return; done = true;
  try { chrome.kill('SIGKILL'); } catch {}
  setTimeout(() => { try { rmSync(userDir, { recursive: true, force: true }); } catch {} }, 150);
}
const killer = setTimeout(() => { console.error('TIMEOUT after 90s'); cleanup(); setTimeout(() => process.exit(1), 300); }, 90000);

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('Chrome did not expose a DevTools endpoint: ' + buf.slice(0, 400))), 20000);
  chrome.stderr.on('data', (d) => {
    buf += d.toString();
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  chrome.on('exit', (c) => { clearTimeout(t); reject(new Error('Chrome exited early with code ' + c + ': ' + buf.slice(0, 400))); });
});

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
let nextId = 1;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message + (msg.error.data ? ' ' + msg.error.data : ''))); else resolve(msg.result);
  } else if (msg.method) {
    for (const l of listeners) l(msg);
  }
});
function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
function once(method, timeoutMs) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { resolve(null); }, timeoutMs);
    const l = (msg) => { if (msg.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(msg.params); } };
    listeners.push(l);
  });
}

const report = { url, viewport: { w: W, h: H, dpr: DPR, mobile: MOBILE }, files: [], metrics: null, consoleErrors: [], failedRequests: [], loaded: false };
const reqUrls = new Map();
listeners.push((msg) => {
  const p = msg.params || {};
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = p.exceptionDetails || {};
    report.consoleErrors.push('EXCEPTION: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown').toString().slice(0, 400));
  } else if (msg.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'assert')) {
    report.consoleErrors.push('console.' + p.type + ': ' + (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
  } else if (msg.method === 'Log.entryAdded' && p.entry && p.entry.level === 'error') {
    report.consoleErrors.push('LOG: ' + (p.entry.text || '').slice(0, 300) + (p.entry.url ? ' @ ' + p.entry.url.slice(0, 160) : ''));
  } else if (msg.method === 'Network.requestWillBeSent') {
    reqUrls.set(p.requestId, p.request.url);
  } else if (msg.method === 'Network.loadingFailed') {
    const u = reqUrls.get(p.requestId) || '?';
    if (!p.canceled) report.failedRequests.push({ url: u.slice(0, 200), error: p.errorText });
  } else if (msg.method === 'Network.responseReceived' && p.response && p.response.status >= 400) {
    report.failedRequests.push({ url: p.response.url.slice(0, 200), status: p.response.status });
  }
});

try {
  const { targetInfos } = await send('Target.getTargets');
  let page = targetInfos.find((t) => t.type === 'page');
  if (!page) { const r = await send('Target.createTarget', { url: 'about:blank' }); page = { targetId: r.targetId }; }
  const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: MOBILE });
  if (MOBILE) {
    await S('Emulation.setTouchEmulationEnabled', { enabled: true });
    await S('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  }
  const features = [];
  if (opts.scheme) features.push({ name: 'prefers-color-scheme', value: opts.scheme });
  if (opts['reduced-motion']) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
  if (features.length) await S('Emulation.setEmulatedMedia', { features });
  if (opts['no-js']) await S('Emulation.setScriptExecutionDisabled', { value: true });

  const loadP = once('Page.loadEventFired', 30000);
  const nav = await S('Page.navigate', { url });
  if (nav.errorText) throw new Error('navigation failed: ' + nav.errorText);
  const loaded = await loadP;
  report.loaded = Boolean(loaded);
  const ev = async (expression) => {
    if (opts['no-js']) { await S('Emulation.setScriptExecutionDisabled', { value: false }); }
    try {
      const r = await S('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    } finally {
      if (opts['no-js']) { await S('Emulation.setScriptExecutionDisabled', { value: true }); }
    }
  };
  if (!opts['no-js']) { try { await ev('document.fonts ? document.fonts.ready.then(() => true) : true'); } catch {} }
  await sleep(WAIT);
  if (opts.eval) { report.evalResult = await ev(`(async () => { ${opts.eval} })()`); await sleep(500); }

  const shot = async (file, params) => {
    const r = await S('Page.captureScreenshot', { format: 'jpeg', quality: 82, ...params });
    const f = path.join(outDir, file);
    writeFileSync(f, Buffer.from(r.data, 'base64'));
    report.files.push(f);
  };
  const scrollTo = (y) => ev(`window.scrollTo({ top: ${y}, left: 0, behavior: 'instant' }); true`);
  const pageH = () => ev('Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)');

  if (opts.selector) {
    const rect = await ev(`(() => { const el = document.querySelector(${JSON.stringify(opts.selector)}); if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
    if (!rect) throw new Error('selector not found: ' + opts.selector);
    await sleep(SETTLE + 400);
    await shot(`${NAME}-element.jpg`, { captureBeyondViewport: true, clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: Math.max(1, rect.width), height: Math.max(1, rect.height), scale: SCALE } });
  } else {
    let total = await pageH();
    // warm-up pass so lazy images load and scroll-triggered reveals fire
    for (let y = 0; y < total; y += Math.round(H * 0.8)) { await scrollTo(y); await sleep(120); }
    await scrollTo(total); await sleep(250);
    total = await pageH();
    if (MODE === 'viewport') {
      await scrollTo(0); await sleep(SETTLE);
      await shot(`${NAME}-viewport.jpg`, {});
    }
    if (MODE === 'tiles' || MODE === 'both') {
      const ys = [];
      for (let y = 0; y + H < total; y += H) ys.push(y);
      ys.push(Math.max(0, total - H));
      const uniq = [...new Set(ys)].slice(0, MAX_TILES);
      if (ys.length > uniq.length) report.truncatedTiles = `page needs ${new Set(ys).size} tiles, captured ${uniq.length}`;
      let i = 1;
      for (const y of uniq) {
        await scrollTo(y); await sleep(SETTLE);
        await shot(`${NAME}-${String(i).padStart(2, '0')}.jpg`, {});
        i++;
      }
    }
    if (MODE === 'full' || MODE === 'both') {
      await scrollTo(0); await sleep(SETTLE);
      const scale = Math.min(1, FULL_WIDTH / (W * DPR));
      await shot(`${NAME}-full.jpg`, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: Math.min(total, 30000), scale } });
    }
  }

  report.metrics = await ev(`(() => {
    const de = document.documentElement; const vw = de.clientWidth; const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1.5 || r.left < -1.5) {
        let clipped = false; let p = el.parentElement;
        while (p && p !== document.body) { const o = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(o.overflowX)) { clipped = true; break; } p = p.parentElement; }
        if (clipped) continue;
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || '')).toString().slice(0, 60);
        offenders.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls.trim().split(/\\s+/).join('.') : ''), left: Math.round(r.left), right: Math.round(r.right) });
        if (offenders.length >= 10) break;
      }
    }
    return { title: document.title, viewportWidth: vw, pageScrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth), pageHeight: Math.max(de.scrollHeight, document.body.scrollHeight), horizontalOverflow: Math.max(de.scrollWidth, document.body.scrollWidth) > vw + 1, overflowOffenders: offenders, images: document.images.length, brokenImages: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.getAttribute('src')).slice(0, 10), h1Count: document.querySelectorAll('h1').length };
  })()`);
  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
  report.failedRequests = report.failedRequests.slice(0, 20);
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.error = String(e && e.message || e);
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
  try { ws.close(); } catch {}
  cleanup();
  setTimeout(() => process.exit(process.exitCode || 0), 400);
}
