import { Link } from "react-router";
import { useEffect, useRef } from "react";

import type { Route } from "./+types/rhythm-rush";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rhythm Rush | Harry's Game Center" },
    { name: "description", content: "A polished arrow-key rhythm game with falling notes, combos, and accuracy scoring." },
  ];
}

type Lane = 0 | 1 | 2 | 3;
type Note = { lane: Lane; hitTime: number; hit: boolean; missed: boolean; travelTime: number };

const lanes = [
  { key: "ArrowLeft", label: "←", name: "LEFT", color: "#38bdf8" },
  { key: "ArrowDown", label: "↓", name: "DOWN", color: "#a78bfa" },
  { key: "ArrowUp", label: "↑", name: "UP", color: "#34d399" },
  { key: "ArrowRight", label: "→", name: "RIGHT", color: "#fb7185" },
] as const;

function createChart() {
  const notes: Note[] = [];
  let time = 1.25;
  const add = (lane: Lane, hitTime: number, travelTime: number) => notes.push({ lane, hitTime, travelTime, hit: false, missed: false });
  const addChord = (chord: Lane[], hitTime: number, travelTime: number) => chord.forEach((lane) => add(lane, hitTime, travelTime));
  const sections: Array<{ interval: number; travel: number; pattern: Array<Lane | Lane[]>; repeats: number; rest: number }> = [
    { interval: 0.82, travel: 2.55, pattern: [0, 1, 2, 3], repeats: 2, rest: 0.75 },
    { interval: 0.68, travel: 2.35, pattern: [0, 1, 2, 3, 3, 2, 1, 0], repeats: 2, rest: 0.55 },
    { interval: 0.56, travel: 2.12, pattern: [0, 2, 1, 3, 1, 2, 0, 3], repeats: 2, rest: 0.45 },
    { interval: 0.48, travel: 1.92, pattern: [0, 1, [2, 3], 2, 3, 1, [0, 2], 3], repeats: 2, rest: 0.38 },
    { interval: 0.40, travel: 1.72, pattern: [0, [1, 3], 2, 0, 3, [0, 2], 1, 3], repeats: 3, rest: 0.32 },
    { interval: 0.34, travel: 1.52, pattern: [[0, 3], 1, 2, [0, 2], 3, 1, [1, 3], 0], repeats: 3, rest: 0.24 },
    { interval: 0.29, travel: 1.34, pattern: [0, 1, [2, 3], 2, [0, 1], 3, 2, [0, 3], 1, 2], repeats: 4, rest: 0.18 },
  ];

  for (const section of sections) {
    for (let repeat = 0; repeat < section.repeats; repeat += 1) {
      for (const item of section.pattern) {
        if (Array.isArray(item)) addChord(item, time, section.travel);
        else add(item, time, section.travel);
        time += section.interval;
      }
      time += section.rest;
    }
  }
  return notes;
}

export default function RhythmRush() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const state = {
      notes: createChart(),
      started: false,
      startedAt: performance.now(),
      score: 0,
      combo: 0,
      bestCombo: 0,
      hits: 0,
      misses: 0,
      judgement: "Press Space or any arrow to start the soundtrack.",
      judgementColor: "#e2e8f0",
      flash: [0, 0, 0, 0],
      shake: 0,
      audioCtx: null as AudioContext | null,
      master: null as GainNode | null,
      nextBeatGame: 0,
      beatIndex: 0,
    };

    const ensureAudio = () => {
      if (state.audioCtx) return state.audioCtx;
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      const audioCtx = new AudioContextClass();
      const master = audioCtx.createGain();
      master.gain.value = 0.22;
      master.connect(audioCtx.destination);
      state.audioCtx = audioCtx;
      state.master = master;
      return audioCtx;
    };

    const playTone = (frequency: number, start: number, duration: number, type: OscillatorType, volume: number) => {
      const audioCtx = state.audioCtx;
      const master = state.master;
      if (!audioCtx || !master) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    };

    const playNoise = (start: number, duration: number, volume: number) => {
      const audioCtx = state.audioCtx;
      const master = state.master;
      if (!audioCtx || !master) return;
      const buffer = audioCtx.createBuffer(1, Math.max(1, Math.floor(audioCtx.sampleRate * duration)), audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 5200;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    };

    const soundtrackBpm = (elapsed: number) => Math.min(168, 82 + elapsed * 1.45);
    const scheduleSoundtrack = (elapsed: number) => {
      const audioCtx = state.audioCtx;
      if (!audioCtx || !state.master || !state.started) return;
      while (state.nextBeatGame < elapsed + 0.35) {
        const start = audioCtx.currentTime + Math.max(0, state.nextBeatGame - elapsed);
        const beat = state.beatIndex;
        const bass = [55, 65.41, 73.42, 49][Math.floor(beat / 8) % 4];
        if (beat % 4 === 0) {
          playTone(58, start, 0.16, "sine", 0.75);
          playTone(bass, start, 0.28, "sawtooth", 0.18);
        }
        if (beat % 4 === 2) playNoise(start, 0.12, 0.22);
        playNoise(start + 0.01, 0.035, beat % 2 === 0 ? 0.06 : 0.04);
        if (beat % 8 === 0) [261.63, 329.63, 392.0].forEach((freq) => playTone(freq, start + 0.02, 0.42, "triangle", 0.045));
        if (beat % 8 === 4) [293.66, 349.23, 440.0].forEach((freq) => playTone(freq, start + 0.02, 0.38, "triangle", 0.04));
        if (elapsed > 18 && beat % 2 === 1) playTone([523.25, 587.33, 659.25, 783.99][beat % 4], start, 0.09, "square", 0.035);
        state.beatIndex += 1;
        state.nextBeatGame += 60 / soundtrackBpm(state.nextBeatGame);
      }
    };

    const startGame = () => {
      if (state.started) return;
      const audioCtx = ensureAudio();
      void audioCtx?.resume();
      state.started = true;
      state.startedAt = performance.now();
      state.nextBeatGame = 0;
      state.beatIndex = 0;
      state.judgement = "Easy intro — single notes first, then faster double notes.";
      state.judgementColor = "#34d399";
    };

    const reset = (startNow = false) => {
      state.notes = createChart();
      state.started = startNow;
      state.startedAt = performance.now();
      state.score = 0;
      state.combo = 0;
      state.bestCombo = 0;
      state.hits = 0;
      state.misses = 0;
      state.judgement = startNow ? "Restarted — soundtrack rolling." : "Press Space or any arrow to start the soundtrack.";
      state.judgementColor = "#e2e8f0";
      state.flash = [0, 0, 0, 0];
      state.shake = 0;
      state.nextBeatGame = 0;
      state.beatIndex = 0;
      if (startNow) {
        const audioCtx = ensureAudio();
        void audioCtx?.resume();
      }
    };

    const judge = (lane: Lane) => {
      if (!state.started) return;
      const elapsed = (performance.now() - state.startedAt) / 1000;
      let best: Note | undefined;
      let bestDiff = Infinity;
      for (const note of state.notes) {
        if (note.lane !== lane || note.hit || note.missed) continue;
        const diff = Math.abs(note.hitTime - elapsed);
        if (diff < bestDiff) {
          best = note;
          bestDiff = diff;
        }
      }

      if (!best || bestDiff > 0.19) {
        state.combo = 0;
        state.misses += 1;
        state.judgement = "MISS";
        state.judgementColor = "#fb7185";
        state.shake = 12;
        return;
      }

      best.hit = true;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.hits += 1;
      state.flash[lane] = 1;

      if (bestDiff <= 0.055) {
        state.score += 1000 + state.combo * 12;
        state.judgement = "PERFECT";
        state.judgementColor = "#facc15";
      } else if (bestDiff <= 0.11) {
        state.score += 700 + state.combo * 8;
        state.judgement = "GREAT";
        state.judgementColor = "#34d399";
      } else {
        state.score += 400 + state.combo * 4;
        state.judgement = "GOOD";
        state.judgementColor = "#38bdf8";
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const lane = lanes.findIndex((item) => item.key === event.key);
      if (lane >= 0) {
        event.preventDefault();
        if (!state.started) {
          startGame();
          return;
        }
        judge(lane as Lane);
      } else if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        startGame();
      } else if (event.code === "KeyR") {
        event.preventDefault();
        reset(true);
      }
    };
    const onPointerDown = () => startGame();
    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let frame = 0;
    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };

    const tick = () => {
      const elapsed = state.started ? (performance.now() - state.startedAt) / 1000 : 0;
      scheduleSoundtrack(elapsed);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      state.shake = Math.max(0, state.shake - 0.8);

      for (const note of state.notes) {
        if (state.started && !note.hit && !note.missed && elapsed - note.hitTime > 0.22) {
          note.missed = true;
          state.combo = 0;
          state.misses += 1;
          state.judgement = "MISS";
          state.judgementColor = "#fb7185";
        }
      }

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.42, "#111827");
      bg.addColorStop(1, "#312e81");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(shakeX, 0);
      for (let i = 0; i < 34; i += 1) {
        ctx.fillStyle = `rgba(56,189,248,${0.04 + (i % 4) * 0.015})`;
        ctx.beginPath();
        ctx.arc((i * 173 + elapsed * 18) % (w + 120) - 60, (i * 97) % h, 1.5 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }

      const boardW = Math.min(640, w - 48);
      const boardX = (w - boardW) / 2;
      const laneW = boardW / 4;
      const topY = 96;
      const hitY = h - 165;
      const previewTravelTime = state.notes.find((note) => !note.hit && !note.missed && note.hitTime >= elapsed)?.travelTime ?? 1.35;
      const speed = (hitY - topY) / previewTravelTime;

      ctx.fillStyle = "rgba(15,23,42,0.74)";
      drawRoundedRect(boardX - 18, 70, boardW + 36, h - 118, 32);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX - 10, 82, boardW + 20, h - 142);

      for (let lane = 0; lane < 4; lane += 1) {
        const x = boardX + lane * laneW;
        const flash = state.flash[lane];
        state.flash[lane] = Math.max(0, flash - 0.06);
        ctx.fillStyle = lane % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.075)";
        ctx.fillRect(x, 86, laneW, h - 150);
        if (flash > 0) {
          ctx.fillStyle = `${lanes[lane].color}${Math.round(flash * 120).toString(16).padStart(2, "0")}`;
          ctx.fillRect(x, 86, laneW, h - 150);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath();
        ctx.moveTo(x, 86);
        ctx.lineTo(x, h - 64);
        ctx.stroke();

        ctx.fillStyle = "rgba(2,6,23,0.84)";
        drawRoundedRect(x + 12, hitY - 34, laneW - 24, 68, 18);
        ctx.strokeStyle = lanes[lane].color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = "900 34px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lanes[lane].label, x + laneW / 2, hitY + 12);
      }

      ctx.shadowBlur = 22;
      ctx.shadowColor = "#facc15";
      ctx.fillStyle = "rgba(250,204,21,0.85)";
      ctx.fillRect(boardX, hitY - 3, boardW, 6);
      ctx.shadowBlur = 0;

      for (const note of state.notes) {
        if (note.hit || note.missed) continue;
        const noteSpeed = (hitY - topY) / note.travelTime;
        const y = hitY - (note.hitTime - elapsed) * noteSpeed;
        if (y < topY - 80 || y > h + 80) continue;
        const x = boardX + note.lane * laneW + laneW / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.shadowColor = lanes[note.lane].color;
        ctx.shadowBlur = 24;
        ctx.fillStyle = lanes[note.lane].color;
        ctx.beginPath();
        ctx.roundRect(-34, -30, 68, 60, 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#020617";
        ctx.font = "900 34px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(lanes[note.lane].label, 0, 2);
        ctx.restore();
      }

      ctx.restore();

      if (!state.started) {
        ctx.fillStyle = "rgba(2,6,23,0.72)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "900 52px Inter, sans-serif";
        ctx.fillText("Rhythm Rush", w / 2, h / 2 - 68);
        ctx.font = "900 20px Inter, sans-serif";
        ctx.fillStyle = "#bae6fd";
        ctx.fillText("Press SPACE, ENTER, click, or any arrow key to start the soundtrack", w / 2, h / 2 - 18);
        ctx.font = "700 16px Inter, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText("It begins really easy, then speeds up with double-note hits.", w / 2, h / 2 + 24);
      }

      const totalJudged = state.hits + state.misses;
      const accuracy = totalJudged ? Math.round((state.hits / totalJudged) * 100) : 100;
      if (hudRef.current) {
        hudRef.current.innerHTML = `<div><span class="text-slate-400">Score</span><strong>${state.score.toLocaleString()}</strong></div><div><span class="text-slate-400">Combo</span><strong>${state.combo}</strong></div><div><span class="text-slate-400">Best</span><strong>${state.bestCombo}</strong></div><div><span class="text-slate-400">Accuracy</span><strong>${accuracy}%</strong></div>`;
      }
      if (messageRef.current) {
        messageRef.current.textContent = state.judgement;
        messageRef.current.style.color = state.judgementColor;
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", resize);
      void state.audioCtx?.close();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6">
        <div className="pointer-events-auto flex gap-3">
          <Link className="rounded-full border border-white/10 bg-black/45 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] backdrop-blur transition hover:bg-white/10" to="/">← Lobby</Link>
        </div>
        <div className="rounded-[1.5rem] border border-cyan-200/20 bg-black/50 px-6 py-4 text-right shadow-2xl backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">Free Game</p>
          <h1 className="text-3xl font-black">Rhythm Rush</h1>
          <p className="mt-1 text-sm font-semibold text-slate-300">Soundtrack starts easy, then speeds up with double notes</p>
        </div>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute left-6 top-28 z-20 grid w-72 gap-3 rounded-[1.5rem] border border-white/10 bg-black/55 p-5 text-sm shadow-2xl backdrop-blur [&_div]:flex [&_div]:items-center [&_div]:justify-between [&_strong]:text-xl [&_strong]:font-black" />
      <div ref={messageRef} className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-8 py-4 text-3xl font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur">Ready</div>
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 rounded-full border border-white/10 bg-black/45 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-300 backdrop-blur">Space Start • R Restart</div>
    </main>
  );
}
