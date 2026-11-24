import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  batchToJson,
  downloadBlob,
  exportBatchJson,
  exportBatchMidiZipLike,
  exportSongJson,
  exportSongMidi,
  songToJson,
} from '../src/midi-export.js';
import { composeBatch, composeSong } from '../src/composer.js';
import { createSynth } from '../src/synth.js';
import { createWearableInput } from '../src/wearable-input.js';

const savedGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  URL: globalThis.URL,
  Blob: globalThis.Blob,
  DeviceOrientationEvent: globalThis.DeviceOrientationEvent,
  DeviceMotionEvent: globalThis.DeviceMotionEvent,
};

afterEach(() => {
  Object.assign(globalThis, savedGlobals);
});

function installDownloadDom() {
  const downloads = [];
  globalThis.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options?.type;
    }
  };
  globalThis.URL = {
    createObjectURL: (blob) => {
      downloads.push({ kind: 'url', blob });
      return 'blob:five-tones';
    },
    revokeObjectURL: (url) => downloads.push({ kind: 'revoke', url }),
  };
  globalThis.document = {
    createElement: () => ({
      click() {
        downloads.push({ kind: 'click', filename: this.download, href: this.href });
      },
    }),
  };
  return downloads;
}

function installAudioWindow() {
  const calls = [];
  const gain = () => ({
    gain: {
      value: 0,
      setValueAtTime: (...args) => calls.push(['set', ...args]),
      exponentialRampToValueAtTime: (...args) => calls.push(['exp', ...args]),
      linearRampToValueAtTime: (...args) => calls.push(['linear', ...args]),
      cancelScheduledValues: (...args) => calls.push(['cancel', ...args]),
    },
    connect: () => calls.push(['connect-gain']),
  });
  class AudioContext {
    constructor() {
      this.currentTime = 1;
      this.destination = {};
      this.state = 'suspended';
    }
    resume() {
      this.state = 'running';
      calls.push(['resume']);
    }
    createGain() {
      return gain();
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect: () => calls.push(['connect-osc']),
        start: (when) => calls.push(['start', when]),
        stop: (when) => calls.push(['stop', when]),
      };
    }
    createBiquadFilter() {
      return {
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: () => calls.push(['connect-filter']),
      };
    }
  }
  globalThis.window = { AudioContext };
  return calls;
}

function installMotionWindow() {
  const listeners = new Map();
  globalThis.window = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
  };
  return listeners;
}

describe('browser export helpers', () => {
  it('serializes and downloads JSON and MIDI exports', () => {
    const downloads = installDownloadDom();
    const song = composeSong({ modeId: 'zhi', key: 'D', structure: 'short', seed: 3 });
    const batch = composeBatch({ modeId: 'zhi', count: 2, seed: 3 });

    assert.deepEqual(JSON.parse(songToJson(song)).id, song.id);
    assert.equal(JSON.parse(batchToJson(batch)).count, 2);
    downloadBlob('raw.txt', 'hello', 'text/plain');
    exportSongMidi(song);
    exportSongJson(song);
    exportBatchJson(batch);
    exportBatchMidiZipLike(batch);

    const clicks = downloads.filter((event) => event.kind === 'click');
    assert.equal(clicks.length, 6);
    assert.ok(clicks.some((event) => event.filename.endsWith('.mid')));
    assert.ok(clicks.some((event) => event.filename.endsWith('.json')));
    assert.equal(downloads.filter((event) => event.kind === 'revoke').length, 6);
  });

  it('downloads an existing Blob without wrapping it', () => {
    const downloads = installDownloadDom();
    const blob = new Blob(['midi'], { type: 'audio/midi' });
    downloadBlob('existing.mid', blob, 'audio/midi');
    assert.equal(downloads[0].blob, blob);
  });
});

describe('Web Audio synth', () => {
  it('initializes, plays and stops a generated song', () => {
    const calls = installAudioWindow();
    const synth = createSynth();
    const song = composeSong({ modeId: 'gong', structure: 'short', seed: 7 });
    let noted = 0;

    synth.ensureCtx();
    assert.ok(calls.some(([name]) => name === 'resume'));
    synth.play({}, { onNote: () => { noted++; } });
    assert.equal(synth.playing, false);
    synth.play(song, { onNote: () => { noted++; } });
    assert.equal(synth.playing, true);
    assert.equal(synth.currentSong, song);
    assert.ok(calls.some(([name]) => name === 'start'));
    synth.stop();
    assert.equal(synth.playing, false);
    assert.equal(synth.currentSong, null);
    assert.equal(noted, 0);
  });
});

describe('wearable input', () => {
  it('dispatches ring and cane gestures and can stop listening', () => {
    const listeners = installMotionWindow();
    const events = [];
    const input = createWearableInput({
      onRingTiltLeft: () => events.push('left'),
      onRingTiltRight: () => events.push('right'),
      onRingTiltUp: () => events.push('up'),
      onRingTiltDown: () => events.push('down'),
      onRingShake: () => events.push('shake'),
      onCaneTap: () => events.push('tap'),
      onCaneSwingLeft: () => events.push('swing-left'),
      onCaneSwingRight: () => events.push('swing-right'),
    });
    const originalNow = Date.now;
    let now = 1_000;
    Date.now = () => (now += 1_000);
    try {
      input.start();
      input.start();
      assert.equal(input.listening, true);
      const ring = listeners.get('deviceorientation');
      const cane = listeners.get('devicemotion');
      for (let i = 0; i < 8; i++) ring({ beta: 0, gamma: -8 });
      for (let i = 0; i < 8; i++) ring({ beta: 0, gamma: 8 });
      for (let i = 0; i < 8; i++) ring({ beta: -8, gamma: 0 });
      for (let i = 0; i < 8; i++) ring({ beta: 8, gamma: 0 });
      for (let i = 0; i < 8; i++) ring({ beta: 40, gamma: 0 });
      for (let i = 0; i < 6; i++) cane({ acceleration: { x: 0, y: 0, z: 30 } });
      for (let i = 0; i < 6; i++) cane({ acceleration: { x: -5, y: 0, z: 9.8 } });
      for (let i = 0; i < 6; i++) cane({ acceleration: { x: 5, y: 0, z: 9.8 } });
      cane({});
    } finally {
      Date.now = originalNow;
    }
    assert.deepEqual(events, ['left', 'right', 'up', 'down', 'shake', 'tap', 'swing-left', 'swing-right']);
    input.stop();
    input.stop();
    assert.equal(input.listening, false);
    assert.equal(listeners.size, 0);
  });

  it('requests native sensor permissions and reports refusal', async () => {
    installMotionWindow();
    globalThis.DeviceOrientationEvent = { requestPermission: async () => 'granted' };
    globalThis.DeviceMotionEvent = { requestPermission: async () => 'denied' };
    const input = createWearableInput();
    assert.equal(await input.requestPermission(), false);

    globalThis.DeviceOrientationEvent = { requestPermission: async () => { throw new Error('blocked'); } };
    globalThis.DeviceMotionEvent = { requestPermission: async () => 'granted' };
    assert.equal(await input.requestPermission(), false);
  });
});
