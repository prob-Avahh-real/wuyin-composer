/**
 * Web Audio 合成器 — 演奏五音歌曲
 * 音色偏古琴/笛子混合：正弦+轻噪声拨弦感
 */

export function createSynth() {
  let ctx = null;
  let master = null;
  let playing = false;
  let timerIds = [];
  let onEnd = null;
  let currentSong = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playTone(midi, when, duration, velocity = 0.35, kind = 'pluck') {
    const c = ensureCtx();
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = kind === 'drone' ? 'sine' : 'triangle';
    osc.frequency.value = freq;

    // 轻微二倍频泛音
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    gain2.gain.value = kind === 'drone' ? 0.08 : 0.12;

    filter.type = 'lowpass';
    filter.frequency.value = kind === 'drone' ? 1200 : 2800;
    filter.Q.value = 0.7;

    const attack = kind === 'drone' ? 0.08 : 0.012;
    const release = Math.min(0.35, duration * 0.4);
    const peak = velocity;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, when + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);

    osc.connect(filter);
    osc2.connect(gain2);
    gain2.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(when);
    osc2.start(when);
    osc.stop(when + duration + release + 0.05);
    osc2.stop(when + duration + release + 0.05);
  }

  function clearTimers() {
    for (const id of timerIds) clearTimeout(id);
    timerIds = [];
  }

  function stop() {
    clearTimers();
    playing = false;
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.08);
      const id = setTimeout(() => {
        if (master) master.gain.setValueAtTime(0.55, ctx.currentTime);
      }, 120);
      timerIds.push(id);
    }
    currentSong = null;
  }

  /**
   * @param {object} song - composeSong 结果
   * @param {{ onNote?: Function, onEnd?: Function }} [hooks]
   */
  function play(song, hooks = {}) {
    if (!song?.melody?.length) return;
    stop();
    ensureCtx();
    master.gain.setValueAtTime(0.55, ctx.currentTime);

    playing = true;
    currentSong = song;
    onEnd = hooks.onEnd || null;

    const beatSec = 60 / song.tempo;
    const t0 = ctx.currentTime + 0.05;

    // 持续低音垫
    for (const d of song.drones || []) {
      playTone(d.midi, t0, song.durationSec * 0.95, 0.12, 'drone');
    }

    for (const note of song.melody) {
      const when = t0 + note.beat * beatSec;
      const dur = Math.max(0.08, note.duration * beatSec * 0.92);
      const isChorus = note.section === 'chorus';
      playTone(note.midi, when, dur, isChorus ? 0.42 : 0.32, 'pluck');

      if (hooks.onNote) {
        const delay = Math.max(0, (when - ctx.currentTime) * 1000);
        const id = setTimeout(() => {
          if (playing) hooks.onNote(note);
        }, delay);
        timerIds.push(id);
      }
    }

    const endMs = (song.durationSec + 0.4) * 1000;
    const endId = setTimeout(() => {
      playing = false;
      currentSong = null;
      onEnd?.(song);
    }, endMs);
    timerIds.push(endId);
  }

  return {
    play,
    stop,
    ensureCtx,
    get playing() {
      return playing;
    },
    get currentSong() {
      return currentSong;
    },
  };
}
