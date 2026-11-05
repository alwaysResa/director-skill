#!/usr/bin/env node
/**
 * director / qa-video.mjs
 * Structural, decode, and loudness QA for a finished video.
 *
 * Usage:
 *   node scripts/qa-video.mjs demo.mp4 \
 *     --width 1080 --height 1920 --fps 24 --duration 5
 *
 * Exit code 1 on structural failure. Loudness outside the target is a warning
 * unless --strict is used.
 */

import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file || args.help) {
  console.log(`director QA

Usage:
  node scripts/qa-video.mjs <video> [options]

Options:
  --width <px>        expected width
  --height <px>       expected height
  --fps <n>           expected frame rate (default 24)
  --duration <sec>    expected duration
  --tolerance <sec>   duration tolerance (default 0.2)
  --loudness <LUFS>   target integrated loudness (default -16)
  --strict            make loudness warnings fail
  --json              machine-readable output
  --help              show this help
`);
  process.exit(file ? 0 : 1);
}

if (!existsSync(file)) fail(`File not found: ${file}`);

const expected = {
  width: args.width ? Number(args.width) : null,
  height: args.height ? Number(args.height) : null,
  fps: Number(args.fps || 24),
  duration: args.duration ? Number(args.duration) : null,
  tolerance: Number(args.tolerance || 0.2),
  loudness: Number(args.loudness || -16),
  strict: Boolean(args.strict),
};

const rows = [];
const add = (name, status, detail) => rows.push({ name, status, detail });
const mark = (status) => ({ pass: 'PASS', warn: 'WARN', fail: 'FAIL' }[status] || status);

function probe() {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file,
  ], { encoding: 'utf8' });
  if (r.error) fail(`ffprobe not available: ${r.error.message}`);
  if (r.status !== 0) fail(`ffprobe failed:\n${r.stderr}`);
  return JSON.parse(r.stdout);
}

const info = probe();
const format = info.format || {};
const streams = info.streams || [];
const video = streams.find((s) => s.codec_type === 'video');
const audio = streams.find((s) => s.codec_type === 'audio');

if (!video) {
  add('video stream', 'fail', 'no video stream found');
} else {
  add('video codec', video.codec_name === 'h264' ? 'pass' : 'warn', video.codec_name || 'unknown');
  if (expected.width) add('width', Number(video.width) === expected.width ? 'pass' : 'fail', `${video.width} (expected ${expected.width})`);
  if (expected.height) add('height', Number(video.height) === expected.height ? 'pass' : 'fail', `${video.height} (expected ${expected.height})`);
  const fps = parseRate(video.r_frame_rate);
  add('fps', Math.abs(fps - expected.fps) < 0.01 ? 'pass' : 'fail', `${fps} (expected ${expected.fps})`);
  add('pixel format', video.pix_fmt === 'yuv420p' ? 'pass' : 'warn', video.pix_fmt || 'unknown');
  if (video.nb_frames && Number(video.nb_frames) > 0) {
    const expectedFrames = expected.duration ? Math.round(expected.duration * expected.fps) : null;
    if (expectedFrames) {
      const diff = Math.abs(Number(video.nb_frames) - expectedFrames);
      add('frame count', diff <= 2 ? 'pass' : 'warn', `${video.nb_frames} (expected ~${expectedFrames})`);
    } else {
      add('frame count', 'pass', String(video.nb_frames));
    }
  }
}

if (!audio) {
  add('audio stream', 'warn', 'no audio stream (silent video?)');
} else {
  add('audio codec', audio.codec_name === 'aac' ? 'pass' : 'warn', audio.codec_name || 'unknown');
  add('audio sample rate', Number(audio.sample_rate) >= 44100 ? 'pass' : 'warn', `${audio.sample_rate} Hz`);
}

const duration = Number(format.duration);
if (expected.duration) {
  const diff = Math.abs(duration - expected.duration);
  add('duration', diff <= expected.tolerance ? 'pass' : 'fail', `${duration.toFixed(3)}s (expected ${expected.duration}s, diff ${diff.toFixed(3)}s)`);
} else {
  add('duration', 'pass', `${duration.toFixed(3)}s`);
}

add('file size', 'pass', `${(statSync(file).size / 1048576).toFixed(2)} MB`);

const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
if (decode.error) {
  add('full decode', 'fail', decode.error.message);
} else if (decode.status !== 0 || decode.stderr.trim()) {
  add('full decode', 'fail', decode.stderr.trim().slice(-800) || `ffmpeg exited ${decode.status}`);
} else {
  add('full decode', 'pass', 'no decode errors');
}

const loud = loudness(file);
if (loud) {
  const i = Number(loud.input_i);
  const tp = Number(loud.input_tp);
  const target = expected.loudness;
  const diff = Math.abs(i - target);
  add('integrated loudness', diff <= 2 ? 'pass' : 'warn', `${i} LUFS (target ${target} ±2)`);
  add('true peak', tp <= -1.0 ? 'pass' : 'warn', `${tp} dBTP (target <= -1.0)`);
  if (loud.input_lra) add('loudness range', 'pass', `${loud.input_lra} LU`);
} else {
  add('loudness', 'warn', 'could not measure');
}

const failed = rows.filter((r) => r.status === 'fail');
const warned = rows.filter((r) => r.status === 'warn');
if (expected.strict && warned.length) failed.push(...warned);

if (args.json) {
  console.log(JSON.stringify({ file, rows, failed: failed.length, warnings: warned.length }, null, 2));
} else {
  console.log(`QA: ${file}\n`);
  for (const r of rows) {
    console.log(`  ${mark(r.status).padEnd(4)}  ${r.name.padEnd(20)} ${r.detail}`);
  }
  console.log(`\n${failed.length ? 'FAIL' : 'PASS'}: ${failed.length} fail, ${warned.length} warning`);
}

process.exit(failed.length ? 1 : 0);

function loudness(f) {
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-i', f,
    '-af', 'loudnorm=print_format=json',
    '-f', 'null', '-',
  ], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const matches = [...r.stderr.matchAll(/\{[\s\S]*?\}/g)];
  if (!matches.length) return null;
  try { return JSON.parse(matches[matches.length - 1][0]); } catch { return null; }
}

function parseRate(rate) {
  if (!rate) return 0;
  const [a, b] = String(rate).split('/').map(Number);
  return b ? a / b : a;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (key === 'strict' || key === 'json' || key === 'help') out[key] = true;
    else { out[key] = argv[i + 1]; i++; }
  }
  return out;
}

function fail(message) {
  console.error(`qa-video: ${message}`);
  process.exit(1);
}
