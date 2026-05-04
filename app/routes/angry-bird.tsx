import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/angry-bird";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Feather Fling | Harry's Game Center" },
    {
      name: "description",
      content: "A polished slingshot physics game with birds, breakable towers, and grumpy pig targets.",
    },
  ];
}

type Vec = { x: number; y: number };
type BlockKind = "wood" | "stone" | "glass";
type Block = { x: number; y: number; w: number; h: number; hp: number; maxHp: number; kind: BlockKind; wobble: number };
type Target = { x: number; y: number; r: number; hp: number; maxHp: number; pop: number };
type Bird = { x: number; y: number; vx: number; vy: number; r: number; trail: Vec[]; spin: number };
type Level = {
  name: string;
  birds: number;
  blocks: Array<{ x: number; y: number; w: number; h: number; hp: number; kind: BlockKind }>;
  targets: Array<{ x: number; y: number; r: number; hp: number }>;
};

const WORLD_W = 1000;
const WORLD_H = 600;
const GROUND_Y = 520;
const ANCHOR: Vec = { x: 155, y: 365 };
const MAX_PULL = 155;
const LAUNCH_POWER = 7.15;
const TARGET_HIT_PAD = 10;

const levels: Level[] = [
  {
    name: "Meadow First Shot",
    birds: 3,
    blocks: [
      { x: 690, y: 430, w: 30, h: 90, hp: 2, kind: "wood" },
      { x: 790, y: 430, w: 30, h: 90, hp: 2, kind: "wood" },
      { x: 670, y: 385, w: 150, h: 28, hp: 2, kind: "wood" },
    ],
    targets: [{ x: 745, y: 355, r: 26, hp: 1 }],
  },
  {
    name: "Twin Tower Trouble",
    birds: 4,
    blocks: [
      { x: 650, y: 440, w: 28, h: 80, hp: 2, kind: "wood" },
      { x: 725, y: 440, w: 28, h: 80, hp: 2, kind: "wood" },
      { x: 625, y: 402, w: 128, h: 24, hp: 2, kind: "glass" },
      { x: 835, y: 420, w: 34, h: 100, hp: 3, kind: "stone" },
      { x: 900, y: 420, w: 34, h: 100, hp: 3, kind: "stone" },
      { x: 813, y: 374, w: 112, h: 26, hp: 3, kind: "wood" },
    ],
    targets: [
      { x: 688, y: 374, r: 23, hp: 1 },
      { x: 868, y: 344, r: 24, hp: 1 },
    ],
  },
  {
    name: "Glass House",
    birds: 4,
    blocks: [
      { x: 610, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 670, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 730, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 790, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 585, y: 404, w: 250, h: 24, hp: 2, kind: "glass" },
      { x: 640, y: 358, w: 140, h: 24, hp: 2, kind: "wood" },
    ],
    targets: [
      { x: 642, y: 377, r: 22, hp: 1 },
      { x: 760, y: 377, r: 22, hp: 1 },
    ],
  },
  {
    name: "Stone Fort",
    birds: 5,
    blocks: [
      { x: 650, y: 430, w: 38, h: 90, hp: 4, kind: "stone" },
      { x: 800, y: 430, w: 38, h: 90, hp: 4, kind: "stone" },
      { x: 626, y: 383, w: 214, h: 30, hp: 4, kind: "stone" },
      { x: 702, y: 330, w: 62, h: 52, hp: 3, kind: "wood" },
      { x: 715, y: 280, w: 36, h: 50, hp: 3, kind: "stone" },
    ],
    targets: [
      { x: 725, y: 354, r: 25, hp: 2 },
      { x: 735, y: 252, r: 22, hp: 1 },
    ],
  },
  {
    name: "Hilltop Ambush",
    birds: 5,
    blocks: [
      { x: 575, y: 455, w: 140, h: 26, hp: 2, kind: "wood" },
      { x: 620, y: 395, w: 24, h: 85, hp: 2, kind: "wood" },
      { x: 690, y: 395, w: 24, h: 85, hp: 2, kind: "wood" },
      { x: 830, y: 422, w: 30, h: 98, hp: 3, kind: "stone" },
      { x: 895, y: 422, w: 30, h: 98, hp: 3, kind: "stone" },
      { x: 803, y: 370, w: 120, h: 28, hp: 2, kind: "wood" },
    ],
    targets: [
      { x: 655, y: 365, r: 24, hp: 1 },
      { x: 862, y: 340, r: 24, hp: 2 },
      { x: 910, y: 492, r: 20, hp: 1 },
    ],
  },
  {
    name: "Crystal Castle",
    birds: 5,
    blocks: [
      { x: 620, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 680, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 740, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 800, y: 445, w: 24, h: 75, hp: 1, kind: "glass" },
      { x: 595, y: 398, w: 230, h: 22, hp: 2, kind: "glass" },
      { x: 640, y: 350, w: 145, h: 24, hp: 2, kind: "glass" },
      { x: 695, y: 298, w: 36, h: 52, hp: 2, kind: "wood" },
    ],
    targets: [
      { x: 650, y: 370, r: 22, hp: 1 },
      { x: 773, y: 370, r: 22, hp: 1 },
      { x: 713, y: 270, r: 22, hp: 2 },
    ],
  },
  {
    name: "Goblin Keep",
    birds: 6,
    blocks: [
      { x: 600, y: 430, w: 36, h: 90, hp: 3, kind: "wood" },
      { x: 695, y: 430, w: 36, h: 90, hp: 4, kind: "stone" },
      { x: 790, y: 430, w: 36, h: 90, hp: 4, kind: "stone" },
      { x: 885, y: 430, w: 36, h: 90, hp: 3, kind: "wood" },
      { x: 574, y: 384, w: 345, h: 26, hp: 4, kind: "stone" },
      { x: 628, y: 335, w: 238, h: 24, hp: 3, kind: "wood" },
      { x: 682, y: 284, w: 130, h: 24, hp: 2, kind: "glass" },
      { x: 730, y: 230, w: 34, h: 54, hp: 3, kind: "stone" },
    ],
    targets: [
      { x: 650, y: 356, r: 23, hp: 1 },
      { x: 745, y: 304, r: 24, hp: 2 },
      { x: 855, y: 356, r: 23, hp: 1 },
      { x: 748, y: 199, r: 27, hp: 3 },
    ],
  },
  {
    name: "Canyon Crash",
    birds: 6,
    blocks: [
      { x: 580, y: 455, w: 120, h: 26, hp: 2, kind: "wood" },
      { x: 620, y: 395, w: 30, h: 86, hp: 2, kind: "wood" },
      { x: 720, y: 435, w: 34, h: 85, hp: 3, kind: "stone" },
      { x: 810, y: 435, w: 34, h: 85, hp: 3, kind: "stone" },
      { x: 692, y: 390, w: 150, h: 26, hp: 2, kind: "glass" },
      { x: 875, y: 455, w: 82, h: 26, hp: 2, kind: "wood" },
    ],
    targets: [
      { x: 646, y: 365, r: 24, hp: 1 },
      { x: 765, y: 361, r: 24, hp: 1 },
      { x: 920, y: 491, r: 22, hp: 1 },
    ],
  },
  {
    name: "Wooden Maze",
    birds: 6,
    blocks: [
      { x: 590, y: 430, w: 28, h: 90, hp: 2, kind: "wood" },
      { x: 650, y: 430, w: 28, h: 90, hp: 2, kind: "wood" },
      { x: 710, y: 430, w: 28, h: 90, hp: 2, kind: "wood" },
      { x: 770, y: 430, w: 28, h: 90, hp: 2, kind: "wood" },
      { x: 560, y: 385, w: 245, h: 24, hp: 3, kind: "wood" },
      { x: 620, y: 335, w: 170, h: 24, hp: 2, kind: "glass" },
      { x: 850, y: 430, w: 35, h: 90, hp: 4, kind: "stone" },
    ],
    targets: [
      { x: 620, y: 356, r: 22, hp: 1 },
      { x: 735, y: 356, r: 22, hp: 1 },
      { x: 867, y: 399, r: 24, hp: 1 },
    ],
  },
  {
    name: "Stone Staircase",
    birds: 7,
    blocks: [
      { x: 610, y: 470, w: 80, h: 30, hp: 3, kind: "stone" },
      { x: 675, y: 425, w: 80, h: 30, hp: 3, kind: "stone" },
      { x: 740, y: 380, w: 80, h: 30, hp: 3, kind: "stone" },
      { x: 805, y: 335, w: 80, h: 30, hp: 3, kind: "stone" },
      { x: 640, y: 390, w: 24, h: 130, hp: 2, kind: "wood" },
      { x: 770, y: 330, w: 24, h: 190, hp: 2, kind: "wood" },
      { x: 890, y: 430, w: 28, h: 90, hp: 2, kind: "glass" },
    ],
    targets: [
      { x: 648, y: 362, r: 23, hp: 1 },
      { x: 778, y: 302, r: 23, hp: 1 },
      { x: 902, y: 402, r: 23, hp: 1 },
    ],
  },
  {
    name: "Glass Gauntlet",
    birds: 7,
    blocks: [
      { x: 585, y: 450, w: 22, h: 70, hp: 1, kind: "glass" },
      { x: 640, y: 450, w: 22, h: 70, hp: 1, kind: "glass" },
      { x: 695, y: 450, w: 22, h: 70, hp: 1, kind: "glass" },
      { x: 750, y: 450, w: 22, h: 70, hp: 1, kind: "glass" },
      { x: 805, y: 450, w: 22, h: 70, hp: 1, kind: "glass" },
      { x: 560, y: 410, w: 292, h: 22, hp: 2, kind: "glass" },
      { x: 620, y: 360, w: 190, h: 22, hp: 2, kind: "glass" },
      { x: 680, y: 310, w: 75, h: 22, hp: 2, kind: "wood" },
    ],
    targets: [
      { x: 610, y: 383, r: 22, hp: 1 },
      { x: 724, y: 332, r: 22, hp: 1 },
      { x: 815, y: 383, r: 22, hp: 1 },
      { x: 930, y: 492, r: 22, hp: 1 },
    ],
  },
  {
    name: "King Pig Castle",
    birds: 8,
    blocks: [
      { x: 570, y: 430, w: 36, h: 90, hp: 3, kind: "wood" },
      { x: 655, y: 430, w: 36, h: 90, hp: 4, kind: "stone" },
      { x: 740, y: 430, w: 36, h: 90, hp: 4, kind: "stone" },
      { x: 825, y: 430, w: 36, h: 90, hp: 4, kind: "stone" },
      { x: 910, y: 430, w: 36, h: 90, hp: 3, kind: "wood" },
      { x: 540, y: 383, w: 405, h: 28, hp: 4, kind: "stone" },
      { x: 600, y: 330, w: 285, h: 26, hp: 3, kind: "wood" },
      { x: 670, y: 276, w: 150, h: 24, hp: 2, kind: "glass" },
      { x: 720, y: 218, w: 48, h: 58, hp: 4, kind: "stone" },
    ],
    targets: [
      { x: 612, y: 356, r: 23, hp: 1 },
      { x: 700, y: 303, r: 23, hp: 1 },
      { x: 786, y: 303, r: 23, hp: 1 },
      { x: 870, y: 356, r: 23, hp: 1 },
      { x: 744, y: 187, r: 30, hp: 2 },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function circleRectHit(bird: Bird, block: Block) {
  const closestX = clamp(bird.x, block.x, block.x + block.w);
  const closestY = clamp(bird.y, block.y, block.y + block.h);
  const dx = bird.x - closestX;
  const dy = bird.y - closestY;
  return dx * dx + dy * dy <= bird.r * bird.r ? { dx, dy, closestX, closestY } : null;
}

function makeBird(): Bird {
  return { x: ANCHOR.x, y: ANCHOR.y, vx: 0, vy: 0, r: 22, trail: [], spin: 0 };
}

export default function AngryBirdGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const state = {
      levelIndex: 0,
      blocks: [] as Block[],
      targets: [] as Target[],
      bird: makeBird(),
      birdNumber: 0,
      score: 0,
      mode: "aiming" as "aiming" | "dragging" | "flying" | "won" | "lost",
      drag: { ...ANCHOR },
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      last: performance.now(),
      settleTimer: 0,
      message: "Pull farther back for more power. Directly hit every pig to win.",
      messageColor: "#e0f2fe",
      audioCtx: null as AudioContext | null,
    };

    const loadLevel = (index: number) => {
      const level = levels[index];
      state.blocks = level.blocks.map((block) => ({ ...block, maxHp: block.hp, wobble: 0 }));
      state.targets = level.targets.map((target) => ({ ...target, maxHp: target.hp, pop: 0 }));
      state.bird = makeBird();
      state.birdNumber = 0;
      state.mode = "aiming";
      state.drag = { ...ANCHOR };
      state.settleTimer = 0;
      state.message = `Level ${index + 1}: ${level.name}`;
      state.messageColor = "#fde68a";
    };
    loadLevel(0);

    const ensureAudio = () => {
      if (state.audioCtx) return state.audioCtx;
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      state.audioCtx = new AudioContextClass();
      return state.audioCtx;
    };

    const beep = (freq: number, duration: number, type: OscillatorType, volume: number) => {
      const audio = ensureAudio();
      if (!audio) return;
      void audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration + 0.04);
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      state.scale = Math.min(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H);
      state.offsetX = (window.innerWidth - WORLD_W * state.scale) / 2;
      state.offsetY = (window.innerHeight - WORLD_H * state.scale) / 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const screenToWorld = (event: PointerEvent): Vec => ({
      x: (event.clientX - state.offsetX) / state.scale,
      y: (event.clientY - state.offsetY) / state.scale,
    });

    const nextBird = () => {
      const level = levels[state.levelIndex];
      state.birdNumber += 1;
      if (state.targets.length === 0) return;
      if (state.birdNumber >= level.birds) {
        state.mode = "lost";
        state.message = "Out of birds! Press R to retry the level.";
        state.messageColor = "#fecaca";
        beep(130, 0.4, "sawtooth", 0.08);
        return;
      }
      state.bird = makeBird();
      state.drag = { ...ANCHOR };
      state.mode = "aiming";
      state.settleTimer = 0;
      state.message = "Next bird ready. Pull back and aim carefully.";
      state.messageColor = "#e0f2fe";
    };

    const winLevel = () => {
      if (state.mode === "won") return;
      const bonus = Math.max(0, levels[state.levelIndex].birds - state.birdNumber - 1) * 5000;
      state.score += bonus;
      state.mode = "won";
      state.message = state.levelIndex === levels.length - 1 ? "All pig forts cleared! Press R to play again." : `Level cleared! Bonus ${bonus.toLocaleString()} — press Space for next level.`;
      state.messageColor = "#bbf7d0";
      beep(660, 0.12, "triangle", 0.1);
      setTimeout(() => beep(880, 0.18, "triangle", 0.1), 120);
    };

    const restartLevel = () => loadLevel(state.levelIndex);
    const advanceLevel = () => {
      if (state.levelIndex >= levels.length - 1) {
        state.score = 0;
        state.levelIndex = 0;
      } else state.levelIndex += 1;
      loadLevel(state.levelIndex);
    };

    const launch = () => {
      const pullX = ANCHOR.x - state.drag.x;
      const pullY = ANCHOR.y - state.drag.y;
      const power = Math.hypot(pullX, pullY);
      if (power < 12) {
        state.mode = "aiming";
        state.drag = { ...ANCHOR };
        state.bird.x = ANCHOR.x;
        state.bird.y = ANCHOR.y;
        return;
      }
      state.bird.x = state.drag.x;
      state.bird.y = state.drag.y;
      state.bird.vx = pullX * LAUNCH_POWER;
      state.bird.vy = pullY * LAUNCH_POWER;
      state.bird.trail = [];
      state.mode = "flying";
      state.message = "Good shot! The pigs only count when the bird hits them directly.";
      state.messageColor = "#bae6fd";
      beep(360 + power * 3, 0.16, "square", 0.07);
    };

    const onPointerDown = (event: PointerEvent) => {
      const p = screenToWorld(event);
      if (state.mode === "won") {
        advanceLevel();
        return;
      }
      if (state.mode === "lost") {
        restartLevel();
        return;
      }
      if (state.mode === "aiming" && dist(p, state.bird) < 60) {
        state.mode = "dragging";
        state.drag = p;
        canvas.setPointerCapture(event.pointerId);
        beep(220, 0.05, "sine", 0.035);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (state.mode !== "dragging") return;
      const p = screenToWorld(event);
      const dx = p.x - ANCHOR.x;
      const dy = p.y - ANCHOR.y;
      const length = Math.hypot(dx, dy) || 1;
      const limited = Math.min(MAX_PULL, length);
      state.drag = { x: ANCHOR.x + (dx / length) * limited, y: ANCHOR.y + (dy / length) * limited };
      state.bird.x = state.drag.x;
      state.bird.y = state.drag.y;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (state.mode === "dragging") launch();
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {}
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyR") {
        event.preventDefault();
        if (state.levelIndex === levels.length - 1 && state.mode === "won") {
          state.score = 0;
          state.levelIndex = 0;
        }
        restartLevel();
      } else if ((event.code === "Space" || event.code === "Enter") && state.mode === "won") {
        event.preventDefault();
        advanceLevel();
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    const damageBlock = (block: Block, amount: number) => {
      block.hp -= amount;
      block.wobble = 1;
      state.score += Math.round(amount * 160);
      beep(block.kind === "glass" ? 760 : block.kind === "stone" ? 190 : 330, 0.06, block.kind === "glass" ? "triangle" : "sawtooth", 0.04);
    };

    const update = (dt: number) => {
      for (const block of state.blocks) block.wobble = Math.max(0, block.wobble - dt * 5);
      for (const target of state.targets) target.pop = Math.max(0, target.pop - dt * 4);

      if (state.mode !== "flying") return;
      const bird = state.bird;
      bird.vy += 920 * dt;
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      bird.spin += bird.vx * dt * 0.014;
      bird.trail.unshift({ x: bird.x, y: bird.y });
      if (bird.trail.length > 18) bird.trail.pop();

      if (bird.y + bird.r > GROUND_Y) {
        bird.y = GROUND_Y - bird.r;
        bird.vx *= 0.68;
        bird.vy *= -0.32;
        if (Math.abs(bird.vy) < 95) bird.vy = 0;
      }
      if (bird.x - bird.r < 0) {
        bird.x = bird.r;
        bird.vx *= -0.35;
      }
      if (bird.x > WORLD_W + 120 || bird.y > WORLD_H + 120) {
        nextBird();
        return;
      }

      for (const block of state.blocks) {
        const hit = circleRectHit(bird, block);
        if (!hit) continue;
        const speed = Math.hypot(bird.vx, bird.vy);
        const damage = speed > 220 ? (block.kind === "glass" ? 1.6 : block.kind === "wood" ? 1.15 : 0.75) : 0.45;
        damageBlock(block, damage);
        const pushX = Math.abs(hit.dx) > Math.abs(hit.dy) ? Math.sign(hit.dx || bird.vx || 1) : 0;
        const pushY = pushX === 0 ? Math.sign(hit.dy || bird.vy || -1) : 0;
        if (pushX !== 0) {
          bird.x += pushX * 8;
          bird.vx *= -0.42;
          bird.vy *= 0.82;
        } else {
          bird.y += pushY * 8;
          bird.vy *= -0.38;
          bird.vx *= 0.78;
        }
      }
      state.blocks = state.blocks.filter((block) => {
        if (block.hp > 0) return true;
        state.score += block.kind === "stone" ? 900 : block.kind === "wood" ? 650 : 500;
        return false;
      });

      for (const target of state.targets) {
        const d = dist(bird, target);
        if (d > bird.r + target.r + TARGET_HIT_PAD) continue;
        const speed = Math.hypot(bird.vx, bird.vy);
        target.hp -= speed > 120 ? Math.max(1, target.maxHp) : 1;
        state.message = "Direct pig hit!";
        state.messageColor = "#bbf7d0";
        target.pop = 1;
        state.score += 1200;
        bird.vx *= -0.22;
        bird.vy *= -0.16;
        beep(520, 0.08, "square", 0.06);
      }
      state.targets = state.targets.filter((target) => {
        if (target.hp > 0) return true;
        state.score += 7000;
        beep(960, 0.14, "triangle", 0.08);
        return false;
      });

      if (state.targets.length === 0) {
        winLevel();
        return;
      }

      const slow = Math.hypot(bird.vx, bird.vy) < 28 && bird.y + bird.r >= GROUND_Y - 2;
      if (slow) state.settleTimer += dt;
      else state.settleTimer = 0;
      if (state.settleTimer > 1.15) nextBird();
    };

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };

    const drawWorldBackground = (time: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, "#7dd3fc");
      sky.addColorStop(0.55, "#dbeafe");
      sky.addColorStop(1, "#fef3c7");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      for (let i = 0; i < 5; i += 1) {
        const x = (120 + i * 220 + time * (8 + i)) % 1180 - 90;
        const y = 70 + (i % 3) * 38;
        ctx.beginPath();
        ctx.ellipse(x, y, 38, 18, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 32, y + 3, 45, 20, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 32, y + 8, 32, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(37,99,235,0.16)";
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let x = 0; x <= WORLD_W; x += 80) ctx.lineTo(x, 420 + Math.sin(x * 0.015) * 25);
      ctx.lineTo(WORLD_W, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      const ground = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
      ground.addColorStop(0, "#65a30d");
      ground.addColorStop(1, "#365314");
      ctx.fillStyle = ground;
      ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
      ctx.fillStyle = "rgba(132,204,22,0.75)";
      for (let x = 0; x < WORLD_W; x += 18) ctx.fillRect(x, GROUND_Y + Math.sin(x) * 2, 10, 4);
    };

    const drawSlingshot = () => {
      ctx.lineCap = "round";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(130, GROUND_Y);
      ctx.lineTo(146, 394);
      ctx.lineTo(122, 342);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(146, 394);
      ctx.lineTo(178, 337);
      ctx.stroke();
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 8;
      const pull = state.mode === "dragging" ? state.drag : state.mode === "aiming" ? ANCHOR : null;
      if (pull) {
        ctx.beginPath();
        ctx.moveTo(122, 342);
        ctx.lineTo(pull.x, pull.y);
        ctx.lineTo(178, 337);
        ctx.stroke();
      }
    };

    const drawBird = (bird: Bird, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.spin);
      const body = ctx.createRadialGradient(-7, -9, 4, 0, 0, bird.r + 5);
      body.addColorStop(0, "#fed7aa");
      body.addColorStop(0.5, "#f97316");
      body.addColorStop(1, "#b91c1c");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.moveTo(15, -3);
      ctx.lineTo(36, 3);
      ctx.lineTo(15, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(6, -8, 6, 0, Math.PI * 2);
      ctx.arc(-7, -9, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(8, -7, 2.5, 0, Math.PI * 2);
      ctx.arc(-5, -8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -17);
      ctx.lineTo(0, -11);
      ctx.moveTo(1, -12);
      ctx.lineTo(14, -17);
      ctx.stroke();
      ctx.fillStyle = "#991b1b";
      ctx.beginPath();
      ctx.moveTo(-16, -17);
      ctx.lineTo(-31, -31);
      ctx.lineTo(-22, -10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawBlock = (block: Block) => {
      ctx.save();
      const wobble = Math.sin(performance.now() * 0.035) * block.wobble * 2.5;
      ctx.translate(block.x + block.w / 2, block.y + block.h / 2);
      ctx.rotate((wobble * Math.PI) / 180);
      const colors = {
        wood: ["#92400e", "#d97706", "#fbbf24"],
        stone: ["#475569", "#94a3b8", "#cbd5e1"],
        glass: ["#0891b2", "#67e8f9", "#ecfeff"],
      }[block.kind];
      const gradient = ctx.createLinearGradient(-block.w / 2, -block.h / 2, block.w / 2, block.h / 2);
      gradient.addColorStop(0, colors[2]);
      gradient.addColorStop(0.5, colors[1]);
      gradient.addColorStop(1, colors[0]);
      ctx.fillStyle = gradient;
      drawRoundedRect(-block.w / 2, -block.h / 2, block.w, block.h, 6);
      ctx.strokeStyle = "rgba(15,23,42,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-block.w / 2 + 2, -block.h / 2 + 2, block.w - 4, block.h - 4);
      const damage = 1 - block.hp / block.maxHp;
      if (damage > 0.2) {
        ctx.strokeStyle = "rgba(15,23,42,0.72)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-block.w * 0.2, -block.h * 0.35);
        ctx.lineTo(block.w * 0.05, -block.h * 0.08);
        ctx.lineTo(-block.w * 0.12, block.h * 0.18);
        if (damage > 0.55) ctx.lineTo(block.w * 0.22, block.h * 0.36);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawTarget = (target: Target) => {
      ctx.save();
      const scale = 1 + target.pop * 0.2;
      ctx.translate(target.x, target.y);
      ctx.scale(scale, scale);
      const gradient = ctx.createRadialGradient(-8, -10, 4, 0, 0, target.r + 6);
      gradient.addColorStop(0, "#dcfce7");
      gradient.addColorStop(0.52, "#22c55e");
      gradient.addColorStop(1, "#166534");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, target.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14532d";
      ctx.fillRect(-target.r * 0.65, -target.r * 1.1, target.r * 0.35, target.r * 0.38);
      ctx.fillRect(target.r * 0.3, -target.r * 1.1, target.r * 0.35, target.r * 0.38);
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(-target.r * 0.35, -target.r * 0.18, target.r * 0.17, 0, Math.PI * 2);
      ctx.arc(target.r * 0.35, -target.r * 0.18, target.r * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(-target.r * 0.32, -target.r * 0.16, 2.5, 0, Math.PI * 2);
      ctx.arc(target.r * 0.32, -target.r * 0.16, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-target.r * 0.48, -target.r * 0.48);
      ctx.lineTo(-target.r * 0.08, -target.r * 0.33);
      ctx.moveTo(target.r * 0.48, -target.r * 0.48);
      ctx.lineTo(target.r * 0.08, -target.r * 0.33);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, target.r * 0.28, target.r * 0.3, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
      if (target.maxHp > 1) {
        ctx.fillStyle = "rgba(2,6,23,0.68)";
        drawRoundedRect(-target.r, -target.r - 14, target.r * 2, 6, 3);
        ctx.fillStyle = "#bbf7d0";
        drawRoundedRect(-target.r, -target.r - 14, target.r * 2 * (target.hp / target.maxHp), 6, 3);
      }
      ctx.restore();
    };

    const drawAimGuide = () => {
      if (state.mode !== "dragging") return;
      const pullX = ANCHOR.x - state.drag.x;
      const pullY = ANCHOR.y - state.drag.y;
      let x = state.drag.x;
      let y = state.drag.y;
      let vx = pullX * LAUNCH_POWER;
      let vy = pullY * LAUNCH_POWER;
      ctx.fillStyle = "rgba(15,23,42,0.34)";
      for (let i = 0; i < 28; i += 1) {
        const dt = 0.075;
        vy += 920 * dt;
        x += vx * dt;
        y += vy * dt;
        vx *= 0.997;
        if (y > GROUND_Y) break;
        ctx.globalAlpha = 1 - i / 32;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.save();
      ctx.translate(state.offsetX, state.offsetY);
      ctx.scale(state.scale, state.scale);
      drawWorldBackground(time);
      drawSlingshot();
      drawAimGuide();
      for (const block of state.blocks) drawBlock(block);
      for (const target of state.targets) drawTarget(target);
      for (let i = state.bird.trail.length - 1; i >= 0; i -= 1) drawBird({ ...state.bird, x: state.bird.trail[i].x, y: state.bird.trail[i].y, spin: state.bird.spin - i * 0.18 }, 0.08 + (state.bird.trail.length - i) * 0.025);
      drawBird(state.bird);

      const level = levels[state.levelIndex];
      for (let i = state.birdNumber + 1; i < level.birds; i += 1) {
        drawBird({ ...makeBird(), x: 74 + i * 30, y: GROUND_Y - 18, r: 13 }, 0.85);
      }

      if (state.mode === "won" || state.mode === "lost") {
        ctx.fillStyle = "rgba(15,23,42,0.6)";
        drawRoundedRect(260, 170, 480, 170, 24);
        ctx.fillStyle = state.mode === "won" ? "#bbf7d0" : "#fecaca";
        ctx.font = "900 42px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.mode === "won" ? "LEVEL CLEAR" : "TRY AGAIN", 500, 230);
        ctx.fillStyle = "white";
        ctx.font = "800 20px Inter, sans-serif";
        ctx.fillText(state.mode === "won" ? (state.levelIndex === levels.length - 1 ? "All levels cleared!" : "Press Space for the next level") : "Press R or click to retry", 500, 280);
      }
      ctx.restore();

      if (hudRef.current) {
        const remaining = levels[state.levelIndex].birds - state.birdNumber;
        hudRef.current.innerHTML = `<div><span>Level</span><strong>${state.levelIndex + 1}/${levels.length}</strong></div><div><span>Birds</span><strong>${Math.max(0, remaining)}</strong></div><div><span>Pigs</span><strong>${state.targets.length}</strong></div><div><span>Score</span><strong>${state.score.toLocaleString()}</strong></div>`;
      }
      if (messageRef.current) {
        messageRef.current.textContent = state.message;
        messageRef.current.style.color = state.messageColor;
      }
    };

    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - state.last) / 1000 || 0.016);
      state.last = now;
      update(dt);
      draw(now / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      void state.audioCtx?.close();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-sky-200 text-white">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-3xl border border-white/30 bg-slate-950/55 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-200">Feather Fling</p>
          <h1 className="text-2xl font-black">Slingshot Pig Smash</h1>
          <p ref={messageRef} className="mt-1 max-w-xl text-sm font-bold text-sky-100">Pull farther back for more power. Directly hit every pig to win.</p>
        </div>
        <div ref={hudRef} className="grid grid-cols-4 gap-2 rounded-3xl border border-white/30 bg-slate-950/55 p-3 text-center shadow-2xl shadow-black/20 backdrop-blur-md [&_div]:rounded-2xl [&_div]:bg-white/10 [&_div]:px-3 [&_div]:py-2 [&_span]:block [&_span]:text-[10px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-slate-300 [&_strong]:text-lg [&_strong]:font-black" />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="rounded-3xl border border-white/30 bg-slate-950/55 px-5 py-4 text-sm font-bold leading-6 text-slate-100 shadow-2xl shadow-black/20 backdrop-blur-md">
          <p>Controls: drag on the bird, pull back, and release.</p>
          <p className="text-slate-300">Clear every pig with direct bird hits. Press <span className="text-white">R</span> to restart, <span className="text-white">Space</span> after clearing a level.</p>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.22em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-amber-100" to="/">
          Back to Lobby
        </Link>
      </div>
    </main>
  );
}
