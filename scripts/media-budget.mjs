#!/usr/bin/env node
/**
 * director / media-budget.mjs
 * Estimate how many bytes a batch of files will add when inlined into a model
 * request (base64), and warn before the gateway's 32 MiB limit is reached.
 *
 * Usage:
 *   node scripts/media-budget.mjs review/*.jpg
 *   node scripts/media-budget.mjs --json frames/*.png
 *
 * This only measures the new batch. The conversation's earlier images are also
 * sent again on every step, so keep the batch small even when this says OK.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const LIMIT = 32 * 1024 * 1024;
const WARN = 24 * 1024 * 1024;
const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));

if (!files.length) {
  console.error(`Usage: node scripts/media-budget.mjs [--json] <files...>

The model gateway rejects a request when total inlined media exceeds
33,554,432 bytes (32 MiB). Base64 adds ~33%; earlier images are re-sent
on every step. Review with small JPEGs and a single contact sheet.`);
  process.exit(1);
}

let raw = 0;
const rows = [];
for (const f of files) {
  if (!existsSync(f)) {
    rows.push({ file: f, raw: 0, base64: 0, missing: true });
    continue;
  }
  const size = statSync(f).size;
  const b64 = 4 * Math.ceil(size / 3);
  raw += size;
  rows.push({ file: f, raw: size, base64: b64 });
}
const totalB64 = rows.reduce((n, r) => n + r.base64, 0);
const totalRaw = raw;

if (json) {
  console.log(JSON.stringify({
    files: rows,
    rawBytes: totalRaw,
    base64Bytes: totalB64,
    limitBytes: LIMIT,
    warnBytes: WARN,
    verdict: totalB64 >= LIMIT ? 'FAIL' : totalB64 >= WARN ? 'WARN' : 'OK',
  }, null, 2));
} else {
  for (const r of rows) {
    if (r.missing) {
      console.log(`MISSING  ${r.file}`);
      continue;
    }
    console.log(`${(r.base64 / 1048576).toFixed(2).padStart(7)} MB b64  ${(r.raw / 1024).toFixed(0).padStart(6)} KB  ${path.basename(r.file)}`);
  }
  console.log(`\ntotal: ${(totalRaw / 1048576).toFixed(2)} MB raw -> ${(totalB64 / 1048576).toFixed(2)} MB inlined (base64)`);
  console.log(`limit: 32.00 MiB / 33,554,432 bytes`);
  if (totalB64 >= LIMIT) {
    console.log('verdict: FAIL — do not send this batch. Use a contact sheet or smaller JPEGs.');
    process.exitCode = 1;
  } else if (totalB64 >= WARN) {
    console.log('verdict: WARN — close to the limit; split the batch and remember prior images count too.');
  } else {
    console.log('verdict: OK for this batch — but keep it <= 4-6 images per message.');
  }
}
