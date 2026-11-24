import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WUYIN,
  modeDegrees,
  degreeToSemitone,
  modeScaleMidi,
  tonicMidi,
  droneDegrees,
  getMode,
  listModes,
} from '../src/theory.js';

describe('theory', () => {
  it('lists five modes', () => {
    assert.equal(listModes().length, 5);
    assert.ok(WUYIN.gong && WUYIN.yu);
  });

  it('modeDegrees starts with tonic degree', () => {
    assert.deepEqual(modeDegrees('gong')[0], 1);
    assert.deepEqual(modeDegrees('shang')[0], 2);
    assert.deepEqual(modeDegrees('jue')[0], 3);
    assert.deepEqual(modeDegrees('zhi')[0], 5);
    assert.deepEqual(modeDegrees('yu')[0], 6);
  });

  it('maps degrees to pentatonic semitones', () => {
    assert.equal(degreeToSemitone(1), 0);
    assert.equal(degreeToSemitone(2), 2);
    assert.equal(degreeToSemitone(3), 4);
    assert.equal(degreeToSemitone(5), 7);
    assert.equal(degreeToSemitone(6), 9);
  });

  it('tonicMidi respects mode and gong', () => {
    assert.equal(tonicMidi('gong', 60), 60);
    assert.equal(tonicMidi('zhi', 60), 67);
    assert.equal(tonicMidi('yu', 62), 62 + 9);
  });

  it('modeScaleMidi only uses gong-system pitch classes', () => {
    const scale = modeScaleMidi('shang', 60, 1);
    const pcs = new Set(scale.map((m) => ((m - 60) % 12 + 12) % 12));
    for (const pc of pcs) {
      assert.ok([0, 2, 4, 7, 9].includes(pc));
    }
  });

  it('droneDegrees returns two backbone tones', () => {
    for (const id of Object.keys(WUYIN)) {
      assert.equal(droneDegrees(id).length, 2);
    }
  });

  it('rejects invalid mode and degree identifiers', () => {
    assert.throws(() => modeDegrees('invalid'), /未知调式/);
    assert.throws(() => degreeToSemitone(4), /非法音级/);
    assert.equal(getMode('gong'), WUYIN.gong);
    assert.equal(getMode('invalid'), null);
  });
});
