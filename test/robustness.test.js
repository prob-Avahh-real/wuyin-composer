/**
 * 鲁棒测试 — 异常输入、边界值、残缺数据、连续操作
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeSong, composeBatch } from '../src/composer.js';
import { songToMidiBytes, songToJson } from '../src/midi-export.js';
import { createSynth } from '../src/synth.js';
import { createWearableInput } from '../src/wearable-input.js';
import { parseArgs, runCli } from '../src/cli.js';
import { clampMidi } from '../src/sanitize.js';

describe('robustness / composer edges', () => {
  it('rejects unknown mode and absorbs NaN / Infinity options', () => {
    assert.throws(() => composeSong({ modeId: 'nope' }), /未知调式/);
    const song = composeSong({
      modeId: 'gong',
      seed: Number.NaN,
      tempo: Number.POSITIVE_INFINITY,
      count: Number.NaN,
      structure: 'short',
      key: 'C',
      index: -3.7,
    });
    assert.ok(Number.isFinite(song.tempo));
    assert.ok(song.tempo >= 60 && song.tempo <= 128);
    assert.equal(song.index, 0);

    const batch = composeBatch({ modeId: 'yu', count: Number.NaN, seed: 'not-a-number', structure: 'short' });
    assert.equal(batch.count, 5);
    assert.ok(Number.isFinite(batch.baseSeed));
  });

  it('clamps batch size and extreme seeds', () => {
    assert.equal(composeBatch({ modeId: 'gong', count: -10, seed: 1 }).count, 1);
    assert.equal(composeBatch({ modeId: 'gong', count: 999, seed: 1 }).count, 50);
    const huge = composeSong({ modeId: 'zhi', seed: 2 ** 40, structure: 'short', key: 'A' });
    assert.ok(huge.melody.every((n) => Number.isFinite(n.midi)));
  });

  it('accepts long custom title without breaking id', () => {
    const title = 'x'.repeat(200) + '<script>';
    const song = composeSong({ modeId: 'jue', seed: 8, title, structure: 'short' });
    assert.ok(song.title.length <= 80);
    assert.match(song.id, /^wuyin-jue-\d+-0$/);
  });
});

describe('robustness / midi & synth', () => {
  it('encodes empty / partial songs without throwing', () => {
    const empty = songToMidiBytes({
      tempo: 90,
      totalBeats: 4,
      melody: [],
      drones: [],
    });
    assert.equal(String.fromCharCode(...empty.slice(0, 4)), 'MThd');

    const wild = songToMidiBytes({
      tempo: 90,
      totalBeats: 8,
      melody: [
        { beat: 0, duration: 1, midi: 999, section: 'chorus' },
        { beat: 1, duration: 1, midi: -50, section: 'verse' },
      ],
      drones: [{ midi: Number.NaN }],
    });
    // 所有 note 字节应在 0..127
    for (let i = 0; i < wild.length - 2; i++) {
      if (wild[i] === 0x90 || wild[i] === 0x80 || wild[i] === 0x91 || wild[i] === 0x81) {
        assert.ok(wild[i + 1] <= 127);
      }
    }
    assert.equal(clampMidi(999), 127);
  });

  it('synth tolerates empty play and repeated stop', () => {
    const calls = [];
    class AudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
        this.state = 'running';
      }
      resume() {}
      createGain() {
        return {
          gain: {
            value: 0.5,
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
            linearRampToValueAtTime() {},
            cancelScheduledValues() {},
          },
          connect() {},
        };
      }
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect() {},
          start() { calls.push('start'); },
          stop() {},
        };
      }
      createBiquadFilter() {
        return { frequency: { value: 0 }, Q: { value: 0 }, connect() {} };
      }
    }
    globalThis.window = { AudioContext };
    const synth = createSynth();
    synth.play(null);
    synth.play({ melody: [] });
    synth.stop();
    synth.stop();
    const song = composeSong({ modeId: 'gong', seed: 1, structure: 'short' });
    synth.play(song);
    synth.play(song);
    synth.stop();
    assert.ok(calls.includes('start'));
  });
});

describe('robustness / wearable & cli', () => {
  it('ignores motion without acceleration payload', () => {
    const listeners = new Map();
    globalThis.window = {
      addEventListener: (t, h) => listeners.set(t, h),
      removeEventListener: (t) => listeners.delete(t),
    };
    let taps = 0;
    const input = createWearableInput({ onCaneTap: () => taps++ });
    input.start();
    const cane = listeners.get('devicemotion');
    for (let i = 0; i < 12; i++) cane({ accelerationIncludingGravity: null });
    assert.equal(taps, 0);
    input.stop();
  });

  it('CLI returns error object instead of throwing on bad mode', () => {
    const args = parseArgs(['--mode', '!!!', '--out', 'out']);
    const result = runCli(args, { log() {}, error() {}, cwd: process.cwd() });
    assert.equal(result.ok, false);
    assert.equal(result.code, 1);
  });

  it('JSON.stringify song survives missing optional fields', () => {
    const song = composeSong({ modeId: 'shang', seed: 2, structure: 'short' });
    delete song.createdAt;
    assert.ok(songToJson(song).includes(song.id));
  });
});
