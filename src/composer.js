/**
 * 五音调式批量作曲引擎
 * 以宫/商/角/徵/羽之一为调头，生成带结构的歌曲。
 */

import {
  WUYIN,
  DEGREE_ORDER,
  modeDegrees,
  degreeToSemitone,
  tonicMidi,
  droneDegrees,
  KEY_ROOTS,
} from './theory.js';
import { slugifyIdPart, stripPrototypePollution } from './sanitize.js';

const STRUCTURES = {
  short: ['intro', 'verse', 'chorus', 'outro'],
  standard: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'],
  ballad: ['intro', 'verse', 'verse', 'chorus', 'bridge', 'chorus', 'outro'],
};

const SECTION_BARS = {
  intro: 2,
  verse: 4,
  chorus: 4,
  bridge: 2,
  outro: 2,
};

const RHYTHM_PATTERNS = [
  [1, 0.5, 0.5, 1, 1],
  [0.5, 0.5, 1, 0.5, 0.5, 1],
  [1, 1, 0.5, 0.5, 1],
  [1.5, 0.5, 1, 1],
  [0.75, 0.25, 0.5, 0.5, 1, 1],
  [1, 0.5, 1.5, 1],
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** 调式权重：调头与骨干音更常出现 */
function weightedDegrees(modeId, rand, preferTonic = false) {
  const degrees = modeDegrees(modeId);
  const tonic = degrees[0];
  const drone = droneDegrees(modeId);
  const pool = [];
  for (const d of degrees) {
    let w = 2;
    if (d === tonic) w = preferTonic ? 8 : 5;
    else if (drone.includes(d)) w = 4;
    for (let i = 0; i < w; i++) pool.push(d);
  }
  return pick(rand, pool);
}

function contourStep(modeId, prevDegree, rand, section) {
  const degrees = modeDegrees(modeId);
  const idx = degrees.indexOf(prevDegree);
  if (idx < 0) return weightedDegrees(modeId, rand);

  // 收束段更倾向级进回调头
  if (section === 'outro' || section === 'chorus') {
    if (rand() < 0.45) return degrees[0];
  }

  const move = rand();
  if (move < 0.45) {
    // 级进
    const dir = rand() < 0.55 ? 1 : -1;
    return degrees[clamp(idx + dir, 0, degrees.length - 1)];
  }
  if (move < 0.7) {
    // 同音或邻音
    return rand() < 0.5 ? prevDegree : degrees[clamp(idx + (rand() < 0.5 ? 1 : -1), 0, degrees.length - 1)];
  }
  // 跳进（仍在五声内）
  return weightedDegrees(modeId, rand, section === 'chorus');
}

function phraseForSection(modeId, section, bars, rand, octaveBase) {
  const notes = [];
  const pattern = pick(rand, RHYTHM_PATTERNS);
  let beat = 0;
  const totalBeats = bars * 4;
  let degree = modeDegrees(modeId)[0];
  let octave = octaveBase;
  let patternIdx = 0;

  while (beat < totalBeats - 0.01) {
    const dur = pattern[patternIdx % pattern.length];
    patternIdx++;
    const remaining = totalBeats - beat;
    const noteDur = Math.min(dur, remaining);
    if (noteDur <= 0) break;

    const isCadence = beat + noteDur >= totalBeats - 0.5;
    degree = isCadence
      ? weightedDegrees(modeId, rand, true)
      : contourStep(modeId, degree, rand, section);

    // 八度微移，避免单调
    if (rand() < 0.12) octave += rand() < 0.5 ? -1 : 1;
    octave = clamp(octave, octaveBase - 1, octaveBase + 1);

    notes.push({
      degree,
      octave,
      beat,
      duration: noteDur,
      section,
    });
    beat += noteDur;
  }

  // 强制末音为调头
  if (notes.length) {
    notes[notes.length - 1].degree = modeDegrees(modeId)[0];
  }
  return notes;
}

function titleFor(modeId, seed, index) {
  const mode = WUYIN[modeId];
  const prefixes = ['清', '远', '素', '玄', '流', '静', '明', '秋', '春', '夜'];
  const nouns = ['调', '吟', '歌', '曲', '声', '韵', '章', '令', '行', '赋'];
  const r = mulberry32(seed + index * 97);
  return `${pick(r, prefixes)}${mode.name}${pick(r, nouns)} · ${String(index + 1).padStart(2, '0')}`;
}

/**
 * 将相对宫的 degree+octave 转为 MIDI
 */
export function noteToMidi(degree, octave, gongMidi) {
  return gongMidi + degreeToSemitone(degree) + octave * 12;
}

/**
 * 生成单首歌曲
 * @param {object} opts
 * @param {string} opts.modeId - gong|shang|jue|zhi|yu
 * @param {number} [opts.seed]
 * @param {string} [opts.key] - C|D|E|F|G|A|Bb
 * @param {number} [opts.tempo]
 * @param {string} [opts.structure] - short|standard|ballad
 * @param {number} [opts.index] - 批量中的序号
 */
export function composeSong(rawOpts = {}) {
  const opts = stripPrototypePollution(rawOpts);
  const modeId = opts.modeId || 'gong';
  if (!WUYIN[modeId]) throw new Error(`未知调式: ${modeId}`);

  const seed = Number.isFinite(Number(opts.seed))
    ? Number(opts.seed) >>> 0
    : Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const key = opts.key || pick(rand, Object.keys(KEY_ROOTS));
  const gongMidi = KEY_ROOTS[key] ?? 60;
  const structureName = opts.structure || pick(rand, Object.keys(STRUCTURES));
  const sections = STRUCTURES[structureName] || STRUCTURES.standard;
  const tempoBase = {
    gong: 88,
    shang: 76,
    jue: 92,
    zhi: 108,
    yu: 72,
  }[modeId];
  const tempoOpt = Number(opts.tempo);
  const tempo = Number.isFinite(tempoOpt)
    ? clamp(Math.round(tempoOpt), 60, 128)
    : clamp(Math.round(tempoBase + (rand() - 0.5) * 24), 60, 128);
  const index = Number.isFinite(Number(opts.index)) ? Math.max(0, Math.floor(Number(opts.index))) : 0;
  const octaveBase = 0;

  const melody = [];
  let barOffset = 0;
  for (const section of sections) {
    const bars = SECTION_BARS[section] || 2;
    const phrase = phraseForSection(modeId, section, bars, rand, octaveBase);
    for (const n of phrase) {
      melody.push({
        ...n,
        beat: n.beat + barOffset * 4,
        midi: noteToMidi(n.degree, n.octave, gongMidi),
      });
    }
    barOffset += bars;
  }

  const drones = droneDegrees(modeId).map((d) => ({
    degree: d,
    midi: noteToMidi(d, -1, gongMidi),
  }));

  const totalBeats = barOffset * 4;
  const durationSec = (totalBeats / tempo) * 60;

  const title = opts.title ? String(opts.title).slice(0, 80) : titleFor(modeId, seed, index);
  const id = `wuyin-${slugifyIdPart(modeId)}-${seed}-${index}`;

  return {
    id,
    title,
    modeId,
    modeName: WUYIN[modeId].name,
    mood: WUYIN[modeId].mood,
    key,
    gongMidi,
    tempo,
    structure: structureName,
    sections,
    seed,
    index,
    totalBeats,
    durationSec: Math.round(durationSec * 10) / 10,
    drones,
    melody,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 批量创作
 * @param {object} opts
 * @param {string} opts.modeId
 * @param {number} [opts.count=5]
 * @param {number} [opts.seed]
 * @param {string} [opts.key]
 * @param {number} [opts.tempo]
 * @param {string} [opts.structure]
 */
export function composeBatch(rawOpts = {}) {
  const opts = stripPrototypePollution(rawOpts);
  const countRaw = Number(opts.count);
  const count = clamp(Number.isFinite(countRaw) ? countRaw : 5, 1, 50);
  const seedRaw = Number(opts.seed);
  const baseSeed = Number.isFinite(seedRaw) ? seedRaw >>> 0 : Math.floor(Math.random() * 1e9);
  const songs = [];
  for (let i = 0; i < count; i++) {
    songs.push(
      composeSong({
        ...opts,
        seed: (baseSeed + i * 10007) >>> 0,
        index: i,
      })
    );
  }
  const modeId = opts.modeId || 'gong';
  return {
    modeId,
    modeName: WUYIN[modeId].name,
    count: songs.length,
    baseSeed,
    songs,
  };
}

export { STRUCTURES, SECTION_BARS };
