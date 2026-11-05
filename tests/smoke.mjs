#!/usr/bin/env node
/**
 * director / smoke test
 * Renders the 5-second demo, muxes a generated tone, runs QA, and builds a
 * contact sheet. Requires Node >= 22, Chromium, ffmpeg, and (optionally)
 * Pillow for the sheet.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'tests', '.tmp');
const FRAMES = path.join(TMP, 'frames');
const AUDIO = path.join(TMP, 'tone.m4a');
const VIDEO = path.join(TMP, 'demo.mp4');
const SHEET = path.join(TMP, 'contact-sheet.jpg');
const DEMO = path.join(ROOT, 'assets', 'demo', 'index.html');
const PYTHON = process.env.PYTHON || 'python3';

function run(cmd, args, label) {
  console.log(`\n> ${label || [cmd, ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
  if (r.error) fail(`${label || cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`${label || cmd} exited with code ${r.status}`);
}

function capture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT });
}

function fail(message) {
  console.error(`\nSMOKE FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function tool(cmd, args = ['-version']) {
  const r = capture(cmd, args);
  return !r.error && r.status === 0;
}

if (!existsSync(DEMO)) fail(`demo not found: ${DEMO}`);
if (!tool('ffmpeg') || !tool('ffprobe')) fail('ffmpeg/ffprobe not found in PATH');
if (!tool('node', ['--version'])) fail('node not found');
if (!existsSync(path.join(ROOT, 'scripts', 'render-frames.mjs'))) fail('renderer not found');

if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

// 1. Generated 5-second tone. No binary fixture needed.
run('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5:sample_rate=44100',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', AUDIO,
], 'generate 5s test tone');

// 2. Render the demo.
run('node', [
  path.join(ROOT, 'scripts', 'render-frames.mjs'),
  '--url', `file://${DEMO}`,
  '--out', FRAMES,
  '--width', '1080', '--height', '1920',
  '--fps', '24', '--duration', '5',
  '--hide', '#ui',
  '--quiet',
], 'render 5s demo');

const frames = readdirSync(FRAMES).filter((f) => /^f\d{5}\.png$/.test(f));
assert(frames.length === 120, `expected 120 frames, got ${frames.length}`);

const infoPath = path.join(FRAMES, 'render-info.json');
assert(existsSync(infoPath), 'render-info.json missing');
const info = JSON.parse(readFileSync(infoPath, 'utf8'));
assert(info.width === 1080 && info.height === 1920, 'render-info dimensions wrong');
assert(info.fps === 24 && info.duration === 5, 'render-info timing wrong');

// 3. Mux.
run('ffmpeg', [
  '-y', '-v', 'error',
  '-framerate', '24', '-start_number', '0',
  '-i', path.join(FRAMES, 'f%05d.png'),
  '-i', AUDIO,
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
  '-shortest', '-movflags', '+faststart', VIDEO,
], 'mux demo');

assert(existsSync(VIDEO) && statSync(VIDEO).size > 10000, 'muxed video missing or too small');

// 4. Structural QA.
run('node', [
  path.join(ROOT, 'scripts', 'qa-video.mjs'),
  VIDEO,
  '--width', '1080', '--height', '1920',
  '--fps', '24', '--duration', '5',
], 'qa video');

// 5. Contact sheet (optional if Pillow is unavailable).
const pillow = capture(PYTHON, ['-c', 'import PIL; print(PIL.__version__)']);
if (pillow.status === 0) {
  run(PYTHON, [
    path.join(ROOT, 'scripts', 'contact-sheet.py'),
    path.join(FRAMES, 'f00000.png'),
    path.join(FRAMES, 'f00024.png'),
    path.join(FRAMES, 'f00048.png'),
    path.join(FRAMES, 'f00072.png'),
    path.join(FRAMES, 'f00096.png'),
    path.join(FRAMES, 'f00119.png'),
    '--out', SHEET, '--cols', '3', '--width', '270', '--fps', '24',
  ], 'contact sheet');
  const sheetKb = statSync(SHEET).size / 1024;
  assert(sheetKb < 800, `contact sheet too large: ${sheetKb.toFixed(0)} KB`);
} else {
  console.log('\nWARN: Pillow not available; skipping contact-sheet assertion.');
}

// 6. Media budget sanity check.
run('node', [
  path.join(ROOT, 'scripts', 'media-budget.mjs'),
  existsSync(SHEET) ? SHEET : VIDEO,
], 'media budget');

console.log('\nSMOKE PASS');
console.log(`  frames: ${frames.length}`);
console.log(`  video:  ${(statSync(VIDEO).size / 1048576).toFixed(2)} MB`);
if (existsSync(SHEET)) console.log(`  sheet:  ${(statSync(SHEET).size / 1024).toFixed(0)} KB`);
