/**
 * 安全测试 — 路径穿越、注入、XSS、原型污染、MIDI 边界、敏感模式
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { composeSong, composeBatch } from '../src/composer.js';
import { songToMidiBytes } from '../src/midi-export.js';
import {
  escapeHtml,
  assertSafeFilename,
  assertSafeModeId,
  stripPrototypePollution,
  clampMidi,
} from '../src/sanitize.js';
import { parseArgs, resolveSafeOutDir, runCli } from '../src/cli.js';

describe('security / path traversal', () => {
  it('blocks .. and absolute escape from allowed root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wuyin-sec-root-'));
    try {
      assert.throws(() => resolveSafeOutDir('../outside', root), /越界/);
      assert.throws(() => resolveSafeOutDir('../../../../etc', root), /越界/);
      assert.throws(() => resolveSafeOutDir('/etc/passwd', root), /越界/);
      const ok = resolveSafeOutDir('nest/out', root);
      assert.ok(ok.startsWith(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('CLI refuses traversal out and writes only under cwd', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wuyin-sec-cli-'));
    try {
      const bad = runCli(parseArgs(['--mode', 'gong', '--out', '../escape']), {
        cwd: tmp,
        log() {},
        error() {},
      });
      assert.equal(bad.ok, false);
      assert.match(bad.error, /越界/);

      const good = runCli(parseArgs(['--mode', 'gong', '--count', '1', '--seed', '1', '--out', 'safe']), {
        cwd: tmp,
        log() {},
        error() {},
      });
      assert.equal(good.ok, true);
      for (const file of good.written) {
        assert.ok(file.startsWith(tmp));
        assert.ok(!file.includes('..'));
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('security / injection & XSS', () => {
  it('rejects shell-like mode tokens and unsafe filenames', () => {
    for (const mode of ['gong;rm -rf', 'gong`id`', '../yu', 'YU', '']) {
      assert.throws(() => assertSafeModeId(mode), /未知调式/);
    }
    for (const name of ['../x', 'a/b', 'foo\\bar', '.', '..', 'evil name', 'a<script>', '']) {
      assert.throws(() => assertSafeFilename(name), /非法文件名/);
    }
    assert.throws(() => assertSafeFilename('evil\0hid'), /非法文件名/);
  });

  it('escapes HTML payloads that could appear in song titles', () => {
    const payload = `<img src=x onerror="alert(1)">&"'`;
    const song = composeSong({
      modeId: 'gong',
      seed: 1,
      structure: 'short',
      title: payload,
    });
    const html = `<span>${escapeHtml(song.title)}</span>`;
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('"alert'));
    assert.match(html, /&lt;img/);
    assert.match(html, /&quot;/);
    assert.match(html, /&amp;/);
  });

  it('generated song ids are filename-safe', () => {
    for (const modeId of ['gong', 'shang', 'jue', 'zhi', 'yu']) {
      const song = composeSong({ modeId, seed: 99, structure: 'short' });
      assert.equal(assertSafeFilename(song.id), song.id);
    }
  });
});

describe('security / prototype pollution', () => {
  it('compose ignores __proto__ pollution attempts', () => {
    const polluted = JSON.parse('{"modeId":"yu","structure":"short","seed":1,"__proto__":{"hacked":1}}');
    const before = Object.prototype.hacked;
    const song = composeSong(polluted);
    assert.equal(song.modeId, 'yu');
    assert.equal(Object.prototype.hacked, before);

    const batchOpts = JSON.parse('{"modeId":"gong","count":1,"seed":2,"constructor":{"prototype":{"x":1}}}');
    const clean = stripPrototypePollution(batchOpts);
    assert.equal(clean.modeId, 'gong');
    assert.equal(clean.constructor, undefined);
    composeBatch(batchOpts);
    assert.equal(Object.prototype.x, undefined);
  });
});

describe('security / midi byte safety', () => {
  it('never emits note numbers outside 0..127', () => {
    const bytes = songToMidiBytes({
      tempo: 100,
      totalBeats: 4,
      melody: [
        { beat: 0, duration: 1, midi: 10_000, section: 'chorus' },
        { beat: 1, duration: 1, midi: -999, section: 'verse' },
      ],
      drones: [{ midi: 512 }],
    });
    for (let i = 0; i < bytes.length - 1; i++) {
      const status = bytes[i];
      if ([0x90, 0x80, 0x91, 0x81].includes(status)) {
        assert.ok(bytes[i + 1] >= 0 && bytes[i + 1] <= 127);
      }
    }
    assert.equal(clampMidi(10_000), 127);
  });
});

describe('security / service worker assumptions', () => {
  it('sw.js only handles GET and uses relative asset URLs', () => {
    const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    assert.match(sw, /request\.method !== 'GET'/);
    assert.doesNotMatch(sw, /eval\s*\(/);
    assert.doesNotMatch(sw, /new Function/);
    assert.match(sw, /\.\/index\.html/);
  });
});
