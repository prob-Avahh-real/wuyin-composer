/**
 * 五音堂 CLI 核心（可单测）
 */

import fs from 'fs';
import path from 'path';
import { composeBatch } from './composer.js';
import { songToMidiBytes, batchToJson, songToJson } from './midi-export.js';
import { WUYIN } from './theory.js';
import {
  assertSafeFilename,
  assertSafeModeId,
  stripPrototypePollution,
} from './sanitize.js';

/** 确保输出目录落在允许根目录内，阻断路径穿越 */
export function resolveSafeOutDir(outDir, allowedRoot = process.cwd()) {
  const root = path.resolve(allowedRoot);
  const resolved = path.resolve(root, outDir || 'out');
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`输出目录越界: ${outDir}`);
  }
  return resolved;
}

export function parseArgs(argv, defaults = {}) {
  const args = {
    mode: 'gong',
    count: 5,
    out: defaults.out || 'out',
    key: undefined,
    tempo: undefined,
    structure: 'standard',
    seed: undefined,
    midi: false,
    json: true,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--mode' && next) {
      args.mode = next;
      i++;
    } else if (a === '--count' && next) {
      args.count = Number(next);
      i++;
    } else if (a === '--out' && next) {
      args.out = next;
      i++;
    } else if (a === '--key' && next) {
      args.key = next;
      i++;
    } else if (a === '--tempo' && next) {
      args.tempo = Number(next);
      i++;
    } else if (a === '--structure' && next) {
      args.structure = next;
      i++;
    } else if (a === '--seed' && next) {
      args.seed = Number(next);
      i++;
    } else if (a === '--midi') args.midi = true;
    else if (a === '--no-json') args.json = false;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

export function helpText() {
  return `五音堂 CLI

  --mode gong|shang|jue|zhi|yu   调式（默认 gong）
  --count N                      批量数量（默认 5）
  --out DIR                      输出目录（默认 ./out，须在项目根内）
  --key C|D|E|F|G|A|Bb           宫音
  --tempo N                      速度
  --structure short|standard|ballad
  --seed N                       可复现种子
  --midi                         同时写 .mid
  --no-json                      不写批次 JSON
`;
}

/**
 * @param {object} rawArgs parseArgs 结果
 * @param {{ cwd?: string, log?: Function, error?: Function }} [io]
 */
export function runCli(rawArgs, io = {}) {
  const log = io.log || console.log;
  const error = io.error || console.error;
  const cwd = io.cwd || process.cwd();
  const args = stripPrototypePollution(rawArgs);

  if (args.help) {
    log(helpText());
    return { ok: true, help: true };
  }

  try {
    assertSafeModeId(args.mode);
  } catch (e) {
    error(e.message);
    return { ok: false, code: 1, error: e.message };
  }

  if (!WUYIN[args.mode]) {
    error(`未知调式: ${args.mode}`);
    return { ok: false, code: 1, error: `未知调式: ${args.mode}` };
  }

  let outDir;
  try {
    outDir = resolveSafeOutDir(args.out, cwd);
  } catch (e) {
    error(e.message);
    return { ok: false, code: 1, error: e.message };
  }

  const batch = composeBatch({
    modeId: args.mode,
    count: args.count,
    key: args.key,
    tempo: args.tempo,
    structure: args.structure,
    seed: args.seed,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const batchName = assertSafeFilename(`wuyin-${batch.modeId}-${batch.baseSeed}`);
  const written = [];

  if (args.json !== false) {
    const batchPath = path.join(outDir, `${batchName}.json`);
    fs.writeFileSync(batchPath, batchToJson(batch));
    written.push(batchPath);
    log('batch →', batchPath);
    for (const song of batch.songs) {
      const id = assertSafeFilename(song.id);
      const p = path.join(outDir, `${id}.json`);
      fs.writeFileSync(p, songToJson(song));
      written.push(p);
    }
  }

  if (args.midi) {
    for (const song of batch.songs) {
      const id = assertSafeFilename(song.id);
      const midPath = path.join(outDir, `${id}.mid`);
      fs.writeFileSync(midPath, songToMidiBytes(song));
      written.push(midPath);
      log('midi  →', midPath);
    }
  }

  log(`✓ ${batch.count} 首${batch.modeName}调 → ${outDir}`);
  return { ok: true, outDir, batch, written };
}
