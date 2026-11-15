/**
 * The web timer: the app's setup screen and running timer in the browser.
 *
 * The phase engine is the app's own (engine.js is generated from mobile/src/timer.ts) and every
 * label comes from the app's translations, so the web timer behaves and reads like the app.
 * Sounds are scheduled ahead on the Web Audio clock, so bells stay on time in a background tab.
 */
import { buildPhases, displaySeconds, snapshotAt, totalDuration } from './engine.js';

const cfg = JSON.parse(document.getElementById('timer-config').textContent);
const { ui, web, sport } = cfg;

const fill = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const t = (key, vars) => fill(ui[key] ?? key, vars);

// ---------- settings (same steps as mobile/src/settings.ts) ----------

function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

const STEPS = {
  rounds: range(1, 99, 1),
  roundSec: [...range(10, 55, 5), ...range(60, 285, 15), ...range(300, 1800, 30)],
  restSec: [0, ...range(5, 55, 5), ...range(60, 600, 15)],
  prepareSec: [0, 3, ...range(5, 60, 5), 90, 120],
  warningSec: [0, 5, 10, 15, 20, 30, 45, 60, 90, 120],
};

function stepValue(list, value, dir) {
  if (dir > 0) return list.find((v) => v > value) ?? list[list.length - 1];
  for (let i = list.length - 1; i >= 0; i--) if (list[i] < value) return list[i];
  return list[0];
}

function formatClock(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const NUMERIC = ['rounds', 'roundSec', 'restSec', 'prepareSec', 'warningSec'];
const BOOLEAN = ['halfwaySwitch', 'countdownBeeps'];
/** URL parameter for each setting, used by Share. */
const PARAMS = { rounds: 'r', roundSec: 't', restSec: 'rest', prepareSec: 'ready', warningSec: 'warn', halfwaySwitch: 'switch', countdownBeeps: 'beeps' };

/** Keeps only valid values, falling back to the sport's defaults. */
function clean(raw) {
  const s = { ...sport.defaults };
  for (const k of NUMERIC) {
    const v = Number(raw[k]);
    const list = STEPS[k];
    if (Number.isInteger(v) && v >= list[0] && v <= list[list.length - 1]) s[k] = v;
  }
  for (const k of BOOLEAN) if (typeof raw[k] === 'boolean') s[k] = raw[k];
  return s;
}

function fromUrl() {
  const q = new URLSearchParams(location.search);
  if (!Object.values(PARAMS).some((p) => q.has(p))) return null;
  const raw = {};
  for (const k of [...NUMERIC, ...BOOLEAN]) {
    const v = q.get(PARAMS[k]);
    if (v !== null) raw[k] = BOOLEAN.includes(k) ? v === '1' : Number(v);
  }
  return clean(raw);
}

function loadStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(cfg.storageKey) ?? 'null');
    if (raw && typeof raw === 'object') return clean(raw);
  } catch {}
  return { ...sport.defaults };
}

function store() {
  try {
    localStorage.setItem(cfg.storageKey, JSON.stringify(settings));
  } catch {}
}

function shareUrl() {
  const q = new URLSearchParams();
  for (const k of [...NUMERIC, ...BOOLEAN]) {
    if (settings[k] !== sport.defaults[k]) q.set(PARAMS[k], BOOLEAN.includes(k) ? (settings[k] ? '1' : '0') : String(settings[k]));
  }
  const qs = q.toString();
  return `${location.origin}${location.pathname}${qs ? `?${qs}` : ''}`;
}

let settings = fromUrl() ?? loadStored();

// ---------- setup card ----------

const card = document.getElementById('timer');
const rows = new Map([...card.querySelectorAll('.row[data-key]')].map((r) => [r.dataset.key, r]));
const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};

function valueText(key) {
  const v = settings[key];
  switch (key) {
    case 'rounds':
      return String(v);
    case 'roundSec':
      return formatClock(v);
    case 'restSec':
      return v === 0 ? t('setup.none') : formatClock(v);
    case 'prepareSec':
      return v === 0 ? t('setup.off') : formatClock(v);
    case 'warningSec':
      return v === 0 ? t('setup.off') : t('setup.seconds', { n: v });
  }
  return String(v);
}

function renderSetup() {
  for (const chip of card.querySelectorAll('.chip')) {
    const p = sport.presets.find((x) => x.id === chip.dataset.preset);
    const on = !!p && p.rounds === settings.rounds && p.roundSec === settings.roundSec && p.restSec === settings.restSec;
    chip.setAttribute('aria-pressed', String(on));
  }
  for (const belt of card.querySelectorAll('.belt')) {
    belt.setAttribute('aria-pressed', String(Number(belt.dataset.sec) === settings.roundSec));
  }
  for (const [key, row] of rows) {
    setText(row.querySelector('.row-value'), valueText(key));
    const list = STEPS[key];
    row.querySelector('[data-dir="-1"]').disabled = settings[key] <= list[0];
    row.querySelector('[data-dir="1"]').disabled = settings[key] >= list[list.length - 1];
  }
  const warnActive = settings.warningSec > 0 && settings.warningSec < settings.roundSec;
  setText(
    rows.get('warningSec').querySelector('.row-hint'),
    warnActive ? t('setup.endWarningHintActive', { n: settings.warningSec }) : t('setup.endWarningHint'),
  );
  for (const sw of card.querySelectorAll('.switch')) sw.setAttribute('aria-checked', String(!!settings[sw.dataset.key]));
  setText(card.querySelector('.total-value'), formatDuration(totalDuration(buildPhases(settings)) / 1000));
}

function update(patch) {
  settings = { ...settings, ...patch };
  store();
  renderSetup();
  const url = shareUrl();
  if (url !== `${location.origin}${location.pathname}${location.search}`) history.replaceState(null, '', url + location.hash);
}

// Steppers repeat while held, faster and faster, like the app's.
let repeat = null;
let held = null;

function stopRepeat() {
  clearTimeout(repeat);
  repeat = null;
  held?.classList.remove('held');
  held = null;
}

function stepOnce(btn) {
  const key = btn.closest('.row').dataset.key;
  const next = stepValue(STEPS[key], settings[key], Number(btn.dataset.dir));
  if (next === settings[key]) return false;
  update({ [key]: next });
  return true;
}

card.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.step');
  if (!btn || btn.disabled || e.button > 0) return;
  e.preventDefault();
  stopRepeat();
  if (!stepOnce(btn)) return;
  held = btn;
  btn.classList.add('held');
  let delay = 380;
  const loop = () => {
    repeat = setTimeout(() => {
      if (!stepOnce(btn)) return stopRepeat();
      delay = Math.max(60, delay * 0.75);
      loop();
    }, delay);
  };
  loop();
});
for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, stopRepeat);
document.addEventListener('visibilitychange', stopRepeat);

card.addEventListener('click', (e) => {
  const step = e.target.closest('.step');
  // Pointer presses step on pointerdown; this handles Enter and Space.
  if (step) {
    if (e.detail === 0) stepOnce(step);
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) {
    const p = sport.presets.find((x) => x.id === chip.dataset.preset);
    if (p) update({ rounds: p.rounds, roundSec: p.roundSec, restSec: p.restSec });
    return;
  }
  const belt = e.target.closest('.belt');
  if (belt) return update({ roundSec: Number(belt.dataset.sec) });
  const sw = e.target.closest('.switch');
  if (sw) return update({ [sw.dataset.key]: !settings[sw.dataset.key] });
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'start') start();
  if (act === 'share') share();
});

// ---------- toast and share ----------

const toastEl = document.querySelector('.toast');
let toastTimer = null;
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function share() {
  const url = shareUrl();
  const text = fill(web.shareText, {
    rounds: settings.rounds,
    round: formatClock(settings.roundSec),
    rest: formatClock(settings.restSec),
  });
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, text, url });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(web.copied);
  } catch {
    window.prompt(web.share, url);
  }
}

// ---------- sound ----------

const audio = {
  ctx: null,
  buffers: {},
  loading: null,
  scheduled: [],

  /** Must run inside a tap: browsers only start audio from a user gesture. */
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx ??= new AC();
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {}
    this.loading ??= Promise.all(
      Object.entries(cfg.sounds).map(async ([name, url]) => {
        const data = await (await fetch(url)).arrayBuffer();
        this.buffers[name] = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
      }),
    ).catch(() => {});
    return this.loading;
  },

  /** Cancels sounds that haven't started yet; one already ringing plays out. */
  cancel() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.scheduled = this.scheduled.filter(({ src, when }) => {
      if (when <= now + 0.02) return true;
      try {
        src.stop();
      } catch {}
      return false;
    });
  },

  play(name, delaySec) {
    const buffer = this.buffers[name];
    if (!buffer || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    const when = this.ctx.currentTime + Math.max(0, delaySec);
    src.start(when);
    const entry = { src, when };
    src.onended = () => {
      this.scheduled = this.scheduled.filter((x) => x !== entry);
    };
    this.scheduled.push(entry);
  },
};

/** Every sound still to come, as in the app: bells, clapper, halfway switch and countdown beeps. */
function cuesFrom(now) {
  const out = [];
  const set = run.settings;
  let acc = 0;
  for (const phase of run.phases) {
    const start = acc;
    const end = acc + phase.duration;
    acc = end;
    if (end <= now) continue;
    if (start >= now - 50) {
      if (phase.kind === 'round') out.push({ at: start, sound: 'bell-start' });
      if (phase.kind === 'rest') out.push({ at: start, sound: 'bell-end' });
    }
    if (phase.kind === 'round') {
      const half = Math.floor(phase.duration / 2000);
      let switchAt = null;
      if (set.halfwaySwitch && half > 0) {
        switchAt = end - half * 1000;
        if (switchAt > now) out.push({ at: switchAt, sound: 'switch' });
      }
      if (set.warningSec > 0 && set.warningSec * 1000 < phase.duration) {
        const at = end - set.warningSec * 1000;
        if (at > now && at !== switchAt) out.push({ at, sound: 'clapper' });
      }
    } else if (set.countdownBeeps) {
      for (const sec of [3, 2, 1]) {
        const at = end - sec * 1000;
        if (at > start && at > now) out.push({ at, sound: 'beep' });
      }
    }
  }
  if (acc > now - 50) out.push({ at: acc, sound: 'bell-end' });
  return out;
}

function scheduleCues() {
  audio.cancel();
  if (!run || run.status !== 'running' || !audio.loading) return;
  const go = () => {
    if (!run || run.status !== 'running') return;
    audio.cancel();
    const now = elapsed();
    for (const cue of cuesFrom(now)) audio.play(cue.sound, (cue.at - now) / 1000);
  };
  audio.loading.then(go);
}

// ---------- keep the screen on ----------

const wake = {
  lock: null,
  async on() {
    try {
      if (!this.lock || this.lock.released) this.lock = await navigator.wakeLock?.request('screen');
    } catch {}
  },
  off() {
    this.lock?.release().catch(() => {});
    this.lock = null;
  },
};

// ---------- running timer ----------

const runEl = document.getElementById('run');
const $ = (sel) => runEl.querySelector(sel);
const els = {
  round: $('.run-round'),
  label: $('.run-label'),
  digits: $('.run-digits'),
  hint: $('.run-hint'),
  bar: $('.ring-bar'),
  dots: $('.dots'),
  elapsed: $('[data-stat="elapsed"]'),
  remaining: $('[data-stat="remaining"]'),
  toggle: $('[data-act="toggle"]'),
  doneButtons: $('.done-buttons'),
  soundHint: $('.sound-hint'),
  live: $('[data-live]'),
  fullscreen: $('[data-act="fullscreen"]'),
};
const themeMeta = document.querySelector('meta[name="theme-color"]');
const PHASE_COLOR = { prepare: '#1F5FD6', round: '#15924A', warning: '#F5A70A', rest: '#D02A2A', done: '#141419' };
const PHASE_LABEL = { prepare: t('phase.prepare'), round: sport.roundLabel, rest: t('phase.rest') };

let run = null;
let interval = null;

const elapsed = () => run.banked + (run.since != null ? performance.now() - run.since : 0);

function buzz(pattern) {
  if (document.visibilityState === 'visible') navigator.vibrate?.(pattern);
}

function start() {
  audio.unlock();
  const phases = buildPhases(settings);
  run = { settings: { ...settings }, phases, total: totalDuration(phases), banked: 0, since: performance.now(), last: null, status: 'running', label: '' };
  els.dots.replaceChildren(
    ...(run.settings.rounds <= 24 ? Array.from({ length: run.settings.rounds }, () => Object.assign(document.createElement('span'), { className: 'dot' })) : []),
  );
  els.fullscreen.hidden = !document.fullscreenEnabled;
  document.documentElement.classList.add('running');
  runEl.hidden = false;
  evaluate();
  scheduleCues();
  wake.on();
  clearInterval(interval);
  interval = setInterval(evaluate, 100);
  els.toggle.focus({ preventScroll: true });
  setTimeout(() => {
    if (run && audio.ctx && audio.ctx.state !== 'running') els.soundHint.hidden = false;
  }, 700);
}

function stop() {
  clearInterval(interval);
  interval = null;
  audio.cancel();
  wake.off();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  runEl.hidden = true;
  els.soundHint.hidden = true;
  document.documentElement.classList.remove('running');
  themeMeta?.setAttribute('content', '#0C0C10');
  run = null;
  card.querySelector('.start').focus({ preventScroll: true });
}

function pause() {
  if (!run || run.since == null) return;
  run.banked = elapsed();
  run.since = null;
  run.status = 'paused';
  audio.cancel();
  evaluate();
}

function resume() {
  if (!run || run.since != null || run.status === 'done') return;
  run.since = performance.now();
  run.status = 'running';
  evaluate();
  scheduleCues();
}

function skip() {
  if (!run) return;
  const s = snapshotAt(run.phases, elapsed());
  if (s.index >= run.phases.length) return;
  run.banked = s.phaseStart + run.phases[s.index].duration;
  if (run.since != null) run.since = performance.now();
  evaluate();
  scheduleCues();
}

function restart() {
  if (!run) return;
  run.banked = 0;
  run.since = performance.now();
  run.last = null;
  run.status = 'running';
  evaluate();
  scheduleCues();
}

function evaluate() {
  if (!run) return;
  const s = snapshotAt(run.phases, elapsed());
  const sec = displaySeconds(s.remaining);
  const last = run.last;
  const set = run.settings;

  if (!last || last.index !== s.index) {
    if (s.index >= run.phases.length) {
      run.banked = s.phaseStart;
      run.since = null;
      run.status = 'done';
      audio.cancel();
      buzz([300]);
    } else {
      const kind = run.phases[s.index].kind;
      buzz(kind === 'round' ? [200] : kind === 'rest' ? [120, 80, 120] : [60]);
      // Re-align the sound schedule with the clock at every phase change.
      if (last && run.status === 'running' && document.visibilityState === 'visible') scheduleCues();
    }
  } else if (s.index < run.phases.length && sec < last.sec) {
    const phase = run.phases[s.index];
    const half = Math.floor(phase.duration / 2000);
    if (phase.kind === 'round' && set.halfwaySwitch && half > 0 && last.sec > half && sec <= half) buzz([250]);
    else if (phase.kind === 'round' && set.warningSec > 0 && set.warningSec * 1000 < phase.duration && last.sec > set.warningSec && sec <= set.warningSec)
      buzz([80, 60, 80]);
    else if (phase.kind !== 'round' && set.countdownBeeps && sec >= 1 && sec <= 3) buzz([40]);
  }

  run.last = { index: s.index, sec };
  render(s, sec);
}

function render(s, sec) {
  const set = run.settings;
  const done = run.status === 'done';
  const phase = run.phases[s.index];
  const inWarning = !done && phase.kind === 'round' && set.warningSec > 0 && set.warningSec * 1000 < phase.duration && sec <= set.warningSec;
  const half = phase ? Math.floor(phase.duration / 2000) : 0;
  const switchActive = !done && set.halfwaySwitch && phase.kind === 'round' && half > 0;
  const showSwitch = switchActive && sec <= half && sec > half - 4;
  const theme = done ? 'done' : inWarning ? 'warning' : phase.kind;

  if (runEl.dataset.phase !== theme) {
    runEl.dataset.phase = theme;
    themeMeta?.setAttribute('content', PHASE_COLOR[theme]);
  }
  runEl.dataset.status = run.status;

  setText(
    els.round,
    done ? t('timer.roundsDone', { total: set.rounds }) : t('timer.round', { round: phase.kind === 'rest' ? phase.round + 1 : phase.round, total: set.rounds }),
  );

  let hint = '';
  if (done) hint = t('timer.sessionComplete');
  else if (switchActive && sec > half) hint = t('timer.switchAt', { time: formatClock(half) });
  else {
    const next = run.phases[s.index + 1];
    if (!next) hint = t('timer.finalRound');
    else if (next.kind === 'rest') hint = t('timer.nextRest', { time: formatClock(next.duration / 1000) });
    else if (next.kind === 'round') hint = t('timer.nextRound', { round: next.round });
  }
  setText(els.hint, hint);

  const label = done ? t('phase.done') : run.status === 'paused' ? t('phase.paused') : showSwitch ? t('phase.switch') : PHASE_LABEL[phase.kind];
  setText(els.label, label);
  if (label !== run.label) {
    run.label = label;
    setText(els.live, label);
  }
  setText(els.digits, done ? formatDuration(run.total / 1000) : formatClock(sec));

  const progress = done ? 1 : 1 - s.remaining / phase.duration;
  els.bar.style.strokeDashoffset = (-100 * Math.min(1, Math.max(0, progress))).toFixed(2);
  // An empty arc still draws its round cap as a dot; hide it once the phase is over.
  els.bar.style.opacity = progress >= 0.999 ? '0' : '1';

  const elapsedMs = done ? run.total : s.phaseStart + (phase.duration - s.remaining);
  setText(els.elapsed, formatDuration(elapsedMs / 1000));
  setText(els.remaining, formatDuration(Math.ceil((run.total - elapsedMs) / 1000)));

  const current = phase?.round ?? set.rounds + 1;
  [...els.dots.children].forEach((dot, i) => {
    const round = i + 1;
    const completed = done || round < current || (round === current && phase?.kind === 'rest');
    dot.classList.toggle('done', completed);
    dot.classList.toggle('active', !completed && round === current && phase?.kind === 'round');
  });

  els.toggle.setAttribute('aria-label', run.status === 'running' ? t('timer.pause') : t('timer.resume'));
  els.doneButtons.hidden = !done;
}

// ---------- confirm dialog (like the app's alert) ----------

const modal = document.querySelector('.modal');
let modalResolve = null;

function confirmAction(title, message, action) {
  if (!run || run.status === 'done') return Promise.resolve(true);
  const wasRunning = run.status === 'running';
  if (wasRunning) pause();
  setText(modal.querySelector('.modal-title'), title);
  setText(modal.querySelector('.modal-text'), message);
  setText(modal.querySelector('[data-modal="ok"]'), action);
  modal.hidden = false;
  modal.querySelector('[data-modal="cancel"]').focus();
  return new Promise((resolve) => {
    modalResolve = (ok) => {
      modal.hidden = true;
      modalResolve = null;
      if (!ok && wasRunning) resume();
      resolve(ok);
    };
  });
}

modal.addEventListener('click', (e) => {
  const choice = e.target.closest('[data-modal]')?.dataset.modal;
  if (choice) modalResolve?.(choice === 'ok');
  else if (e.target === modal) modalResolve?.(false);
});

const exit = async () => {
  if (await confirmAction(t('timer.endTitle'), t('timer.endMessage'), t('timer.endConfirm'))) stop();
};
const askRestart = async () => {
  if (await confirmAction(t('timer.restartTitle'), t('timer.restartMessage'), t('timer.restart'))) restart();
};

runEl.addEventListener('pointerdown', () => {
  if (audio.ctx && audio.ctx.state !== 'running') {
    audio.unlock();
    audio.ctx.resume().then(() => {
      els.soundHint.hidden = true;
      scheduleCues();
    }, () => {});
  }
});

runEl.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act || !run) return;
  if (act === 'toggle') run.status === 'running' ? pause() : resume();
  if (act === 'skip') skip();
  if (act === 'restart') askRestart();
  if (act === 'exit') exit();
  if (act === 'again') restart();
  if (act === 'finish') stop();
  if (act === 'fullscreen') {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else runEl.requestFullscreen?.().catch(() => {});
  }
});

document.addEventListener('keydown', (e) => {
  if (modalResolve) {
    if (e.key === 'Escape') modalResolve(false);
    return;
  }
  if (!run || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest?.('button')) {
    e.preventDefault();
    run.status === 'running' ? pause() : resume();
  } else if (e.key === 'ArrowRight') skip();
  else if (e.key === 'Escape' && !document.fullscreenElement) exit();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !run) return;
  wake.on();
  evaluate();
  if (run.status === 'running') scheduleCues();
});

renderSetup();
