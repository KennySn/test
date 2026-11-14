// js/sounds.js
// Simple procedural sounds using Web Audio API. No external assets required.

let audioCtx = null;
const buffers = {};

export function initSounds() {
    if (audioCtx) return audioCtx;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Pre-render a few buffers
    buffers.gunNoise = createNoiseBuffer(0.12);
    buffers.gunThump = createSineBuffer(0.06, 120, 40);
    buffers.reload = createSineBuffer(0.5, 120, 60);
    buffers.footstep = createNoiseBuffer(0.08);
    buffers.zombieGroan = createZombieBuffer(1.6);
    buffers.ambient = createAmbientBuffer();

    return audioCtx;
}

function createNoiseBuffer(durationSeconds) {
    const ctx = audioCtx;
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * durationSeconds);
    const buf = ctx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * i / length);
    return buf;
}

function createSineBuffer(durationSeconds, startFreq, endFreq) {
    const ctx = audioCtx;
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * durationSeconds);
    const buf = ctx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
        const t = i / sr;
        const f = startFreq + (endFreq - startFreq) * (t / durationSeconds);
        data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-6 * t / durationSeconds);
    }
    return buf;
}

function createZombieBuffer(durationSeconds) {
    const ctx = audioCtx;
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * durationSeconds);
    const buf = ctx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);
    // layered low-frequency rumble + slow fluctuating waveform
    for (let i = 0; i < length; i++) {
        const t = i / sr;
        const lf = Math.sin(2 * Math.PI * 60 * t) * 0.25; // low rumble
        const wobble = Math.sin(2 * Math.PI * 2 * t) * 0.6; // slow
        const growl = Math.tanh(Math.sin(2 * Math.PI * (80 + 30 * wobble) * t));
        data[i] = (growl * 0.6 + lf * 0.4) * Math.exp(-1.2 * t / durationSeconds);
    }
    return buf;
}

function createAmbientBuffer() {
    // Not a buffer per se; we'll create a loopable noise node at play time.
    return null;
}

function playBuffer(buf, opts = {}) {
    if (!audioCtx) initSounds();
    if (!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.value = opts.volume !== undefined ? opts.volume : 0.8;
    src.connect(gain).connect(audioCtx.destination);
    if (opts.detune) src.detune.value = opts.detune;
    src.start();
    if (opts.stopTime) src.stop(audioCtx.currentTime + opts.stopTime);
}

// Public sounds
export function playGunShot() {
    if (!audioCtx) initSounds();
    // noise burst
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffers.gunNoise;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    nGain.gain.exponentialRampToValueAtTime(1.2, audioCtx.currentTime + 0.01);
    nGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    // thump
    const th = audioCtx.createBufferSource();
    th.buffer = buffers.gunThump;
    const tGain = audioCtx.createGain();
    tGain.gain.value = 0.8;

    noise.connect(nGain).connect(audioCtx.destination);
    th.connect(tGain).connect(audioCtx.destination);
    noise.start(); th.start();
}

export function playSMGShot() {
    // Slightly quieter but similar to pistol
    playGunShot();
}

export function playReload() {
    if (!audioCtx) initSounds();
    const buf = buffers.reload;
    if (!buf) return;
    playBuffer(buf, { volume: 0.7 });
}

export function playFootstep() {
    if (!audioCtx) initSounds();
    playBuffer(buffers.footstep, { volume: 0.6 });
}

export function playZombieGroan() {
    if (!audioCtx) initSounds();
    playBuffer(buffers.zombieGroan, { volume: 0.5 });
}

export function startAmbient() {
    if (!audioCtx) initSounds();
    // create a filtered noise that loops
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = createNoiseBuffer(4);
    noiseNode.loop = true;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = 800;
    const g = audioCtx.createGain(); g.gain.value = 0.12;
    noiseNode.connect(bp).connect(g).connect(audioCtx.destination);
    noiseNode.start();
    return noiseNode; // allow stop externally
}

export function resumeOnUserGesture() {
    // call this from a user gesture (click) to resume context on some browsers
    if (!audioCtx) initSounds();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
