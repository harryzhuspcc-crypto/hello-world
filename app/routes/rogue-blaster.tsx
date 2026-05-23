import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/rogue-blaster";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rough Run: Planet Robots | Harry's Game Center" },
    {
      name: "description",
      content: "A run-through alien-planet shooting game with a boy, a blaster, robot attackers, force gates, and bosses.",
    },
  ];
}

type Vec = { x: number; y: number };
type EnemyKind = "punk" | "runner" | "shooter" | "heavy" | "boss";
type Enemy = Vec & { kind: EnemyKind; vx: number; hp: number; maxHp: number; r: number; cooldown: number; active: boolean; stage: number; hitFlash: number };
type Bullet = Vec & { vx: number; vy: number; damage: number; life: number; enemy: boolean; size: number };
type Pickup = Vec & { kind: "heart" | "ammo"; life: number };
type Particle = Vec & { vx: number; vy: number; life: number; color: string; size: number };
type Cover = { x: number; y: number; w: number; h: number };

const GROUND_Y = 470;
const WORLD_W = 10400;
const STAGE_W = 1450;
const STAGES = 7;
const PLAYER_R = 22;
const FINISH_X = STAGE_W * STAGES + 240;

const enemyColors: Record<EnemyKind, string> = {
  punk: "#22d3ee",
  runner: "#f97316",
  shooter: "#a78bfa",
  heavy: "#94a3b8",
  boss: "#ef4444",
};

const covers: Cover[] = Array.from({ length: STAGES }, (_, stage) => [
  { x: stage * STAGE_W + 520, y: GROUND_Y - 52, w: 92, h: 52 },
  { x: stage * STAGE_W + 930, y: GROUND_Y - 76, w: 120, h: 76 },
]).flat();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bulletHitsCover(bullet: Bullet) {
  return covers.some((cover) => bullet.x > cover.x && bullet.x < cover.x + cover.w && bullet.y > cover.y && bullet.y < cover.y + cover.h);
}

function createEnemy(stage: number, offset: number, kind: EnemyKind): Enemy {
  const baseX = stage * STAGE_W + offset;
  const stats = {
    punk: { hp: 24 + stage * 5, r: 19 },
    runner: { hp: 18 + stage * 4, r: 17 },
    shooter: { hp: 28 + stage * 5, r: 19 },
    heavy: { hp: 62 + stage * 11, r: 27 },
    boss: { hp: 260 + stage * 55, r: 45 },
  }[kind];
  return { x: baseX, y: GROUND_Y - stats.r, kind, vx: 0, hp: stats.hp, maxHp: stats.hp, r: stats.r, cooldown: 0.5 + Math.random(), active: false, stage, hitFlash: 0 };
}

function makeEnemies() {
  const enemies: Enemy[] = [];
  for (let stage = 0; stage < STAGES; stage += 1) {
    enemies.push(createEnemy(stage, 620, stage % 2 ? "runner" : "punk"));
    enemies.push(createEnemy(stage, 860, "shooter"));
    enemies.push(createEnemy(stage, 1110, stage > 1 ? "heavy" : "punk"));
    enemies.push(createEnemy(stage, 1280, stage % 3 === 0 ? "shooter" : "runner"));
    if (stage === STAGES - 1) enemies.push(createEnemy(stage, 1360, "boss"));
    else if (stage > 0 && stage % 2 === 0) enemies.push(createEnemy(stage, 1340, "heavy"));
  }
  return enemies;
}

function pushParticles(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 240;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.28 + Math.random() * 0.42, color, size: 2 + Math.random() * 4 });
  }
}

export default function RogueBlaster() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const keys = new Set<string>();
    const mouse = { x: window.innerWidth * 0.72, y: window.innerHeight * 0.55, down: false };
    const state = {
      player: { x: 90, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, hp: 100, maxHp: 100, ammo: 30, maxAmmo: 30, reload: 0, cooldown: 0, invuln: 0 },
      cameraX: 0,
      enemies: makeEnemies(),
      bullets: [] as Bullet[],
      pickups: [] as Pickup[],
      particles: [] as Particle[],
      stage: 0,
      score: 0,
      kills: 0,
      started: false,
      gameOver: false,
      won: false,
      message: "Run across the alien planet. Shoot robot attackers and open force gates.",
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
      state.player = { x: 90, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, hp: 100, maxHp: 100, ammo: 30, maxAmmo: 30, reload: 0, cooldown: 0, invuln: 0 };
      state.cameraX = 0;
      state.enemies = makeEnemies();
      state.bullets = [];
      state.pickups = [];
      state.particles = [];
      state.stage = 0;
      state.score = 0;
      state.kills = 0;
      state.started = true;
      state.gameOver = false;
      state.won = false;
      state.message = "Run across the alien planet and clear each robot blockade.";
    };

    const stageEnd = () => (state.stage + 1) * STAGE_W;
    const stageAlive = () => state.enemies.some((enemy) => enemy.hp > 0 && enemy.stage === state.stage);

    const shoot = () => {
      if (!state.started || state.gameOver || state.won || state.player.cooldown > 0 || state.player.reload > 0) return;
      if (state.player.ammo <= 0) {
        state.player.reload = 1.1;
        state.message = "Reloading!";
        return;
      }
      const sx = state.player.x - state.cameraX;
      const sy = state.player.y;
      const angle = Math.atan2(mouse.y - sy, mouse.x - sx);
      state.bullets.push({ x: state.player.x + Math.cos(angle) * 24, y: state.player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * 850, vy: Math.sin(angle) * 850, damage: 18, life: 0.95, enemy: false, size: 5 });
      state.player.cooldown = 0.13;
      state.player.ammo -= 1;
    };

    const reload = () => {
      if (state.player.reload <= 0 && state.player.ammo < state.player.maxAmmo) {
        state.player.reload = 1.15;
        state.message = "Reloading!";
      }
    };

    const hurtPlayer = (amount: number) => {
      if (state.player.invuln > 0) return;
      state.player.hp -= amount;
      state.player.invuln = 0.45;
      pushParticles(state.particles, state.player.x, state.player.y, "#fecaca", 16);
      if (state.player.hp <= 0) {
        state.player.hp = 0;
        state.gameOver = true;
        state.message = "Knocked out! Press R or click to restart.";
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "Space") {
        event.preventDefault();
        if (!state.started || state.gameOver || state.won) reset();
        else shoot();
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        if (state.started && !state.gameOver && !state.won) reload();
        else reset();
      }
      if ((event.code === "KeyW" || event.code === "ArrowUp") && state.started && !state.gameOver && !state.won && state.player.y >= GROUND_Y - PLAYER_R - 1) {
        event.preventDefault();
        state.player.vy = -650;
      }
      if (event.code === "Enter" && (!state.started || state.gameOver || state.won)) reset();
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
      if (!state.started || state.gameOver || state.won) reset();
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

    const updateEnemy = (enemy: Enemy, dt: number) => {
      if (enemy.hp <= 0) return;
      if (enemy.x - state.player.x < 760) enemy.active = true;
      if (!enemy.active) return;
      enemy.cooldown -= dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5);
      const dx = state.player.x - enemy.x;
      const distance = Math.abs(dx);
      const dir = Math.sign(dx) || -1;
      const speed = enemy.kind === "runner" ? 205 : enemy.kind === "punk" ? 142 : enemy.kind === "shooter" ? 118 : enemy.kind === "heavy" ? 86 : 104;
      enemy.x += dir * speed * dt;
      enemy.x = clamp(enemy.x, enemy.stage * STAGE_W + 60, (enemy.stage + 1) * STAGE_W - 80);
      enemy.y = GROUND_Y - enemy.r;

      const touching = Math.abs(state.player.x - enemy.x) < enemy.r + PLAYER_R + 8;
      if (touching) {
        hurtPlayer(enemy.kind === "boss" ? 22 : enemy.kind === "heavy" ? 16 : enemy.kind === "shooter" ? 10 : 9);
        enemy.x += dir * 4;
      }
      if ((enemy.kind === "shooter" || enemy.kind === "boss") && enemy.cooldown <= 0 && distance < 700) {
        const shots = enemy.kind === "boss" ? [-0.1, 0, 0.1] : [0];
        for (const offset of shots) {
          const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x) + offset;
          state.bullets.push({ x: enemy.x + Math.cos(angle) * enemy.r, y: enemy.y, vx: Math.cos(angle) * 440, vy: Math.sin(angle) * 440, damage: enemy.kind === "boss" ? 14 : 8, life: 1.45, enemy: true, size: enemy.kind === "boss" ? 7 : 5 });
        }
        enemy.cooldown = enemy.kind === "boss" ? 0.9 : 1.4 + Math.random() * 0.5;
      }
    };

    const update = (dt: number) => {
      if (!state.started || state.gameOver || state.won) return;
      const player = state.player;
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.invuln = Math.max(0, player.invuln - dt);
      if (player.reload > 0) {
        player.reload -= dt;
        if (player.reload <= 0) {
          player.reload = 0;
          player.ammo = player.maxAmmo;
          state.message = "Reloaded.";
        }
      }
      if (mouse.down) shoot();

      let move = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) move -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) move += 1;
      const oldX = player.x;
      player.x += move * 280 * dt;
      player.vy += 1550 * dt;
      player.y += player.vy * dt;
      if (player.y > GROUND_Y - PLAYER_R) {
        player.y = GROUND_Y - PLAYER_R;
        player.vy = 0;
      }
      const end = stageEnd();
      if (stageAlive() && player.x > end - 170) {
        player.x = end - 170;
        state.message = "Robot force gate locked — clear the sector!";
      }
      if (!stageAlive() && player.x > end - 110 && state.stage < STAGES - 1) {
        state.stage += 1;
        player.hp = Math.min(player.maxHp, player.hp + 20);
        player.ammo = player.maxAmmo;
        state.message = `Planet sector ${state.stage + 1}: robot signals ahead.`;
      }
      player.x = clamp(player.x, 70, FINISH_X);
      for (const cover of covers) {
        if (player.x + PLAYER_R > cover.x && player.x - PLAYER_R < cover.x + cover.w && player.y + PLAYER_R > cover.y && player.y - PLAYER_R < cover.y + cover.h) player.x = oldX;
      }
      if (player.x >= FINISH_X - 20 && !stageAlive()) {
        state.won = true;
        state.message = "Planet robot base cleared!";
      }

      for (const enemy of state.enemies) updateEnemy(enemy, dt);

      for (const bullet of state.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bulletHitsCover(bullet)) bullet.life = 0;
        if (bullet.enemy) {
          if (bullet.life > 0 && dist(bullet, player) < PLAYER_R + bullet.size) {
            bullet.life = 0;
            hurtPlayer(bullet.damage);
          }
        } else {
          for (const enemy of state.enemies) {
            if (enemy.hp <= 0 || bullet.life <= 0 || dist(bullet, enemy) > enemy.r + bullet.size) continue;
            enemy.hp -= bullet.damage;
            enemy.hitFlash = 1;
            bullet.life = 0;
            pushParticles(state.particles, bullet.x, bullet.y, enemyColors[enemy.kind], 6);
            if (enemy.hp <= 0) {
              state.kills += 1;
              state.score += enemy.kind === "boss" ? 5000 : enemy.kind === "heavy" ? 750 : 300;
              pushParticles(state.particles, enemy.x, enemy.y, enemyColors[enemy.kind], enemy.kind === "boss" ? 48 : 18);
              if (Math.random() < 0.35 || enemy.kind === "boss") state.pickups.push({ x: enemy.x, y: GROUND_Y - 34, kind: Math.random() < 0.55 ? "heart" : "ammo", life: 10 });
            }
          }
        }
      }
      state.bullets = state.bullets.filter((bullet) => bullet.life > 0 && bullet.y > 0 && bullet.y < GROUND_Y + 80 && bullet.x > state.cameraX - 120 && bullet.x < state.cameraX + window.innerWidth + 180);

      for (const pickup of state.pickups) {
        pickup.life -= dt;
        if (dist(pickup, player) < 34) {
          pickup.life = 0;
          if (pickup.kind === "heart") player.hp = Math.min(player.maxHp, player.hp + 28);
          else player.ammo = player.maxAmmo;
        }
      }
      state.pickups = state.pickups.filter((pickup) => pickup.life > 0);

      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 260 * dt;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
      state.cameraX += (player.x - 250 - state.cameraX) * 0.13;
      state.cameraX = clamp(state.cameraX, 0, FINISH_X - window.innerWidth + 180);
    };

    const drawBoy = (x: number, y: number, aimingRight: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(aimingRight ? 1 : -1, 1);
      if (state.player.invuln > 0) ctx.globalAlpha = 0.55 + Math.sin(performance.now() * 0.04) * 0.28;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(-15, -24, 30, 36);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-10, -18, 20, 16);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(-13, 10, 10, 21);
      ctx.fillRect(3, 10, 10, 21);
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(0, -41, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(14,165,233,0.65)";
      ctx.beginPath();
      ctx.ellipse(4, -41, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -41, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(10, -25, 42, 12);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(43, -22, 20, 6);
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(50, -24, 8, 2);
      ctx.restore();
    };

    const drawEnemy = (enemy: Enemy) => {
      if (enemy.hp <= 0) return;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const color = enemy.hitFlash > 0 ? "#ffffff" : enemyColors[enemy.kind];
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-enemy.r * 0.85, -enemy.r * 0.7, enemy.r * 1.7, enemy.r * 1.45);
      ctx.fillStyle = color;
      ctx.fillRect(-enemy.r * 0.68, -enemy.r * 0.52, enemy.r * 1.36, enemy.r * 1.04);
      ctx.strokeStyle = "rgba(226,232,240,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-enemy.r * 0.68, -enemy.r * 0.52, enemy.r * 1.36, enemy.r * 1.04);
      ctx.fillStyle = "#020617";
      ctx.fillRect(-enemy.r * 0.55, -enemy.r * 0.3, enemy.r * 1.1, enemy.r * 0.3);
      ctx.fillStyle = enemy.kind === "boss" ? "#fef08a" : "#67e8f9";
      ctx.fillRect(-enemy.r * 0.38, -enemy.r * 0.22, enemy.r * 0.24, enemy.r * 0.14);
      ctx.fillRect(enemy.r * 0.14, -enemy.r * 0.22, enemy.r * 0.24, enemy.r * 0.14);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-enemy.r * 0.35, -enemy.r * 0.7);
      ctx.lineTo(-enemy.r * 0.62, -enemy.r * 1.08);
      ctx.moveTo(enemy.r * 0.35, -enemy.r * 0.7);
      ctx.lineTo(enemy.r * 0.62, -enemy.r * 1.08);
      ctx.stroke();
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(-enemy.r * 0.62, -enemy.r * 1.1, 3.5, 0, Math.PI * 2);
      ctx.arc(enemy.r * 0.62, -enemy.r * 1.1, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.fillRect(-enemy.r * 0.9, enemy.r * 0.75, enemy.r * 0.55, enemy.r * 0.25);
      ctx.fillRect(enemy.r * 0.35, enemy.r * 0.75, enemy.r * 0.55, enemy.r * 0.25);
      if (enemy.kind === "shooter" || enemy.kind === "boss") {
        ctx.fillStyle = "#111827";
        ctx.fillRect(-enemy.r - 32, -6, 38, 10);
        ctx.fillStyle = "#67e8f9";
        ctx.fillRect(-enemy.r - 36, -4, 8, 6);
      }
      if (enemy.kind === "boss") {
        ctx.strokeStyle = "#fef08a";
        ctx.lineWidth = 4;
        ctx.strokeRect(-enemy.r, -enemy.r * 0.86, enemy.r * 2, enemy.r * 1.7);
      }
      ctx.restore();
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 17, enemy.r * 2, 5);
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 17, enemy.r * 2 * Math.max(0, enemy.hp / enemy.maxHp), 5);
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#190b3d");
      sky.addColorStop(0.45, "#312e81");
      sky.addColorStop(1, "#4c1d95");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      for (let i = 0; i < 70; i += 1) {
        ctx.fillRect((i * 137 - state.cameraX * 0.08) % (w + 80), (i * 71) % 250 + 18, 1.5 + (i % 3), 1.5 + (i % 3));
      }
      ctx.fillStyle = "rgba(125,211,252,0.22)";
      ctx.beginPath();
      ctx.arc(w - 145 - state.cameraX * 0.03, 90, 54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(251,191,36,0.18)";
      ctx.beginPath();
      ctx.arc(135 - state.cameraX * 0.018, 132, 88, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(-state.cameraX, 0);

      for (let x = -200; x < FINISH_X + 600; x += 360) {
        ctx.fillStyle = x % 720 === 0 ? "#4c1d95" : "#5b21b6";
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 70, 230);
        ctx.lineTo(x + 145, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(103,232,249,0.55)";
        ctx.fillRect(x + 86, 285, 14, 115);
        ctx.fillStyle = "#67e8f9";
        ctx.beginPath();
        ctx.moveTo(x + 205, GROUND_Y);
        ctx.lineTo(x + 245, GROUND_Y - 140);
        ctx.lineTo(x + 285, GROUND_Y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#581c87";
      ctx.beginPath();
      ctx.moveTo(-200, GROUND_Y);
      for (let x = -200; x < FINISH_X + 800; x += 120) ctx.lineTo(x, GROUND_Y + Math.sin(x * 0.012) * 18);
      ctx.lineTo(FINISH_X + 800, GROUND_Y + 170);
      ctx.lineTo(-200, GROUND_Y + 170);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(103,232,249,0.35)";
      for (let x = 0; x < FINISH_X + 500; x += 150) ctx.fillRect(x, GROUND_Y + 58, 70, 8);
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      for (let x = 40; x < FINISH_X + 500; x += 330) {
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 25, 62, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 1; i <= STAGES; i += 1) {
        const x = i * STAGE_W;
        const locked = stageAlive() && i === state.stage + 1;
        const beam = ctx.createLinearGradient(x - 14, 120, x + 14, GROUND_Y);
        beam.addColorStop(0, locked ? "rgba(239,68,68,0.25)" : "rgba(34,211,238,0.14)");
        beam.addColorStop(0.5, locked ? "rgba(248,113,113,0.75)" : "rgba(34,211,238,0.5)");
        beam.addColorStop(1, locked ? "rgba(239,68,68,0.25)" : "rgba(34,211,238,0.14)");
        ctx.fillStyle = beam;
        ctx.fillRect(x - 14, 120, 28, GROUND_Y - 120);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "900 20px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(i === STAGES ? "ROBOT CORE" : `SECTOR ${i + 1}`, x, 105);
      }

      for (const cover of covers) {
        const crate = ctx.createLinearGradient(cover.x, cover.y, cover.x + cover.w, cover.y + cover.h);
        crate.addColorStop(0, "#0f172a");
        crate.addColorStop(0.5, "#334155");
        crate.addColorStop(1, "#111827");
        ctx.fillStyle = crate;
        ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
        ctx.strokeStyle = "rgba(103,232,249,0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cover.x + 4, cover.y + 4, cover.w - 8, cover.h - 8);
        ctx.fillStyle = "rgba(103,232,249,0.25)";
        ctx.fillRect(cover.x + 12, cover.y + 12, cover.w - 24, 8);
      }
      for (const pickup of state.pickups) {
        ctx.fillStyle = pickup.kind === "heart" ? "#fb7185" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#020617";
        ctx.font = "900 15px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(pickup.kind === "heart" ? "+" : "A", pickup.x, pickup.y + 5);
      }
      for (const bullet of state.bullets) {
        ctx.fillStyle = bullet.enemy ? "#fb7185" : "#fde047";
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
      drawBoy(state.player.x, state.player.y, mouse.x > state.player.x - state.cameraX);
      ctx.restore();

      if (!state.started || state.gameOver || state.won) {
        ctx.fillStyle = "rgba(2,6,23,0.78)";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "900 54px Inter, sans-serif";
        ctx.fillText(state.won ? "Planet Cleared!" : state.gameOver ? "Suit Down" : "Rough Run: Planet Robots", w / 2, h / 2 - 72);
        ctx.fillStyle = "#fde68a";
        ctx.font = "900 20px Inter, sans-serif";
        ctx.fillText(state.won || state.gameOver ? `Score ${state.score.toLocaleString()} • Robots ${state.kills}` : "Alien planet run-through shooter — robot ambushes, force gates, plasma crates", w / 2, h / 2 - 24);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "800 16px Inter, sans-serif";
        ctx.fillText("A/D move • W/↑ jump • Mouse aim • Click/Space shoot • R reload/restart", w / 2, h / 2 + 24);
      }

      if (hudRef.current) {
        hudRef.current.innerHTML = `<div><span>Sector</span><strong>${state.stage + 1}/${STAGES}</strong></div><div><span>Suit</span><strong>${Math.round(state.player.hp)}/${state.player.maxHp}</strong></div><div><span>Cells</span><strong>${state.player.reload > 0 ? "Reload" : `${state.player.ammo}/${state.player.maxAmmo}`}</strong></div><div><span>Robots</span><strong>${state.kills}</strong></div><div><span>Score</span><strong>${state.score.toLocaleString()}</strong></div><div><span>Gate</span><strong>${stageAlive() ? "Locked" : "Open"}</strong></div>`;
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
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Rough Run</p>
          <h1 className="text-2xl font-black">Planet Robot Siege</h1>
          <p className="mt-1 text-sm font-bold text-slate-300">Alien side-scrolling run-and-gun. W or ↑ jumps; clear robot force gates.</p>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-cyan-100" to="/">
          Back to Lobby
        </Link>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute bottom-4 left-1/2 z-10 grid w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/55 p-3 text-center shadow-2xl backdrop-blur-md sm:grid-cols-6 [&_div]:rounded-2xl [&_div]:bg-white/10 [&_div]:px-3 [&_div]:py-2 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-slate-400 [&_strong]:text-lg [&_strong]:font-black" />
    </main>
  );
}
