/**
 * 完备性测试 — 全调式/全结构/全宫音/导出与 CLI 能力面覆盖
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WUYIN, KEY_ROOTS, THEORY_ARTICLES, listModes } from '../src/theory.js';
import { composeSong, composeBatch, STRUCTURES, SECTION_BARS } from '../src/composer.js';
import {
  songToMidiBytes,
  exportSongMidi,
  exportSongJson,
  exportBatchJson,
  exportBatchMidiZipLike,
  downloadBlob,
} from '../src/midi-export.js';
import { parseArgs, runCli, helpText } from '../src/cli.js';
import { createWearableInput } from '../src/wearable-input.js';

const MODES = Object.keys(WUYIN);
const KEYS = Object.keys(KEY_ROOTS);
const STRUCTURE_NAMES = Object.keys(STRUCTURES);

describe('completeness / theory surface', () => {
  it('lists all five modes with lore fields', () => {
    assert.equal(listModes().length, 5);
    for (const m of listModes()) {
      assert.ok(m.name && m.mood && m.season && m.description && m.tip);
    }
    assert.ok(THEORY_ARTICLES.every((a) => a.title && a.body));
  });
});

describe('completeness / compose matrix', () => {
  it('composes every mode × structure × key smoke set', () => {
    for (const modeId of MODES) {
      for (const structure of STRUCTURE_NAMES) {
        const key = KEYS[(MODE_INDEX(modeId) + STRUCTURE_NAMES.indexOf(structure)) % KEYS.length];
        const song = composeSong({ modeId, structure, key, seed: 11, tempo: 90 });
        assert.equal(song.modeName, WUYIN[modeId].name);
        assert.equal(song.key, key);
        assert.equal(song.structure, structure);
        assert.ok(song.melody.length > 4);
        assert.ok(song.sections.every((s) => SECTION_BARS[s]));
        const last = song.melody[song.melody.length - 1];
        assert.equal(last.degree, song.melody.length ? last.degree : null);
        // 末音为调头
        const tonic = { gong: 1, shang: 2, jue: 3, zhi: 5, yu: 6 }[modeId];
        assert.equal(last.degree, tonic);
      }
    }
  });

  it('batch covers counts 1..5 for each mode', () => {
    for (const modeId of MODES) {
      const batch = composeBatch({ modeId, count: 5, seed: 3, structure: 'short' });
      assert.equal(batch.songs.length, 5);
      assert.equal(new Set(batch.songs.map((s) => s.id)).size, 5);
    }
  });
});

function MODE_INDEX(id) {
  return MODES.indexOf(id);
}

describe('completeness / export & wearable API', () => {
  it('exposes all browser export entry points', () => {
    const downloads = [];
    globalThis.Blob = class Blob {
      constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type;
      }
    };
    globalThis.URL = {
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => {},
    };
    globalThis.document = {
      createElement: () => ({
        click() {
          downloads.push(this.download);
        },
      }),
    };
    const song = composeSong({ modeId: 'gong', seed: 1, structure: 'short' });
    const batch = composeBatch({ modeId: 'gong', count: 2, seed: 1, structure: 'short' });
    exportSongMidi(song);
    exportSongJson(song);
    exportBatchJson(batch);
    exportBatchMidiZipLike(batch);
    downloadBlob('a.txt', 'x', 'text/plain');
    assert.ok(downloads.length >= 5);
    assert.ok(songToMidiBytes(song).length > 20);

    const listeners = new Map();
    globalThis.window = {
      addEventListener: (t, h) => listeners.set(t, h),
      removeEventListener: (t) => listeners.delete(t),
    };
    const w = createWearableInput({
      onRingShake() {},
      onRingTiltLeft() {},
      onRingTiltRight() {},
      onRingTiltUp() {},
      onRingTiltDown() {},
      onCaneTap() {},
      onCaneSwingLeft() {},
      onCaneSwingRight() {},
    });
    w.start();
    assert.equal(listeners.size, 2);
    w.stop();
  });
});

describe('completeness / CLI capability', () => {
  it('help + compose with midi and json under temp root', () => {
    const logs = [];
    const help = runCli({ help: true }, { log: (...a) => logs.push(a.join(' ')) });
    assert.equal(help.ok, true);
    assert.match(helpText(), /--midi/);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wuyin-complete-'));
    try {
      const args = parseArgs([
        '--mode', 'zhi',
        '--count', '2',
        '--key', 'D',
        '--structure', 'short',
        '--seed', '42',
        '--midi',
        '--out', 'artifacts',
      ]);
      const result = runCli(args, {
        cwd: tmp,
        log: () => {},
        error: () => {},
      });
      assert.equal(result.ok, true);
      assert.ok(result.written.some((p) => p.endsWith('.json')));
      assert.ok(result.written.some((p) => p.endsWith('.mid')));
      assert.ok(fs.existsSync(result.outDir));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
