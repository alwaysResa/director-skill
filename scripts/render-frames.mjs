#!/usr/bin/env node
/**
 * director / render-frames.mjs
 * Deterministic HTML -> PNG/JPEG frame renderer using Chromium DevTools Protocol.
 *
 * No npm dependencies. Requires Node >= 22, Chromium/Chrome, and (for muxing) ffmpeg.
 *
 * Usage:
 *   node scripts/render-frames.mjs \
 *     --url "file:///abs/path/index.html" \
 *     --out frames \
 *     --width 1080 --height 1920 --fps 24 --duration 5
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import os from 'node:os';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.url || !args.out) {
  console.log(`director renderer

Usage:
  node scripts/render-frames.mjs --url <url> --out <dir> [options]

Required:
  --url <url>              file:// or http(s):// URL of the animation
  --out <dir>              output directory

Options:
  --width <px>             viewport width (default 1080)
  --height <px>            viewport height (default 1920)
  --fps <n>                frames per second (default 24)
  --duration <sec>         animation duration; auto-detected from window.DUR if omitted
  --start <frame>          first frame index (default 0)
  --end <frame>            last frame index (default ceil(duration*fps)-1)
  --format png|jpeg        capture format (default png)
  --quality <1-100>        JPEG quality (default 92)
  --scale <n>              device scale factor (default 1)
  --hide <selector>        CSS selector(s) to hide (default "#ui"; pass "" to disable)
  --seek-fn <expr>         JS function expression (default "window.__seek")
  --ready <expr>           extra JS readiness expression
  --resume                 skip frames that already exist
  --force                  overwrite existing frames (default)
  --chrome <path>          Chromium/Chrome executable
  --gpu                    do not pass --disable-gpu
  --timeout <ms>           page readiness timeout (default 120000)
  --keep-profile           keep the temporary Chromium profile
  --quiet                  less logging
  --help                   show this help

The page must expose a seek function (default window.__seek(t)) and should expose
window.DUR (seconds) and window.FPS. See references/html-contract.md.
`);
  process.exit(args.help ? 0 : 1);
}

const W = num(args.width, 1080);
const H = num(args.height, 1920);
const FPS = num(args.fps, 24);
const SCALE = num(args.scale, 1);
const FORMAT = String(args.format || 'png').toLowerCase();
const QUALITY = num(args.quality, 92);
const OUT = path.resolve(args.out);
const START = Math.max(0, Math.floor(num(args.start, 0)));
const HIDE = args.hide === undefined ? '#ui' : String(args.hide);
const SEEK_FN = String(args['seek-fn'] || 'window.__seek');
const READY = args.ready ? String(args.ready) : '';
const TIMEOUT = num(args.timeout, 120000);
const EXT = FORMAT === 'jpeg' || FORMAT === 'jpg' ? 'jpg' : 'png';
const RESUME = Boolean(args.resume) && !args.force;
const QUIET = Boolean(args.quiet);

if (!['png', 'jpeg', 'jpg'].includes(FORMAT)) fail(`Unsupported --format: ${FORMAT}`);
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

let chrome = null;
let ws;
const chromePath = findChrome(args.chrome);
const profile = path.join(os.tmpdir(), `director-chrome-${process.pid}-${Date.now()}`);
const portFile = path.join(profile, 'DevToolsActivePort');
const chromeArgs = [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-allow-origins=*',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`,
  '--autoplay-policy=no-user-gesture-required',
];
if (!args.gpu) chromeArgs.push('--disable-gpu');
chromeArgs.push('about:blank');

if (!QUIET) {
  console.log(`chrome: ${chromePath}`);
  console.log(`render: ${W}x${H} @ ${FPS}fps, ${FORMAT}${EXT === 'jpg' ? ` q${QUALITY}` : ''}, scale ${SCALE}`);
}

chrome = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
let chromeStderr = '';
chrome.stderr.on('data', (d) => { chromeStderr += d.toString(); });
chrome.on('error', (e) => fail(`Cannot launch Chromium: ${e.message}`));

const pending = new Map();
let msgId = 0;
const pageErrors = [];

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const port = await waitForDebugPort(portFile, 15000);
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((x) => x.type === 'page');
  if (!page?.webSocketDebuggerUrl) fail('Chromium did not expose a page target');

  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket connection failed'));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(`${m.error.message}${m.error.data ? `: ${m.error.data}` : ''}`));
      else resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params?.exceptionDetails;
      pageErrors.push(d?.exception?.description || d?.text || 'JavaScript exception');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      const text = (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (text) pageErrors.push(`console.error: ${text}`);
    }
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: SCALE, mobile: false,
    screenWidth: W, screenHeight: H,
  });
  await cdp('Page.navigate', { url: args.url });

  await waitForPageReady();
  await cdp('Runtime.evaluate', {
    expression: 'document.fonts.ready.then(() => true)',
    awaitPromise: true,
    returnByValue: true,
  });
  if (READY) await waitForExpression(READY);
  if (HIDE) await hideSelector(HIDE);
  await sleep(250);

  const duration = args.duration ? Number(args.duration) : await detectDuration();
  if (!Number.isFinite(duration) || duration <= 0) fail('Cannot detect duration. Pass --duration <seconds>.');
  const end = args.end !== undefined ? Math.floor(Number(args.end)) : Math.ceil(duration * FPS) - 1;
  if (end < START) fail(`--end (${end}) is before --start (${START})`);

  const total = end - START + 1;
  if (!QUIET) console.log(`frames: ${START}..${end} (${total}) — ${duration}s @ ${FPS}fps`);

  const seekType = await cdp('Runtime.evaluate', {
    expression: `typeof (${SEEK_FN})`, returnByValue: true,
  });
  if (seekType.result.value !== 'function') {
    fail(`The page does not expose a seek function (${SEEK_FN}). Add window.__seek(t) or pass --seek-fn.`);
  }

  const t0 = Date.now();
  let rendered = 0;
  for (let i = START; i <= end; i++) {
    const file = path.join(OUT, `f${String(i).padStart(5, '0')}.${EXT}`);
    if (RESUME && existsSync(file) && statSync(file).size > 1000) {
      if (!QUIET) process.stdout.write(`\rskip ${i}`);
      continue;
    }
    const t = Math.min(i / FPS, duration);
    await seek(SEEK_FN, t);
    const shot = await cdp('Page.captureScreenshot', {
      format: EXT === 'jpg' ? 'jpeg' : 'png',
      ...(EXT === 'jpg' ? { quality: QUALITY } : {}),
      fromSurface: true,
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: W, height: H, scale: 1 },
    });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    rendered++;
    if (!QUIET && (rendered % 24 === 0 || i === end)) {
      const done = i - START + 1;
      const sec = (Date.now() - t0) / 1000;
      const rate = rendered / Math.max(sec, 0.001);
      const eta = (total - done) / Math.max(rate, 0.001);
      process.stdout.write(`\rframe ${i}/${end}  ${sec.toFixed(0)}s  eta ${eta.toFixed(0)}s   `);
    }
  }
  if (!QUIET) process.stdout.write('\n');

  if (pageErrors.length) {
    console.error('\nPage errors:');
    for (const e of [...new Set(pageErrors)].slice(0, 20)) console.error(`  - ${e}`);
    fail('Page reported JavaScript errors during render.');
  }

  const info = {
    url: args.url,
    width: W, height: H, fps: FPS, duration,
    start: START, end, frames: end - START + 1, rendered,
    format: EXT, scale: SCALE,
    chrome: chromePath,
    title: (await cdp('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result.value,
    htmlHash: htmlHash(args.url),
    renderedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(OUT, 'render-info.json'), JSON.stringify(info, null, 2) + '\n');
  if (!QUIET) console.log(`done: ${rendered} rendered, ${total - rendered} skipped -> ${OUT}`);
}

async function seek(expr, t) {
  await cdp('Runtime.evaluate', {
    expression: `(async()=>{(${expr})(${Number(t).toFixed(6)});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))));return true})()`,
    awaitPromise: true,
    returnByValue: true,
  });
}

async function hideSelector(selector) {
  const expr = `(()=>{const s=${JSON.stringify(selector)};document.querySelectorAll(s).forEach(el=>el.style.setProperty('display','none','important'));return document.querySelectorAll(s).length})()`;
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (!QUIET) console.log(`hidden: ${r.result.value} element(s) — ${selector}`);
}

async function waitForPageReady() {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const r = await cdp('Runtime.evaluate', {
        expression: "document.readyState === 'complete' && !!document.body",
        returnByValue: true,
      });
      if (r.result.value) return;
    } catch {}
    await sleep(100);
  }
  fail('Timed out waiting for page load');
}

async function waitForExpression(expr) {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    try {
      const r = await cdp('Runtime.evaluate', {
        expression: `Boolean(${expr})`, returnByValue: true,
      });
      if (r.result.value) return;
    } catch {}
    await sleep(100);
  }
  fail(`Timed out waiting for --ready expression: ${expr}`);
}

async function detectDuration() {
  const r = await cdp('Runtime.evaluate', {
    expression: `(()=>{const c=[window.DUR,window.DURATION,window.OPENER&&window.OPENER.DURATION,window.tl&&window.tl.duration&&window.tl.duration()].find(v=>Number.isFinite(v)&&v>0);return c||null})()`,
    returnByValue: true,
  });
  return Number(r.result.value);
}

function htmlHash(url) {
  try {
    if (!url.startsWith('file://')) return null;
    const p = decodeURIComponent(new URL(url).pathname);
    if (!existsSync(p)) return null;
    return createHash('sha256').update(readFileSync(p)).digest('hex');
  } catch {
    return null;
  }
}

async function waitForDebugPort(file, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const [port] = readFileSync(file, 'utf8').trim().split(/\s+/);
      if (port) return Number(port);
    }
    if (chrome.exitCode !== null) {
      fail(`Chromium exited early (code ${chrome.exitCode}).\n${chromeStderr.slice(-2000)}`);
    }
    await sleep(100);
  }
  fail(`Chromium did not expose a debug port.\n${chromeStderr.slice(-2000)}`);
}

function findChrome(explicit) {
  const candidates = [
    explicit,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (existsSync(c)) return c; } catch {}
  }
  fail('Chromium/Chrome not found. Pass --chrome <path> or set CHROME_BIN.');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key === 'help' || key === 'resume' || key === 'force' || key === 'gpu' || key === 'quiet' || key === 'keep-profile') {
      out[key] = true;
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fail(message) {
  console.error(`\nrender-frames: ${message}`);
  try { ws?.close(); } catch {}
  try { chrome.kill('SIGTERM'); } catch {}
  process.exit(1);
}

main()
  .catch((e) => fail(e?.stack || e?.message || String(e)))
  .finally(async () => {
    try { ws?.close(); } catch {}
    try { chrome.kill('SIGTERM'); } catch {}
    await sleep(300);
    try { chrome.kill('SIGKILL'); } catch {}
    if (!args['keep-profile']) {
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  });
