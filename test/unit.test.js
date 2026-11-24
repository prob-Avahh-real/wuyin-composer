/**
 * 单元测试 — 乐理 / 作曲 / 导出 / 消毒的原子行为
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WUYIN,
  modeDegrees,
  degreeToSemitone,
  tonicMidi,
  droneDegrees,
  getMode,
  listModes,
  THEORY_ARTICLES,
} from '../src/theory.js';
import { composeSong, composeBatch, noteToMidi, STRUCTURES } from '../src/composer.js';
import { songToMidiBytes, songToJson, batchToJson } from '../src/midi-export.js';
import {
  escapeHtml,
  clampMidi,
  slugifyIdPart,
  assertSafeModeId,
  assertSafeFilename,
  stripPrototypePollution,
} from '../src/sanitize.js';
import { parseArgs, helpText, resolveSafeOutDir } from '../src/cli.js';

describe('unit / theory', () => {
  it('exposes five modes and articles', () => {
    assert.equal(listModes().length, 5);
    assert.ok(THEORY_ARTICLES.length >= 4);
    assert.equal(getMode('yu').name, '羽');
  });

  it('maps degrees and drones', () => {
    assert.equal(degreeToSemitone(5), 7);
    assert.equal(tonicMidi('shang', 60), 62);
    assert.deepEqual(droneDegrees('gong'), [1, 5]);
    assert.deepEqual(modeDegrees('zhi')[0], 5);
  });
});

describe('unit / composer', () => {
  it('builds a short song with required fields', () => {
    const song = composeSong({ modeId: 'gong', seed: 1, key: 'C', structure: 'short' });
    assert.equal(song.modeId, 'gong');
    assert.ok(song.melody.length > 0);
    assert.ok(song.drones.length === 2);
    assert.ok(song.durationSec > 0);
    assert.ok(Object.keys(STRUCTURES).includes(song.structure));
  });

  it('noteToMidi is linear in octave', () => {
    assert.equal(noteToMidi(1, 1, 60) - noteToMidi(1, 0, 60), 12);
  });
});

describe('unit / midi-export', () => {
  it('MIDI begins with MThd and JSON round-trips', () => {
    const song = composeSong({ modeId: 'jue', seed: 2, structure: 'short' });
    const bytes = songToMidiBytes(song);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd');
    assert.equal(JSON.parse(songToJson(song)).id, song.id);
    assert.equal(JSON.parse(batchToJson(composeBatch({ modeId: 'jue', count: 1, seed: 2 }))).count, 1);
  });
});

describe('unit / sanitize', () => {
  it('escapes HTML and clamps MIDI', () => {
    assert.equal(escapeHtml('<img onerror=1>'), '&lt;img onerror=1&gt;');
    assert.equal(clampMidi(200), 127);
    assert.equal(clampMidi(-3), 0);
    assert.equal(clampMidi(NaN), 60);
    assert.match(slugifyIdPart('hello world!!'), /^hello-world$/);
    assert.equal(slugifyIdPart('@@@'), 'song');
    assert.equal(assertSafeModeId('yu'), 'yu');
    assert.equal(assertSafeFilename('wuyin-gong-1-0'), 'wuyin-gong-1-0');
  });

  it('strips prototype pollution keys', () => {
    const dirty = JSON.parse('{"modeId":"gong","__proto__":{"polluted":true}}');
    const clean = stripPrototypePollution(dirty);
    assert.equal(clean.modeId, 'gong');
    assert.equal(Object.prototype.polluted, undefined);
    assert.ok(!Object.prototype.hasOwnProperty.call(clean, '__proto__'));
  });
});

describe('unit / cli parse', () => {
  it('parses flags and resolves in-root out dir', () => {
    const args = parseArgs(['--mode', 'yu', '--count', '3', '--midi', '--seed', '9']);
    assert.equal(args.mode, 'yu');
    assert.equal(args.count, 3);
    assert.equal(args.midi, true);
    assert.equal(args.seed, 9);
    assert.match(helpText(), /五音堂 CLI/);
    const cwd = process.cwd();
    assert.ok(resolveSafeOutDir('out/tmp', cwd).startsWith(cwd));
  });
});
