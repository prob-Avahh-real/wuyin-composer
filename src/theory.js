/**
 * 五声音阶乐理 — 宫商角徵羽
 *
 * 正声音阶（相对音级，以宫为 1）：
 *   宫=1  商=2  角=3  徵=5  羽=6
 * 五种调式以对应音为调头（主音），主旋律围绕调头展开。
 */

export const WUYIN = Object.freeze({
  gong: {
    id: 'gong',
    name: '宫',
    degree: 1,
    color: '#c9a227',
    mood: '庄重平稳',
    season: '土 · 中',
    description: '宫调以宫音为调头，旋律沉稳开阔，宜庄严、叙事、颂歌。',
    tip: '多落宫、徵；少跳角→商大跳，避免漂浮感。',
  },
  shang: {
    id: 'shang',
    name: '商',
    degree: 2,
    color: '#b85c38',
    mood: '清商萧瑟',
    season: '金 · 秋',
    description: '商调以商音为调头，带秋意与离情，宜抒情、怀古。',
    tip: '句末常落商或羽；下行级进强化悲秋感。',
  },
  jue: {
    id: 'jue',
    name: '角',
    degree: 3,
    color: '#3d8b6e',
    mood: '清角柔和',
    season: '木 · 春',
    description: '角调以角音为调头，柔婉生发，宜春意、山水、小令。',
    tip: '多用角→徵、角→羽；起句宜轻，收句可回角。',
  },
  zhi: {
    id: 'zhi',
    name: '徵',
    degree: 5,
    color: '#d45a3a',
    mood: '徵音明亮',
    season: '火 · 夏',
    description: '徵调以徵音为调头，明亮开扬，宜欢庆、行进、民谣。',
    tip: '主旋律多停徵；宫→徵、徵→宫形成骨干呼应。',
  },
  yu: {
    id: 'yu',
    name: '羽',
    degree: 6,
    color: '#5b7c99',
    mood: '羽调幽远',
    season: '水 · 冬',
    description: '羽调以羽音为调头，幽静绵长，宜夜思、咏叹、慢板。',
    tip: '句末落羽；徵→羽、宫→羽制造悬念与归宿感。',
  },
});

/** 相对半音：宫系五声在十二平均律上的映射（宫=0） */
export const GONG_SEMITONES = Object.freeze([0, 2, 4, 7, 9]); // 1 2 3 5 6

/** 音级名（相对宫） */
export const DEGREE_NAMES = Object.freeze({
  1: '宫',
  2: '商',
  3: '角',
  5: '徵',
  6: '羽',
});

export const DEGREE_ORDER = Object.freeze([1, 2, 3, 5, 6]);

/** 常用宫音绝对音高（MIDI） */
export const KEY_ROOTS = Object.freeze({
  C: 60,
  D: 62,
  E: 64,
  F: 65,
  G: 67,
  A: 69,
  Bb: 70,
});

/**
 * 给定调式，返回相对宫的音级序列（调头在首位，再环绕一圈）
 * e.g. 商调 → [2,3,5,6,1]
 */
export function modeDegrees(modeId) {
  const mode = WUYIN[modeId];
  if (!mode) throw new Error(`未知调式: ${modeId}`);
  const start = DEGREE_ORDER.indexOf(mode.degree);
  return [...DEGREE_ORDER.slice(start), ...DEGREE_ORDER.slice(0, start)];
}

/** 音级 → 相对宫的半音 */
export function degreeToSemitone(degree) {
  const i = DEGREE_ORDER.indexOf(degree);
  if (i < 0) throw new Error(`非法音级: ${degree}`);
  return GONG_SEMITONES[i];
}

/**
 * 调式音阶的 MIDI 音高（若干八度）
 * @param {string} modeId
 * @param {number} gongMidi 宫音 MIDI
 * @param {number} octaves
 */
export function modeScaleMidi(modeId, gongMidi = 60, octaves = 2) {
  const degrees = modeDegrees(modeId);
  const notes = [];
  for (let o = 0; o < octaves; o++) {
    for (const d of degrees) {
      notes.push(gongMidi + degreeToSemitone(d) + o * 12);
    }
  }
  // 再加一个高八度调头，便于收束
  notes.push(gongMidi + degreeToSemitone(degrees[0]) + octaves * 12);
  return notes;
}

/** 调头（主音）MIDI */
export function tonicMidi(modeId, gongMidi = 60) {
  return gongMidi + degreeToSemitone(WUYIN[modeId].degree);
}

/**
 * 简单和弦暗示：五声常用双音/三音骨架（宫徵、羽角等）
 * 返回相对宫的音级数组
 */
export function droneDegrees(modeId) {
  const mode = WUYIN[modeId];
  switch (mode.id) {
    case 'gong':
      return [1, 5];
    case 'shang':
      return [2, 6];
    case 'jue':
      return [3, 6];
    case 'zhi':
      return [5, 1];
    case 'yu':
      return [6, 3];
    default:
      return [1, 5];
  }
}

/** 乐理词条（供界面「知识」页） */
export const THEORY_ARTICLES = Object.freeze([
  {
    title: '什么是五音？',
    body: '中国传统乐学以宫、商、角、徵、羽为五个正声，对应相对音级 1、2、3、5、6，不含半音，形成五声音阶。以其中某一音为调头（主音），便构成五种调式。',
  },
  {
    title: '调头与主旋律',
    body: '「以某音为主旋律」即选定调式：旋律起承转合多围绕该调头，句末常落调头或其骨干音（如宫调落宫/徵）。本应用批量创作时，会强制调头权重，保证听感归属清晰。',
  },
  {
    title: '五声与情绪',
    body: '宫土中正、商金秋肃、角木春柔、徵火夏明、羽水冬幽——古人以五行配五音。创作时可先选情绪，再选对应调式，批量变体只改节奏与动机，不改调式归属。',
  },
  {
    title: '宫音与移调',
    body: '「宫」是相对概念：选定绝对宫音（如 C、D、G）后，五声位置随之平移。同一商调移到不同宫音上，色彩相似而音区不同。',
  },
]);

export function listModes() {
  return Object.values(WUYIN);
}

export function getMode(id) {
  return WUYIN[id] || null;
}
