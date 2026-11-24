/**
 * A/B 测试 — 对照两组参数，验证可区分的听感/结构差异与可复现性
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeSong, composeBatch } from '../src/composer.js';
import { modeDegrees, degreeToSemitone, WUYIN } from '../src/theory.js';

function pitchClassHist(song) {
  const hist = new Map();
  for (const n of song.melody) {
    const pc = ((n.midi - song.gongMidi) % 12 + 12) % 12;
    hist.set(pc, (hist.get(pc) || 0) + 1);
  }
  return hist;
}

function tonicShare(song) {
  const tonicPc = degreeToSemitone(modeDegrees(song.modeId)[0]);
  const hist = pitchClassHist(song);
  let total = 0;
  let tonic = 0;
  for (const [pc, c] of hist) {
    total += c;
    if (pc === tonicPc) tonic += c;
  }
  return total ? tonic / total : 0;
}

function sectionSet(song) {
  return new Set(song.melody.map((n) => n.section));
}

describe('A/B / mode contrast', () => {
  it('宫 vs 羽：调头不同且旋律音级集合仍为五声', () => {
    const A = composeSong({ modeId: 'gong', seed: 100, key: 'C', structure: 'standard' });
    const B = composeSong({ modeId: 'yu', seed: 100, key: 'C', structure: 'standard' });
    assert.notEqual(modeDegrees(A.modeId)[0], modeDegrees(B.modeId)[0]);
    assert.notDeepEqual(
      A.melody.map((n) => n.degree),
      B.melody.map((n) => n.degree)
    );
    const allowed = new Set([0, 2, 4, 7, 9]);
    for (const song of [A, B]) {
      for (const n of song.melody) {
        const pc = ((n.midi - song.gongMidi) % 12 + 12) % 12;
        assert.ok(allowed.has(pc));
      }
    }
  });

  it('同种子不同调式：调头出现率各自偏向本调', () => {
    const modes = Object.keys(WUYIN);
    for (const modeId of modes) {
      const song = composeSong({ modeId, seed: 4242, key: 'D', structure: 'ballad' });
      assert.ok(tonicShare(song) >= 0.12, `${modeId} tonic share too low`);
    }
  });
});

describe('A/B / structure & tempo', () => {
  it('short vs ballad：段落集合与总拍数可区分', () => {
    const A = composeSong({ modeId: 'zhi', seed: 7, structure: 'short', key: 'G' });
    const B = composeSong({ modeId: 'zhi', seed: 7, structure: 'ballad', key: 'G' });
    assert.ok(B.totalBeats > A.totalBeats);
    assert.ok(sectionSet(B).has('bridge') || B.sections.includes('bridge'));
    assert.ok(!A.sections.includes('bridge'));
  });

  it('tempo A/B：显式速度被尊重且落在合法区间', () => {
    const slow = composeSong({ modeId: 'yu', seed: 1, tempo: 60, structure: 'short' });
    const fast = composeSong({ modeId: 'yu', seed: 1, tempo: 128, structure: 'short' });
    assert.equal(slow.tempo, 60);
    assert.equal(fast.tempo, 128);
    assert.ok(slow.durationSec > fast.durationSec);
  });
});

describe('A/B / reproducibility', () => {
  it('同配置 A=A′，换种子 A≠B', () => {
    const A = composeBatch({ modeId: 'shang', count: 2, seed: 55, key: 'F', structure: 'short' });
    const Ap = composeBatch({ modeId: 'shang', count: 2, seed: 55, key: 'F', structure: 'short' });
    const B = composeBatch({ modeId: 'shang', count: 2, seed: 56, key: 'F', structure: 'short' });
    assert.deepEqual(
      A.songs.map((s) => s.melody.map((n) => n.midi)),
      Ap.songs.map((s) => s.melody.map((n) => n.midi))
    );
    assert.notDeepEqual(
      A.songs[0].melody.map((n) => n.midi),
      B.songs[0].melody.map((n) => n.midi)
    );
  });
});
