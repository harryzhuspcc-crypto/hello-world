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
type Note = { lane: Lane; hitTime: number; hit: boolean; missed: boolean };

const lanes = [
  { key: "ArrowLeft", label: "←", name: "LEFT", color: "#38bdf8" },
  { key: "ArrowDown", label: "↓", name: "DOWN", color: "#a78bfa" },
  { key: "ArrowUp", label: "↑", name: "UP", color: "#34d399" },
  { key: "ArrowRight", label: "→", name: "RIGHT", color: "#fb7185" },
] as const;

function createChart() {
  const notes: Note[] = [];
  let time = 1.6;
  const patterns: Lane[][] = [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [0, 2, 1, 3],
    [1, 3, 0, 2],
    [0, 0, 1, 2, 3, 3],
    [2, 1, 2, 3, 0, 1],
  ];
  for (let section = 0; section < 10; section += 1) {
    const interval = Math.max(0.28, 0.48 - section * 0.018);
    const pattern = patterns[section % patterns.length];
    for (let repeat = 0; repeat < 4; repeat += 1) {
      for (const lane of pattern) {
        notes.push({ lane, hitTime: time, hit: false, missed: false });
        if (section > 2 && repeat % 2 === 1) notes.push({ lane: ((lane + 2) % 4) as Lane, hitTime: time + interval * 0.52, hit: false, missed: false });
        time += interval;
      }
      time += 0.18;
    }
    time += 0.55;
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
      startedAt: performance.now(),
      score: 0,
      combo: 0,
      bestCombo: 0,
      hits: 0,
      misses: 0,
      judgement: "Press the arrow keys when notes reach the glowing line.",
      judgementColor: "#e2e8f0",
      flash: [0, 0, 0, 0],
      shake: 0,
    };

    const reset = () => {
      state.notes = createChart();
      state.startedAt = performance.now();
      state.score = 0;
      state.combo = 0;
      state.bestCombo = 0;
      state.hits = 0;
      state.misses = 0;
      state.judgement = "Restarted — catch the falling arrows.";
      state.judgementColor = "#e2e8f0";
      state.flash = [0, 0, 0, 0];
      state.shake = 0;
    };

    const judge = (lane: Lane) => {
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
        judge(lane as Lane);
      } else if (event.code === "KeyR") {
        event.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKeyDown);

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
      const elapsed = (performance.now() - state.startedAt) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      state.shake = Math.max(0, state.shake - 0.8);

      for (const note of state.notes) {
        if (!note.hit && !note.missed && elapsed - note.hitTime > 0.22) {
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
      const travelTime = 2.05;
      const speed = (hitY - topY) / travelTime;

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
        const y = hitY - (note.hitTime - elapsed) * speed;
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
      window.removeEventListener("resize", resize);
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
          <p className="mt-1 text-sm font-semibold text-slate-300">Press ← ↓ ↑ → as notes hit the gold line</p>
        </div>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute left-6 top-28 z-20 grid w-72 gap-3 rounded-[1.5rem] border border-white/10 bg-black/55 p-5 text-sm shadow-2xl backdrop-blur [&_div]:flex [&_div]:items-center [&_div]:justify-between [&_strong]:text-xl [&_strong]:font-black" />
      <div ref={messageRef} className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-8 py-4 text-3xl font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur">Ready</div>
      <div className="pointer-events-none absolute bottom-6 right-6 z-20 rounded-full border border-white/10 bg-black/45 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-300 backdrop-blur">R Restart</div>
    </main>
  );
}
