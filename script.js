// ---------- Cor da vela ----------
const colorPicker = document.getElementById('colorPicker');
const swatchesEl = document.getElementById('swatches');

const PRESET_COLORS = [
  '#b0223a', '#f4efe3', '#1f6f5c', '#2c4a7c',
  '#c9a35a', '#6b3fa0', '#e8895c', '#1a1a1a',
];

function setWaxColor(hex){
  document.documentElement.style.setProperty('--wax', hex);
  colorPicker.value = hex;
  [...swatchesEl.children].forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.color.toLowerCase() === hex.toLowerCase());
  });
}

PRESET_COLORS.forEach(color => {
  const btn = document.createElement('button');
  btn.className = 'swatch';
  btn.type = 'button';
  btn.style.background = color;
  btn.dataset.color = color;
  btn.setAttribute('aria-label', `Cor da vela ${color}`);
  btn.addEventListener('click', () => setWaxColor(color));
  swatchesEl.appendChild(btn);
});

colorPicker.addEventListener('input', (e) => setWaxColor(e.target.value));
setWaxColor(colorPicker.value);

// ---------- Elementos da vela ----------
const candleBody = document.getElementById('candleBody');
const meltPool = document.getElementById('meltPool');
const flameZone = document.getElementById('flameZone');
const flameOuter = document.getElementById('flameOuter');
const flameInner = document.getElementById('flameInner');
const flameCore = document.getElementById('flameCore');

const MAX_HEIGHT = 210;
const MIN_HEIGHT = 30;

function updateCandleVisual(fraction){
  const height = MIN_HEIGHT + fraction * (MAX_HEIGHT - MIN_HEIGHT);
  candleBody.style.height = height + 'px';
  const burned = 1 - fraction;
  meltPool.style.width = (54 + burned * 30) + 'px';
  meltPool.style.opacity = String(0.9 - burned * 0.15);
}

function spawnDrip(){
  const drip = document.createElement('div');
  drip.className = 'drip-run';
  const usableWidth = candleBody.offsetWidth - 20;
  drip.style.left = (8 + Math.random() * usableWidth) + 'px';
  candleBody.appendChild(drip);
  setTimeout(() => drip.remove(), 3600);
}

function spawnSmoke(){
  const smoke = document.createElement('div');
  smoke.className = 'smoke';
  flameZone.appendChild(smoke);
  setTimeout(() => smoke.remove(), 2700);
}

function setCandleLit(lit){
  if (lit) {
    flameZone.classList.remove('is-out');
  } else {
    flameZone.classList.add('is-out');
    spawnSmoke();
    setTimeout(spawnSmoke, 450);
  }
}

// ---------- Chama: balanço orgânico (vento + flicker) ----------
let windTarget = 0;
let windCurrent = 0;
let windTimer = 0;
let lastTime = performance.now();

function applyFlameTransform(el, lean, phase, amp){
  const t = performance.now() / 1000;
  const fast = Math.sin(t * 7 + phase) * 1.4 * amp + Math.sin(t * 3.3 + phase * 1.7) * 0.9 * amp;
  const scaleX = 1 + Math.sin(t * 5 + phase) * 0.035 * amp;
  const scaleY = 1 - Math.sin(t * 5 + phase) * 0.045 * amp;
  const drift = Math.sin(t * 1.3 + phase) * 1.3 * amp;
  el.style.transform = `translateX(${drift}px) rotate(${lean + fast}deg) scale(${scaleX}, ${scaleY})`;
}

function flameFrame(now){
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  windTimer -= dt;
  if (windTimer <= 0){
    windTarget = (Math.random() - 0.5) * 11;
    windTimer = 0.35 + Math.random() * 0.75;
  }
  windCurrent += (windTarget - windCurrent) * Math.min(dt * 2.4, 1);

  applyFlameTransform(flameOuter, windCurrent, 0, 1);
  applyFlameTransform(flameInner, windCurrent * 0.7, 1.1, 0.75);
  applyFlameTransform(flameCore, windCurrent * 0.4, 2.3, 0.5);

  if (pomodoro.phase === 'work' && pomodoro.running){
    dripTimer -= dt;
    if (dripTimer <= 0){
      spawnDrip();
      dripTimer = 2 + Math.random() * 3;
    }
  }

  requestAnimationFrame(flameFrame);
}
let dripTimer = 2;
requestAnimationFrame(flameFrame);

// ---------- Pomodoro ----------
const PRESETS = {
  curto:    { label: 'Curto',    work: 15 * 60, brk: 5 * 60 },
  classico: { label: 'Clássico', work: 25 * 60, brk: 5 * 60 },
  longo:    { label: 'Longo',    work: 50 * 60, brk: 10 * 60 },
  maratona: { label: 'Maratona', work: 90 * 60, brk: 15 * 60 },
};

const phaseLabel = document.getElementById('phaseLabel');
const timerDisplay = document.getElementById('timerDisplay');
const presetSelect = document.getElementById('presetSelect');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');

const pomodoro = {
  presetKey: 'classico',
  phase: 'work',       // 'work' | 'break'
  totalPhase: PRESETS.classico.work,
  timeLeft: PRESETS.classico.work,
  running: false,
};

// ---------- Motor de áudio (tudo gerado ao vivo, sem arquivos externos) ----------
const fireSoundToggle = document.getElementById('fireSoundToggle');
const focusSoundSelect = document.getElementById('focusSoundSelect');
const volumeRange = document.getElementById('volumeRange');

let audioCtx = null;
let masterGain = null;
let fireBedGain = null;
let noiseGain = null;
let pianoBus = null;

// Escala pentatônica suave, em duas oitavas — qualquer combinação de notas soa consonante
const SCALE = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

function soundShouldPlay(){
  return pomodoro.running && pomodoro.phase === 'work';
}

function createWhiteNoiseBuffer(ctx, seconds){
  const bufferSize = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createSoftNoiseBuffer(ctx, seconds){
  const bufferSize = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 2.2;
  }
  return buffer;
}

function initAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = volumeRange.value / 100;
  masterGain.connect(audioCtx.destination);

  // Cama contínua de "chiado" do fogo
  const fireBed = audioCtx.createBufferSource();
  fireBed.buffer = createWhiteNoiseBuffer(audioCtx, 2);
  fireBed.loop = true;
  const fireFilter = audioCtx.createBiquadFilter();
  fireFilter.type = 'lowpass';
  fireFilter.frequency.value = 1000;
  fireBedGain = audioCtx.createGain();
  fireBedGain.gain.value = 0;
  fireBed.connect(fireFilter).connect(fireBedGain).connect(masterGain);
  fireBed.start();

  // Ruído suave (opção alternativa ao piano)
  const noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = createSoftNoiseBuffer(audioCtx, 4);
  noiseSrc.loop = true;
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 500;
  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0;
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(masterGain);
  noiseSrc.start();

  // Barramento do piano ambiente
  pianoBus = audioCtx.createGain();
  pianoBus.gain.value = 0;
  pianoBus.connect(masterGain);

  scheduleCrackle();
  scheduleNotes();
}

function spawnCracklePop(){
  if (!audioCtx) return;
  const dur = 0.05 + Math.random() * 0.09;
  const src = audioCtx.createBufferSource();
  src.buffer = createWhiteNoiseBuffer(audioCtx, dur);
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700 + Math.random() * 2300;
  bp.Q.value = 5;
  const g = audioCtx.createGain();
  const peak = 0.12 + Math.random() * 0.18;
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bp).connect(g).connect(masterGain);
  src.start();
  src.stop(now + dur + 0.02);
}

function scheduleCrackle(){
  const delay = 220 + Math.random() * 900;
  setTimeout(() => {
    if (fireSoundToggle.checked && soundShouldPlay()) spawnCracklePop();
    scheduleCrackle();
  }, delay);
}

function playPianoNote(freq){
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const release = 3.2 + Math.random() * 1.6;

  const noteGain = audioCtx.createGain();
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.linearRampToValueAtTime(0.3, now + 0.03);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + release);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;

  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;

  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  const overtoneGain = audioCtx.createGain();
  overtoneGain.gain.value = 0.16;

  osc1.connect(filter);
  osc2.connect(overtoneGain).connect(filter);
  filter.connect(noteGain).connect(pianoBus);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + release + 0.3);
  osc2.stop(now + release + 0.3);
}

function scheduleNotes(){
  const delay = 1800 + Math.random() * 2800;
  setTimeout(() => {
    if (focusSoundSelect.value === 'piano' && soundShouldPlay()){
      const freq = SCALE[Math.floor(Math.random() * SCALE.length)];
      playPianoNote(freq);
      if (Math.random() < 0.3){
        setTimeout(() => {
          if (focusSoundSelect.value === 'piano' && soundShouldPlay()){
            playPianoNote(SCALE[Math.floor(Math.random() * SCALE.length)]);
          }
        }, 60);
      }
    }
    scheduleNotes();
  }, delay);
}

function updateAudioGains(){
  if (!audioCtx) return;
  const active = soundShouldPlay();
  const t = audioCtx.currentTime;
  const fireTarget = fireSoundToggle.checked && active ? 0.16 : 0;
  const noiseTarget = focusSoundSelect.value === 'noise' && active ? 0.12 : 0;
  const pianoTarget = focusSoundSelect.value === 'piano' && active ? 0.9 : 0;
  fireBedGain.gain.setTargetAtTime(fireTarget, t, 0.4);
  noiseGain.gain.setTargetAtTime(noiseTarget, t, 0.4);
  pianoBus.gain.setTargetAtTime(pianoTarget, t, 0.6);
}

[fireSoundToggle, focusSoundSelect].forEach(el => {
  el.addEventListener('change', () => { initAudio(); updateAudioGains(); });
});
volumeRange.addEventListener('input', () => {
  initAudio();
  masterGain.gain.value = volumeRange.value / 100;
});

function beep(){
  try{
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    osc.connect(gain).connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }catch(e){ /* som é só um extra, sem problema se falhar */ }
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
}

function formatTime(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function renderPomodoro(){
  timerDisplay.textContent = formatTime(pomodoro.timeLeft);
  phaseLabel.textContent = pomodoro.phase === 'work' ? 'Hora de estudar' : 'Pausa — descanse os olhos';
  const fraction = pomodoro.phase === 'work'
    ? pomodoro.timeLeft / pomodoro.totalPhase
    : 1;
  updateCandleVisual(fraction);
  setCandleLit(pomodoro.phase === 'work');
  startPauseBtn.textContent = pomodoro.running ? 'Pausar' : 'Iniciar';
  updateAudioGains();
}

function goToPhase(phase){
  pomodoro.phase = phase;
  const preset = PRESETS[pomodoro.presetKey];
  pomodoro.totalPhase = phase === 'work' ? preset.work : preset.brk;
  pomodoro.timeLeft = pomodoro.totalPhase;
  beep();
  renderPomodoro();
}

function tick(){
  if (!pomodoro.running) return;
  pomodoro.timeLeft -= 1;
  if (pomodoro.timeLeft <= 0){
    goToPhase(pomodoro.phase === 'work' ? 'break' : 'work');
  } else {
    renderPomodoro();
  }
}
setInterval(tick, 1000);

startPauseBtn.addEventListener('click', () => {
  initAudio();
  pomodoro.running = !pomodoro.running;
  if (pomodoro.running) beep();
  renderPomodoro();
});

resetBtn.addEventListener('click', () => {
  pomodoro.running = false;
  pomodoro.phase = 'work';
  pomodoro.totalPhase = PRESETS[pomodoro.presetKey].work;
  pomodoro.timeLeft = pomodoro.totalPhase;
  renderPomodoro();
});

presetSelect.addEventListener('change', () => {
  pomodoro.presetKey = presetSelect.value;
  if (!pomodoro.running){
    pomodoro.phase = 'work';
    pomodoro.totalPhase = PRESETS[pomodoro.presetKey].work;
    pomodoro.timeLeft = pomodoro.totalPhase;
    renderPomodoro();
  }
});

renderPomodoro();

// ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}