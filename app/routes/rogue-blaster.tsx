import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/rogue-blaster";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rogue Blaster | Harry's Game Center" },
    {
      name: "description",
      content: "A cartoon top-down roguelite blaster game with waves of enemies, upgrades, bosses, and survival scoring.",
    },
  ];
}

type Vec = { x: number; y: number };
type Bullet = Vec & { vx: number; vy: number; life: number; damage: number; player: boolean; size: number };
type EnemyKind = "slime" | "drone" | "brute" | "turret" | "boss";
type Enemy = Vec & { vx: number; vy: number; r: number; hp: number; maxHp: number; kind: EnemyKind; cooldown: number; wobble: number; value: number };
type Pickup = Vec & { kind: "heart" | "spark" | "rapid"; r: number; life: number };
type Particle = Vec & { vx: number; vy: number; life: number; color: string; size: number };
type Obstacle = { x: number; y: number; w: number; h: number };

const WORLD_W = 2200;
const WORLD_H = 1500;
const PLAYER_RADIUS = 19;
const ENEMY_COLORS: Record<EnemyKind, string> = {
  slime: "#84cc16",
  drone: "#38bdf8",
  brute: "#f97316",
  turret: "#a78bfa",
  boss: "#ef4444",
};

const obstacles: Obstacle[] = [
  { x: 430, y: 260, w: 190, h: 80 },
  { x: 870, y: 180, w: 110, h: 260 },
  { x: 1280, y: 290, w: 260, h: 90 },
  { x: 1720, y: 190, w: 140, h: 250 },
  { x: 280, y: 760, w: 230, h: 110 },
  { x: 710, y: 650, w: 160, h: 260 },
  { x: 1110, y: 720, w: 300, h: 90 },
  { x: 1580, y: 690, w: 170, h: 260 },
  { x: 530, y: 1140, w: 300, h: 85 },
  { x: 1080, y: 1110, w: 130, h: 230 },
  { x: 1510, y: 1110, w: 360, h: 90 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectCircleHit(rect: Obstacle, point: Vec, r: number) {
  const closestX = clamp(point.x, rect.x, rect.x + rect.w);
  const closestY = clamp(point.y, rect.y, rect.y + rect.h);
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy < r * r;
}

function safePoint(point: Vec, r: number) {
  return point.x > r && point.x < WORLD_W - r && point.y > r && point.y < WORLD_H - r && !obstacles.some((obstacle) => rectCircleHit(obstacle, point, r));
}

function randomEdgePoint(): Vec {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * WORLD_W, y: 35 };
  if (side === 1) return { x: WORLD_W - 35, y: Math.random() * WORLD_H };
  if (side === 2) return { x: Math.random() * WORLD_W, y: WORLD_H - 35 };
  return { x: 35, y: Math.random() * WORLD_H };
}

function pushParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 240;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + Math.random() * 0.45, color, size: 2 + Math.random() * 5 });
  }
}

function createEnemy(wave: number, forcedKind?: EnemyKind): Enemy {
  const kindRoll = Math.random();
  const kind: EnemyKind = forcedKind ?? (wave % 5 === 0 && kindRoll > 0.88 ? "boss" : kindRoll < 0.38 ? "slime" : kindRoll < 0.62 ? "drone" : kindRoll < 0.84 ? "brute" : "turret");
  const pos = randomEdgePoint();
  const stats = {
    slime: { r: 18, hp: 16 + wave * 3, value: 120 },
    drone: { r: 15, hp: 12 + wave * 2, value: 160 },
    brute: { r: 27, hp: 44 + wave * 8, value: 260 },
    turret: { r: 22, hp: 30 + wave * 5, value: 220 },
    boss: { r: 48, hp: 180 + wave * 36, value: 1200 },
  }[kind];
  return { x: pos.x, y: pos.y, vx: 0, vy: 0, r: stats.r, hp: stats.hp, maxHp: stats.hp, kind, cooldown: Math.random() * 1.2, wobble: Math.random() * 10, value: stats.value };
}

export default function RogueBlaster() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const keys = new Set<string>();
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, down: false };
    const state = {
      player: { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, speed: 260, fireRate: 0.22, cooldown: 0, invuln: 0, dash: 0, level: 1, xp: 0, damage: 12 },
      bullets: [] as Bullet[],
      enemyBullets: [] as Bullet[],
      enemies: [] as Enemy[],
      pickups: [] as Pickup[],
      particles: [] as Particle[],
      camera: { x: WORLD_W / 2, y: WORLD_H / 2 },
      wave: 1,
      kills: 0,
      score: 0,
      spawned: 0,
      started: false,
      gameOver: false,
      message: "Click or press Space to start. WASD moves, mouse aims, click shoots.",
      last: performance.now(),
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const reset = () => {
      state.player = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, speed: 260, fireRate: 0.22, cooldown: 0, invuln: 0, dash: 0, level: 1, xp: 0, damage: 12 };
      state.bullets = [];
      state.enemyBullets = [];
      state.enemies = [];
      state.pickups = [];
      state.particles = [];
      state.wave = 1;
      state.kills = 0;
      state.score = 0;
      state.spawned = 0;
      state.started = true;
      state.gameOver = false;
      state.message = "Survive the wave. Grab hearts and sparks, dodge enemy shots.";
    };

    const startWave = () => {
      state.wave += 1;
      state.spawned = 0;
      state.message = state.wave % 5 === 0 ? `Wave ${state.wave}: Big boss wave!` : `Wave ${state.wave}: enemies are getting faster.`;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 16);
    };

    const shoot = () => {
      if (!state.started || state.gameOver || state.player.cooldown > 0) return;
      const sx = window.innerWidth / 2;
      const sy = window.innerHeight / 2;
      const angle = Math.atan2(mouse.y - sy, mouse.x - sx);
      const speed = 720;
      state.bullets.push({ x: state.player.x + Math.cos(angle) * 24, y: state.player.y + Math.sin(angle) * 24, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.82, damage: state.player.damage, player: true, size: 5 });
      state.player.cooldown = state.player.fireRate;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        if (!state.started || state.gameOver) reset();
        else shoot();
      }
      if (event.code === "KeyR") reset();
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.player.dash = 0.14;
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onPointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };
    const onPointerDown = (event: PointerEvent) => {
      mouse.down = true;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (!state.started || state.gameOver) reset();
      else shoot();
    };
    const onPointerUp = () => {
      mouse.down = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const damagePlayer = (amount: number) => {
      if (state.player.invuln > 0 || state.gameOver) return;
      state.player.hp -= amount;
      state.player.invuln = 0.42;
      pushParticles(state.particles, state.player.x, state.player.y, "#fca5a5", 14);
      if (state.player.hp <= 0) {
        state.player.hp = 0;
        state.gameOver = true;
        state.message = "Game over — press R or click to restart.";
      }
    };

    const dropPickup = (x: number, y: number) => {
      const roll = Math.random();
      if (roll < 0.18) state.pickups.push({ x, y, kind: "heart", r: 13, life: 12 });
      else if (roll < 0.42) state.pickups.push({ x, y, kind: "spark", r: 10, life: 10 });
      else if (roll < 0.5) state.pickups.push({ x, y, kind: "rapid", r: 11, life: 8 });
    };

    const gainXp = (amount: number) => {
      state.player.xp += amount;
      const needed = state.player.level * 120;
      if (state.player.xp >= needed) {
        state.player.xp -= needed;
        state.player.level += 1;
        state.player.maxHp += 8;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 26);
        state.player.damage += 2.5;
        state.player.fireRate = Math.max(0.105, state.player.fireRate - 0.012);
        state.message = `Level up! Level ${state.player.level}: stronger foam blaster.`;
        pushParticles(state.particles, state.player.x, state.player.y, "#fde047", 32);
      }
    };

    const update = (dt: number) => {
      if (!state.started || state.gameOver) return;
      const player = state.player;
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.invuln = Math.max(0, player.invuln - dt);
      player.dash = Math.max(0, player.dash - dt);
      if (mouse.down) shoot();

      let mx = 0;
      let my = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
      if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
      const len = Math.hypot(mx, my) || 1;
      const moveSpeed = player.speed * (player.dash > 0 ? 2.25 : 1);
      const old = { x: player.x, y: player.y };
      player.x += (mx / len) * moveSpeed * dt;
      player.y += (my / len) * moveSpeed * dt;
      player.x = clamp(player.x, PLAYER_RADIUS, WORLD_W - PLAYER_RADIUS);
      player.y = clamp(player.y, PLAYER_RADIUS, WORLD_H - PLAYER_RADIUS);
      if (!safePoint(player, PLAYER_RADIUS)) {
        player.x = old.x;
        player.y = old.y;
      }

      const waveTarget = 8 + state.wave * 4;
      if (state.spawned < waveTarget && state.enemies.length < 22 && Math.random() < dt * (1.9 + state.wave * 0.22)) {
        const forceBoss = state.wave % 5 === 0 && state.spawned === waveTarget - 1;
        state.enemies.push(createEnemy(state.wave, forceBoss ? "boss" : undefined));
        state.spawned += 1;
      }
      if (state.spawned >= waveTarget && state.enemies.length === 0) startWave();

      for (const enemy of state.enemies) {
        enemy.cooldown -= dt;
        enemy.wobble += dt * 6;
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = enemy.kind === "slime" ? 78 + state.wave * 4 : enemy.kind === "drone" ? 128 + state.wave * 5 : enemy.kind === "brute" ? 56 + state.wave * 3 : enemy.kind === "boss" ? 70 + state.wave * 2 : 0;
        if (enemy.kind !== "turret") {
          const oldEnemy = { x: enemy.x, y: enemy.y };
          enemy.x += (dx / d) * speed * dt;
          enemy.y += (dy / d) * speed * dt;
          if (!safePoint(enemy, enemy.r)) {
            enemy.x = oldEnemy.x;
            enemy.y = oldEnemy.y;
          }
        }
        if (d < enemy.r + PLAYER_RADIUS) damagePlayer(enemy.kind === "boss" ? 24 : enemy.kind === "brute" ? 15 : 9);
        if ((enemy.kind === "turret" || enemy.kind === "drone" || enemy.kind === "boss") && enemy.cooldown <= 0 && d < 780) {
          const angle = Math.atan2(dy, dx);
          const shots = enemy.kind === "boss" ? [-0.18, 0, 0.18] : [0];
          for (const offset of shots) {
            const a = angle + offset;
            state.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, life: 2.2, damage: enemy.kind === "boss" ? 13 : 8, player: false, size: enemy.kind === "boss" ? 7 : 5 });
          }
          enemy.cooldown = enemy.kind === "boss" ? 1.05 : 1.6 + Math.random() * 0.8;
        }
      }

      const updateBullets = (bullets: Bullet[]) => {
        for (const bullet of bullets) {
          bullet.x += bullet.vx * dt;
          bullet.y += bullet.vy * dt;
          bullet.life -= dt;
          if (obstacles.some((obstacle) => rectCircleHit(obstacle, bullet, bullet.size))) bullet.life = 0;
        }
      };
      updateBullets(state.bullets);
      updateBullets(state.enemyBullets);

      for (const bullet of state.bullets) {
        if (bullet.life <= 0) continue;
        for (const enemy of state.enemies) {
          if (dist(bullet, enemy) > enemy.r + bullet.size) continue;
          enemy.hp -= bullet.damage;
          bullet.life = 0;
          pushParticles(state.particles, bullet.x, bullet.y, ENEMY_COLORS[enemy.kind], 7);
          break;
        }
      }
      for (const bullet of state.enemyBullets) {
        if (bullet.life > 0 && dist(bullet, player) < PLAYER_RADIUS + bullet.size) {
          bullet.life = 0;
          damagePlayer(bullet.damage);
        }
      }
      state.bullets = state.bullets.filter((bullet) => bullet.life > 0 && bullet.x > -60 && bullet.x < WORLD_W + 60 && bullet.y > -60 && bullet.y < WORLD_H + 60);
      state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.life > 0 && bullet.x > -80 && bullet.x < WORLD_W + 80 && bullet.y > -80 && bullet.y < WORLD_H + 80);

      state.enemies = state.enemies.filter((enemy) => {
        if (enemy.hp > 0) return true;
        state.kills += 1;
        state.score += enemy.value;
        gainXp(enemy.kind === "boss" ? 80 : enemy.kind === "brute" ? 28 : 18);
        dropPickup(enemy.x, enemy.y);
        pushParticles(state.particles, enemy.x, enemy.y, ENEMY_COLORS[enemy.kind], enemy.kind === "boss" ? 42 : 18);
        return false;
      });

      for (const pickup of state.pickups) {
        pickup.life -= dt;
        if (dist(pickup, player) < PLAYER_RADIUS + pickup.r) {
          pickup.life = 0;
          if (pickup.kind === "heart") player.hp = Math.min(player.maxHp, player.hp + 26);
          if (pickup.kind === "spark") {
            state.score += 250;
            gainXp(35);
          }
          if (pickup.kind === "rapid") player.fireRate = Math.max(0.09, player.fireRate - 0.018);
          pushParticles(state.particles, pickup.x, pickup.y, pickup.kind === "heart" ? "#fb7185" : pickup.kind === "rapid" ? "#38bdf8" : "#fde047", 16);
        }
      }
      state.pickups = state.pickups.filter((pickup) => pickup.life > 0);

      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
      state.camera.x += (player.x - state.camera.x) * 0.12;
      state.camera.y += (player.y - state.camera.y) * 0.12;
    };

    const drawPlayer = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(8, -6, 34, 12);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(28, -4, 20, 8);
      ctx.rotate(-angle);
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fed7aa";
      ctx.beginPath();
      ctx.arc(0, -12, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-13, -25, 26, 8);
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(5, -14, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawEnemy = (enemy: Enemy) => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y + Math.sin(enemy.wobble) * 2);
      ctx.fillStyle = ENEMY_COLORS[enemy.kind];
      if (enemy.kind === "drone") {
        ctx.rotate(enemy.wobble);
        ctx.fillRect(-enemy.r, -enemy.r, enemy.r * 2, enemy.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(-enemy.r * 0.25, -enemy.r * 0.18, 3, 0, Math.PI * 2);
      ctx.arc(enemy.r * 0.25, -enemy.r * 0.18, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 12, enemy.r * 2, 5);
      ctx.fillStyle = "#bbf7d0";
      ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 12, enemy.r * 2 * Math.max(0, enemy.hp / enemy.maxHp), 5);
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#111827");
      bg.addColorStop(1, "#052e16");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const ox = w / 2 - state.camera.x;
      const oy = h / 2 - state.camera.y;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = "#14532d";
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (let x = 0; x < WORLD_W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WORLD_H);
        ctx.stroke();
      }
      for (let y = 0; y < WORLD_H; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_W, y);
        ctx.stroke();
      }

      for (const obstacle of obstacles) {
        const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
        gradient.addColorStop(0, "#64748b");
        gradient.addColorStop(1, "#1e293b");
        ctx.fillStyle = gradient;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.strokeRect(obstacle.x + 3, obstacle.y + 3, obstacle.w - 6, obstacle.h - 6);
      }

      for (const pickup of state.pickups) {
        ctx.fillStyle = pickup.kind === "heart" ? "#fb7185" : pickup.kind === "rapid" ? "#38bdf8" : "#fde047";
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, pickup.r + Math.sin(performance.now() * 0.008) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#020617";
        ctx.font = "900 13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pickup.kind === "heart" ? "+" : pickup.kind === "rapid" ? "R" : "★", pickup.x, pickup.y + 5);
      }

      for (const bullet of state.bullets) {
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const bullet of state.enemyBullets) {
        ctx.fillStyle = "#fda4af";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const enemy of state.enemies) drawEnemy(enemy);
      for (const particle of state.particles) {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const angle = Math.atan2(mouse.y - h / 2, mouse.x - w / 2);
      drawPlayer(state.player.x, state.player.y, angle);
      ctx.restore();

      if (!state.started || state.gameOver) {
        ctx.fillStyle = "rgba(2,6,23,0.72)";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "900 52px Inter, sans-serif";
        ctx.fillText(state.gameOver ? "Rogue Blaster Down" : "Rogue Blaster", w / 2, h / 2 - 60);
        ctx.font = "900 20px Inter, sans-serif";
        ctx.fillStyle = "#fde68a";
        ctx.fillText(state.gameOver ? `Score ${state.score.toLocaleString()} • Wave ${state.wave}` : "A cartoon roguelite shooter with a kid and a foam blaster", w / 2, h / 2 - 15);
        ctx.font = "800 16px Inter, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText("WASD move • Mouse aim • Click/Space shoot • Shift dash • R restart", w / 2, h / 2 + 30);
      }

      if (hudRef.current) {
        const hp = Math.round(state.player.hp);
        const xpNeeded = state.player.level * 120;
        hudRef.current.innerHTML = `<div><span>Wave</span><strong>${state.wave}</strong></div><div><span>HP</span><strong>${hp}/${state.player.maxHp}</strong></div><div><span>Level</span><strong>${state.player.level}</strong></div><div><span>XP</span><strong>${Math.floor(state.player.xp)}/${xpNeeded}</strong></div><div><span>Kills</span><strong>${state.kills}</strong></div><div><span>Score</span><strong>${state.score.toLocaleString()}</strong></div>`;
      }
    };

    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - state.last) / 1000 || 0.016);
      state.last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-3xl border border-white/10 bg-black/50 px-5 py-4 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-lime-200">Rogue Blaster</p>
          <h1 className="text-2xl font-black">Foam Blaster Survival</h1>
          <p className="mt-1 text-sm font-bold text-slate-300">Original cartoon roguelite inspired by top-down blaster games.</p>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-lime-100" to="/">
          Back to Lobby
        </Link>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute bottom-4 left-1/2 z-10 grid w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/55 p-3 text-center shadow-2xl backdrop-blur-md sm:grid-cols-6 [&_div]:rounded-2xl [&_div]:bg-white/10 [&_div]:px-3 [&_div]:py-2 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-slate-400 [&_strong]:text-lg [&_strong]:font-black" />
    </main>
  );
}
