/**
 * 五音堂 — 主应用
 */

import { listModes, getMode, THEORY_ARTICLES, WUYIN } from './theory.js';
import { composeBatch } from './composer.js';
import { createSynth } from './synth.js';
import {
  exportSongMidi,
  exportSongJson,
  exportBatchJson,
} from './midi-export.js';
import { createWearableInput } from './wearable-input.js';
import { escapeHtml } from './sanitize.js';

const MODE_IDS = ['gong', 'shang', 'jue', 'zhi', 'yu'];

const state = {
  modeId: 'gong',
  count: 5,
  key: 'D',
  tempo: null,
  structure: 'standard',
  seed: null,
  batch: null,
  songIndex: 0,
  tab: 'compose',
};

const synth = createSynth();

function $(sel) {
  return document.querySelector(sel);
}

function $all(sel) {
  return [...document.querySelectorAll(sel)];
}

function currentSong() {
  return state.batch?.songs?.[state.songIndex] || null;
}

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function renderModes() {
  const host = $('#mode-grid');
  if (!host) return;
  host.innerHTML = listModes()
    .map((m) => {
      const active = m.id === state.modeId ? 'active' : '';
      return `<button type="button" class="mode-card ${active}" data-mode="${m.id}" style="--mode:${m.color}">
        <span class="mode-name">${m.name}</span>
        <span class="mode-mood">${m.mood}</span>
        <span class="mode-season">${m.season}</span>
      </button>`;
    })
    .join('');

  host.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.modeId = btn.dataset.mode;
      renderModes();
      renderModeDetail();
      updateAccent();
    });
  });
}

function renderModeDetail() {
  const m = getMode(state.modeId);
  const el = $('#mode-detail');
  if (!el || !m) return;
  el.innerHTML = `
    <h2>${m.name}调</h2>
    <p class="lead">${m.description}</p>
    <p class="tip">${m.tip}</p>
  `;
}

function updateAccent() {
  const m = getMode(state.modeId);
  if (m) document.documentElement.style.setProperty('--accent', m.color);
}

function renderTheory() {
  const host = $('#theory-list');
  if (!host) return;
  host.innerHTML = THEORY_ARTICLES.map(
    (a) => `<article class="theory-card"><h3>${a.title}</h3><p>${a.body}</p></article>`
  ).join('');

  const modes = $('#theory-modes');
  if (modes) {
    modes.innerHTML = listModes()
      .map(
        (m) => `<div class="theory-mode" style="--mode:${m.color}">
          <strong>${m.name}</strong>
          <span>${m.mood}</span>
          <p>${m.description}</p>
        </div>`
      )
      .join('');
  }
}

function renderSongList() {
  const host = $('#song-list');
  const meta = $('#batch-meta');
  if (!host) return;

  if (!state.batch) {
    host.innerHTML = `<p class="empty">选择调式后点「批量创作」</p>`;
    if (meta) meta.textContent = '';
    return;
  }

  if (meta) {
    meta.textContent = `${state.batch.modeName}调 · ${state.batch.count} 首 · seed ${state.batch.baseSeed}`;
  }

  host.innerHTML = state.batch.songs
    .map((s, i) => {
      const on = i === state.songIndex ? 'on' : '';
      return `<button type="button" class="song-row ${on}" data-idx="${i}">
        <span class="song-title">${escapeHtml(s.title)}</span>
        <span class="song-meta">${escapeHtml(s.key)}宫 · ♩=${escapeHtml(s.tempo)} · ${escapeHtml(s.durationSec)}s</span>
      </button>`;
    })
    .join('');

  host.querySelectorAll('[data-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.songIndex = Number(btn.dataset.idx);
      renderSongList();
      renderNowPlaying();
    });
  });
}

function renderNowPlaying() {
  const song = currentSong();
  const el = $('#now-playing');
  if (!el) return;
  if (!song) {
    el.innerHTML = `<span class="muted">未选曲目</span>`;
    return;
  }
  el.innerHTML = `
    <strong>${escapeHtml(song.title)}</strong>
    <span>${escapeHtml(song.modeName)}调 · ${escapeHtml(song.key)}宫 · ${escapeHtml(song.structure)} · ♩=${escapeHtml(song.tempo)}</span>
  `;
  paintNotes(null);
}

function paintNotes(activeNote) {
  const canvas = $('#note-viz');
  if (!canvas) return;
  const song = currentSong();
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // ink wash bg stroke
  ctx.fillStyle = 'rgba(26, 20, 16, 0.35)';
  ctx.fillRect(0, 0, w, h);

  if (!song) return;

  const midis = song.melody.map((n) => n.midi);
  const minM = Math.min(...midis) - 2;
  const maxM = Math.max(...midis) + 2;
  const span = Math.max(1, maxM - minM);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c9a227';

  ctx.strokeStyle = 'rgba(232, 220, 200, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (const n of song.melody) {
    const x = (n.beat / song.totalBeats) * w;
    const y = h - ((n.midi - minM) / span) * (h - 16) - 8;
    const nw = Math.max(3, (n.duration / song.totalBeats) * w - 1);
    const isActive = activeNote && activeNote.beat === n.beat && activeNote.midi === n.midi;
    ctx.fillStyle = isActive ? accent : 'rgba(232, 220, 200, 0.55)';
    ctx.fillRect(x, y - 3, nw, 6);
  }
}

function doCompose() {
  synth.stop();
  const count = Number($('#count-input')?.value || state.count);
  const key = $('#key-select')?.value || state.key;
  const structure = $('#structure-select')?.value || state.structure;
  const tempoRaw = $('#tempo-input')?.value;
  const seedRaw = $('#seed-input')?.value;
  state.count = count;
  state.key = key;
  state.structure = structure;
  state.tempo = tempoRaw ? Number(tempoRaw) : null;
  state.seed = seedRaw ? Number(seedRaw) : null;

  state.batch = composeBatch({
    modeId: state.modeId,
    count,
    key,
    structure,
    tempo: state.tempo || undefined,
    seed: state.seed ?? undefined,
  });
  state.songIndex = 0;
  renderSongList();
  renderNowPlaying();
  toast(`已创作 ${state.batch.count} 首${state.batch.modeName}调`);
  setTab('library');
}

function togglePlay() {
  const song = currentSong();
  if (!song) {
    toast('请先批量创作');
    return;
  }
  if (synth.playing) {
    synth.stop();
    $('#btn-play')?.classList.remove('playing');
    paintNotes(null);
    return;
  }
  synth.ensureCtx();
  synth.play(song, {
    onNote: (n) => paintNotes(n),
    onEnd: () => {
      $('#btn-play')?.classList.remove('playing');
      paintNotes(null);
      // auto next
      if (state.batch && state.songIndex < state.batch.songs.length - 1) {
        state.songIndex++;
        renderSongList();
        renderNowPlaying();
        togglePlay();
      }
    },
  });
  $('#btn-play')?.classList.add('playing');
}

function nextSong() {
  if (!state.batch) return;
  synth.stop();
  $('#btn-play')?.classList.remove('playing');
  state.songIndex = (state.songIndex + 1) % state.batch.songs.length;
  renderSongList();
  renderNowPlaying();
}

function prevSong() {
  if (!state.batch) return;
  synth.stop();
  $('#btn-play')?.classList.remove('playing');
  state.songIndex = (state.songIndex - 1 + state.batch.songs.length) % state.batch.songs.length;
  renderSongList();
  renderNowPlaying();
}

function cycleMode(dir) {
  const i = MODE_IDS.indexOf(state.modeId);
  const next = MODE_IDS[(i + dir + MODE_IDS.length) % MODE_IDS.length];
  state.modeId = next;
  renderModes();
  renderModeDetail();
  updateAccent();
  toast(`${WUYIN[next].name}调`);
}

function setTab(name) {
  state.tab = name;
  $all('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $all('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
}

function bindUi() {
  $('#btn-compose')?.addEventListener('click', doCompose);
  $('#btn-play')?.addEventListener('click', togglePlay);
  $('#btn-next')?.addEventListener('click', nextSong);
  $('#btn-prev')?.addEventListener('click', prevSong);
  $('#btn-export-batch')?.addEventListener('click', () => {
    if (!state.batch) return toast('无批次');
    exportBatchJson(state.batch);
    toast('已导出 JSON');
  });
  $('#btn-export-midi')?.addEventListener('click', () => {
    const s = currentSong();
    if (!s) return toast('无曲目');
    exportSongMidi(s);
    toast('已导出 MIDI');
  });
  $('#btn-export-json')?.addEventListener('click', () => {
    const s = currentSong();
    if (!s) return toast('无曲目');
    exportSongJson(s);
    toast('已导出 JSON');
  });

  $all('[data-tab]').forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });

  $('#btn-wearable')?.addEventListener('click', async () => {
    const ok = await wearable.requestPermission();
    wearable.start();
    toast(ok ? '戒指/手杖已启用' : '传感器已监听（桌面可忽略权限）');
  });

  window.addEventListener('resize', () => paintNotes(null));
}

const wearable = createWearableInput({
  onRingShake: () => {
    if (!state.batch) doCompose();
    else togglePlay();
  },
  onRingTiltLeft: () => cycleMode(-1),
  onRingTiltRight: () => cycleMode(1),
  onRingTiltUp: () => {
    if (state.batch) prevSong();
  },
  onRingTiltDown: () => {
    if (state.batch) nextSong();
  },
  onCaneTap: () => {
    if (!state.batch) doCompose();
    else togglePlay();
  },
  onCaneSwingLeft: () => cycleMode(-1),
  onCaneSwingRight: () => {
    if (state.batch) nextSong();
    else cycleMode(1);
  },
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function init() {
  renderModes();
  renderModeDetail();
  renderTheory();
  renderSongList();
  renderNowPlaying();
  updateAccent();
  bindUi();
  registerSW();
  paintNotes(null);
}

init();
