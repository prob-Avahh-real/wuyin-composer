import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeSong, composeBatch, noteToMidi } from '../src/composer.js';
import { songToMidiBytes, batchToJson } from '../src/midi-export.js';
import { modeDegrees, WUYIN } from '../src/theory.js';

describe('composer', () => {
  it('composeSong is deterministic for seed', () => {
    const a = composeSong({ modeId: 'gong', seed: 42, key: 'D', structure: 'short', index: 0 });
    const b = composeSong({ modeId: 'gong', seed: 42, key: 'D', structure: 'short', index: 0 });
    assert.equal(a.title, b.title);
    assert.equal(a.tempo, b.tempo);
    assert.deepEqual(a.melody.map((n) => n.midi), b.melody.map((n) => n.midi));
  });

  it('melody stays in mode pitch classes', () => {
    const song = composeSong({ modeId: 'yu', seed: 7, key: 'C', structure: 'standard' });
    const allowed = new Set([0, 2, 4, 7, 9]);
    for (const n of song.melody) {
      const pc = ((n.midi - song.gongMidi) % 12 + 12) % 12;
      assert.ok(allowed.has(pc), `unexpected pc ${pc}`);
    }
  });

  it('ends phrases on tonic degree', () => {
    const song = composeSong({ modeId: 'zhi', seed: 99, structure: 'short' });
    const last = song.melody[song.melody.length - 1];
    assert.equal(last.degree, modeDegrees('zhi')[0]);
  });

  it('composeBatch returns N songs', () => {
    const batch = composeBatch({ modeId: 'shang', count: 3, seed: 1 });
    assert.equal(batch.songs.length, 3);
    assert.equal(batch.modeName, WUYIN.shang.name);
    assert.notEqual(batch.songs[0].id, batch.songs[1].id);
  });

  it('noteToMidi matches degree mapping', () => {
    assert.equal(noteToMidi(1, 0, 60), 60);
    assert.equal(noteToMidi(5, 0, 60), 67);
    assert.equal(noteToMidi(6, 1, 60), 60 + 9 + 12);
  });

  it('honors explicit options and safely falls back invalid key or structure', () => {
    const explicit = composeSong({
      modeId: 'jue',
      seed: 9,
      key: 'F',
      tempo: 101,
      structure: 'ballad',
      title: '测试曲',
      index: 4,
    });
    assert.equal(explicit.key, 'F');
    assert.equal(explicit.tempo, 101);
    assert.equal(explicit.title, '测试曲');
    assert.equal(explicit.index, 4);
    assert.equal(explicit.structure, 'ballad');
    assert.equal(explicit.sections.length, 7);

    const fallback = composeSong({ modeId: 'yu', seed: 12, key: 'invalid', structure: 'invalid' });
    assert.equal(fallback.gongMidi, 60);
    assert.deepEqual(fallback.sections, ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro']);
  });

  it('bounds batch count and rejects an unknown mode', () => {
    assert.equal(composeBatch({ modeId: 'gong', count: 0, seed: 1 }).count, 1);
    assert.equal(composeBatch({ modeId: 'gong', count: 100, seed: 1 }).count, 50);
    assert.throws(() => composeSong({ modeId: 'invalid' }), /未知调式/);
  });
});

describe('midi-export', () => {
  it('emits MIDI header', () => {
    const song = composeSong({ modeId: 'gong', seed: 3, structure: 'short' });
    const bytes = songToMidiBytes(song);
    assert.ok(bytes.length > 30);
    assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), 'MThd');
  });

  it('batch JSON parses', () => {
    const batch = composeBatch({ modeId: 'jue', count: 2, seed: 5 });
    const parsed = JSON.parse(batchToJson(batch));
    assert.equal(parsed.songs.length, 2);
  });
});
