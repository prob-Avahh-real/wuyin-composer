/**
 * MIDI / JSON 导出
 * 标准 Type 0 MIDI，单轨旋律 + 可选低音
 */

import { clampMidi } from './sanitize.js';

function writeVarLen(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function encodeMidi(song) {
  const ticksPerBeat = 480;
  const tempo = song.tempo || 90;
  const usecPerBeat = Math.round(60_000_000 / tempo);

  const events = [];
  // set tempo
  events.push({ tick: 0, bytes: [0xff, 0x51, 0x03, (usecPerBeat >> 16) & 0xff, (usecPerBeat >> 8) & 0xff, usecPerBeat & 0xff] });
  // program change — acoustic guitar-ish
  events.push({ tick: 0, bytes: [0xc0, 0x18] });

  for (const note of song.melody || []) {
    const start = Math.round(note.beat * ticksPerBeat);
    const end = Math.round((note.beat + note.duration) * ticksPerBeat);
    const vel = note.section === 'chorus' ? 96 : 80;
    const midi = clampMidi(note.midi);
    events.push({ tick: start, bytes: [0x90, midi, vel] });
    events.push({ tick: end, bytes: [0x80, midi, 0x40] });
  }

  // drones as long notes on channel 1
  for (const d of song.drones || []) {
    const end = Math.round((song.totalBeats || 0) * ticksPerBeat);
    const midi = clampMidi(d.midi);
    events.push({ tick: 0, bytes: [0x91, midi, 40] });
    events.push({ tick: end, bytes: [0x81, midi, 0x40] });
  }

  events.push({ tick: Math.round(song.totalBeats * ticksPerBeat) + 10, bytes: [0xff, 0x2f, 0x00] });
  events.sort((a, b) => a.tick - b.tick || a.bytes[0] - b.bytes[0]);

  const track = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    lastTick = ev.tick;
    track.push(...writeVarLen(delta), ...ev.bytes);
  }

  const trackLen = track.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0, 0, 0, 6,
    0, 0, // format 0
    0, 1, // one track
    (ticksPerBeat >> 8) & 0xff, ticksPerBeat & 0xff,
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
  ];

  return new Uint8Array([...header, ...track]);
}

export function songToJson(song) {
  return JSON.stringify(song, null, 2);
}

export function batchToJson(batch) {
  return JSON.stringify(batch, null, 2);
}

export function songToMidiBytes(song) {
  return encodeMidi(song);
}

/** 浏览器下载 */
export function downloadBlob(filename, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSongMidi(song) {
  const bytes = songToMidiBytes(song);
  downloadBlob(`${song.id}.mid`, bytes, 'audio/midi');
}

export function exportSongJson(song) {
  downloadBlob(`${song.id}.json`, songToJson(song), 'application/json');
}

export function exportBatchJson(batch) {
  const name = `wuyin-${batch.modeId}-batch-${batch.baseSeed}.json`;
  downloadBlob(name, batchToJson(batch), 'application/json');
}

export function exportBatchMidiZipLike(batch) {
  // 无 zip 依赖：逐首下载 MIDI（批量时由 CLI 写盘更合适）
  for (const song of batch.songs) {
    exportSongMidi(song);
  }
}
