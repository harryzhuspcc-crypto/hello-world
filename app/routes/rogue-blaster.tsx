import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/rogue-blaster";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Rough Run: Robot Silius | Harry's Game Center" },
    {
      name: "description",
      content: "A long-stage side-scrolling run-and-gun with jumping, ducking, robots, ground hazards, and a helicopter boss.",
    },
  ];
}

type Bullet = { x: number; y: number; vx: number; vy?: number; life: number; damage: number; enemy: boolean; low: boolean };
type Robot = { x: number; y: number; hp: number; maxHp: number; speed: number; active: boolean; flash: number; shootTimer: number; type: "walker" | "gunner" | "tank" };
type Crawler = { x: number; y: number; hp: number; dead: boolean; flash: number };
type Alien = { x: number; y: number; vx: number; vy: number; hp: number; flash: number; active: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Cannon = { ox: number; oy: number; hp: number; maxHp: number; dead: boolean; flash: number; cooldown: number };

const GROUND_Y = 500;
const WORLD_W = 5200;
const PLAYER_W = 34;
const PLAYER_H = 76;
const DUCK_H = 44;
const BOSS_X = 4450;
const FINISH_X = 5050;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makeRobots(): Robot[] {
  return [
    { x: 520, y: GROUND_Y, hp: 5, maxHp: 5, speed: 48, active: false, flash: 0, shootTimer: 1.6, type: "walker" },
    { x: 820, y: GROUND_Y, hp: 7, maxHp: 7, speed: 38, active: false, flash: 0, shootTimer: 1.1, type: "gunner" },
    { x: 1240, y: GROUND_Y, hp: 8, maxHp: 8, speed: 54, active: false, flash: 0, shootTimer: 1.8, type: "walker" },
    { x: 1640, y: GROUND_Y, hp: 14, maxHp: 14, speed: 27, active: false, flash: 0, shootTimer: 1.4, type: "tank" },
    { x: 2050, y: GROUND_Y, hp: 8, maxHp: 8, speed: 58, active: false, flash: 0, shootTimer: 1.5, type: "walker" },
    { x: 2380, y: GROUND_Y, hp: 9, maxHp: 9, speed: 40, active: false, flash: 0, shootTimer: 0.8, type: "gunner" },
    { x: 2820, y: GROUND_Y, hp: 15, maxHp: 15, speed: 30, active: false, flash: 0, shootTimer: 1.2, type: "tank" },
    { x: 3180, y: GROUND_Y, hp: 9, maxHp: 9, speed: 58, active: false, flash: 0, shootTimer: 1.6, type: "walker" },
    { x: 3510, y: GROUND_Y, hp: 10, maxHp: 10, speed: 42, active: false, flash: 0, shootTimer: 1.0, type: "gunner" },
    { x: 3860, y: GROUND_Y, hp: 16, maxHp: 16, speed: 34, active: false, flash: 0, shootTimer: 1.1, type: "tank" },
  ];
}

function robotRadius(robot: Robot) {
  return robot.type === "tank" ? 28 : robot.type === "gunner" ? 21 : 19;
}

function makeCrawlers(): Crawler[] {
  return [700, 1080, 1480, 1910, 2240, 2660, 3030, 3360, 3720, 4100].map((x) => ({ x, y: GROUND_Y - 20, hp: 2, dead: false, flash: 0 }));
}

function burst(particles: Particle[], x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 240;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + Math.random() * 0.45, color, size: 2 + Math.random() * 4 });
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
    const state = {
      player: { x: 90, y: GROUND_Y - PLAYER_H, vy: 0, hp: 100, maxHp: 100, facing: 1, duck: false, cooldown: 0, invuln: 0, ammo: 36, maxAmmo: 36, reload: 0 },
      robots: makeRobots(),
      crawlers: makeCrawlers(),
      aliens: [] as Alien[],
      bullets: [] as Bullet[],
      particles: [] as Particle[],
      cameraX: 0,
      started: false,
      gameOver: false,
      won: false,
      score: 0,
      kills: 0,
      bossStarted: false,
      bossPhase: "drop" as "drop" | "attack" | "dead",
      helicopter: { x: BOSS_X + 430, y: 135, targetY: 135, dropTimer: 1.0, aliensDropped: 0, aliensKilled: 0 },
      cannons: [
        { ox: -88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 0.8 },
        { ox: 0, oy: 58, hp: 9, maxHp: 9, dead: false, flash: 0, cooldown: 1.2 },
        { ox: 88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 1.6 },
      ] as Cannon[],
      message: "Run, jump, duck, and shoot through one long robot stage.",
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
      state.player = { x: 90, y: GROUND_Y - PLAYER_H, vy: 0, hp: 100, maxHp: 100, facing: 1, duck: false, cooldown: 0, invuln: 0, ammo: 36, maxAmmo: 36, reload: 0 };
      state.robots = makeRobots();
      state.crawlers = makeCrawlers();
      state.aliens = [];
      state.bullets = [];
      state.particles = [];
      state.cameraX = 0;
      state.started = true;
      state.gameOver = false;
      state.won = false;
      state.score = 0;
      state.kills = 0;
      state.bossStarted = false;
      state.bossPhase = "drop";
      state.helicopter = { x: BOSS_X + 430, y: 135, targetY: 135, dropTimer: 1.0, aliensDropped: 0, aliensKilled: 0 };
      state.cannons = [
        { ox: -88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 0.8 },
        { ox: 0, oy: 58, hp: 9, maxHp: 9, dead: false, flash: 0, cooldown: 1.2 },
        { ox: 88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 1.6 },
      ];
      state.message = "Go forward. Duck to shoot ground mines. Jump-shoot boss cannons.";
    };

    const playerRect = () => ({ x: state.player.x - PLAYER_W / 2, y: state.player.y, w: PLAYER_W, h: state.player.duck ? DUCK_H : PLAYER_H });
    const hurtPlayer = (amount: number) => {
      if (state.player.invuln > 0 || state.gameOver || state.won) return;
      state.player.hp -= amount;
      state.player.invuln = 0.45;
      burst(state.particles, state.player.x, state.player.y + 24, "#fecaca", 14);
      if (state.player.hp <= 0) {
        state.player.hp = 0;
        state.gameOver = true;
        state.message = "Destroyed! Press R or click to restart.";
      }
    };

    const reload = () => {
      if (state.player.reload <= 0 && state.player.ammo < state.player.maxAmmo) {
        state.player.reload = 1.05;
        state.message = "Reloading cells.";
      }
    };

    const shoot = () => {
      if (!state.started || state.gameOver || state.won || state.player.cooldown > 0 || state.player.reload > 0) return;
      if (state.player.ammo <= 0) {
        reload();
        return;
      }
      const low = state.player.duck;
      const y = state.player.y + (low ? 30 : 28);
      state.bullets.push({ x: state.player.x + state.player.facing * 24, y, vx: state.player.facing * 760, life: 0.9, damage: 1, enemy: false, low });
      state.player.cooldown = 0.12;
      state.player.ammo -= 1;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "Space" || event.code === "KeyF") {
        event.preventDefault();
        if (!state.started || state.gameOver || state.won) reset();
        else shoot();
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        if (state.started && !state.gameOver && !state.won) reload();
        else reset();
      }
      if ((event.code === "KeyW" || event.code === "ArrowUp") && state.started && !state.gameOver && !state.won && state.player.y >= GROUND_Y - PLAYER_H - 1) {
        event.preventDefault();
        state.player.vy = -660;
      }
      if (event.code === "Enter" && (!state.started || state.gameOver || state.won)) reset();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onPointerDown = () => {
      if (!state.started || state.gameOver || state.won) reset();
      else shoot();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);

    const updateRobots = (dt: number) => {
      const p = state.player;
      for (const robot of state.robots) {
        if (robot.hp <= 0) continue;
        robot.flash = Math.max(0, robot.flash - dt * 7);
        if (robot.x - p.x < 620) robot.active = true;
        if (!robot.active) continue;
        const dir = Math.sign(p.x - robot.x) || -1;
        robot.x += dir * robot.speed * dt;
        robot.y = GROUND_Y;
        robot.shootTimer -= dt;
        if ((robot.type === "gunner" || robot.type === "tank") && Math.abs(robot.x - p.x) < 520 && robot.shootTimer <= 0) {
          state.bullets.push({ x: robot.x - dir * 22, y: GROUND_Y - 48, vx: -dir * 430, life: 1.1, damage: robot.type === "tank" ? 11 : 7, enemy: true, low: false });
          robot.shootTimer = robot.type === "tank" ? 1.05 : 1.45;
        }
        const radius = robotRadius(robot);
        if (rectsOverlap(playerRect(), { x: robot.x - radius, y: GROUND_Y - radius * 2, w: radius * 2, h: radius * 2 })) hurtPlayer(robot.type === "tank" ? 16 : 9);
      }
    };

    const startBoss = () => {
      if (state.bossStarted) return;
      state.bossStarted = true;
      state.message = "Boss: shoot down every dropped alien first!";
      state.player.ammo = state.player.maxAmmo;
    };

    const updateBoss = (dt: number) => {
      if (!state.bossStarted || state.bossPhase === "dead") return;
      const heli = state.helicopter;
      heli.y += (heli.targetY - heli.y) * 0.04;
      if (state.bossPhase === "drop") {
        heli.dropTimer -= dt;
        if (heli.aliensDropped < 10 && heli.dropTimer <= 0) {
          state.aliens.push({ x: heli.x + (Math.random() - 0.5) * 140, y: heli.y + 70, vx: (Math.random() - 0.5) * 70, vy: 0, hp: 2, flash: 0, active: false });
          heli.aliensDropped += 1;
          heli.dropTimer = 0.75;
        }
        if (heli.aliensDropped >= 10 && state.aliens.every((alien) => alien.hp <= 0)) {
          state.bossPhase = "attack";
          heli.targetY = 245;
          state.message = "Helicopter is descending. Jump and shoot the cannons!";
        }
      } else if (state.bossPhase === "attack") {
        for (const cannon of state.cannons) {
          if (cannon.dead) continue;
          cannon.flash = Math.max(0, cannon.flash - dt * 8);
          cannon.cooldown -= dt;
          if (cannon.cooldown <= 0) {
            const cx = heli.x + cannon.ox;
            const cy = heli.y + cannon.oy;
            const dx = state.player.x - cx;
            const dy = state.player.y + 22 - cy;
            const len = Math.hypot(dx, dy) || 1;
            state.bullets.push({ x: cx, y: cy, vx: (dx / len) * 520, vy: (dy / len) * 520, life: 1.35, damage: 12, enemy: true, low: false });
            cannon.cooldown = 0.7 + Math.random() * 0.45;
          }
        }
        if (state.cannons.every((cannon) => cannon.dead)) {
          state.bossPhase = "dead";
          state.won = true;
          state.score += 8000;
          state.message = "All cannons destroyed — helicopter defeated!";
          burst(state.particles, heli.x, heli.y, "#fde047", 80);
        }
      }
    };

    const update = (dt: number) => {
      if (!state.started || state.gameOver || state.won) return;
      const p = state.player;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.duck = keys.has("KeyS") || keys.has("ArrowDown");
      if (p.reload > 0) {
        p.reload -= dt;
        if (p.reload <= 0) {
          p.reload = 0;
          p.ammo = p.maxAmmo;
          state.message = "Reloaded.";
        }
      }

      let move = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) move -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) move += 1;
      if (move !== 0) p.facing = move > 0 ? 1 : -1;
      p.x += move * (p.duck ? 120 : 250) * dt;
      p.vy += 1560 * dt;
      p.y += p.vy * dt;
      if (p.y > GROUND_Y - PLAYER_H) {
        p.y = GROUND_Y - PLAYER_H;
        p.vy = 0;
      }
      p.x = clamp(p.x, 70, FINISH_X);
      if (p.x > BOSS_X - 80) startBoss();
      if (!state.bossStarted && p.x > BOSS_X - 110) p.x = BOSS_X - 110;

      updateRobots(dt);
      updateBoss(dt);

      for (const crawler of state.crawlers) {
        if (crawler.dead) continue;
        crawler.flash = Math.max(0, crawler.flash - dt * 7);
        const crawlerRect = { x: crawler.x - 22, y: crawler.y - 10, w: 44, h: 24 };
        if (rectsOverlap(playerRect(), crawlerRect)) {
          crawler.dead = true;
          hurtPlayer(34);
          burst(state.particles, crawler.x, crawler.y, "#fb7185", 38);
          state.message = "Ground mine exploded! Duck and shoot those first.";
        }
      }

      for (const alien of state.aliens) {
        if (alien.hp <= 0) continue;
        alien.flash = Math.max(0, alien.flash - dt * 7);
        alien.vy += 900 * dt;
        alien.y += alien.vy * dt;
        alien.x += alien.vx * dt;
        if (alien.y > GROUND_Y - 26) {
          alien.y = GROUND_Y - 26;
          alien.vy = 0;
          alien.active = true;
        }
        if (alien.active) alien.x += Math.sign(state.player.x - alien.x) * 112 * dt;
        if (rectsOverlap(playerRect(), { x: alien.x - 18, y: alien.y - 28, w: 36, h: 36 })) hurtPlayer(11);
      }

      for (const bullet of state.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += (bullet.vy ?? 0) * dt;
        bullet.life -= dt;
        if (bullet.enemy) {
          if (rectsOverlap(playerRect(), { x: bullet.x - 5, y: bullet.y - 5, w: 10, h: 10 })) {
            bullet.life = 0;
            hurtPlayer(bullet.damage);
          }
          continue;
        }

        for (const crawler of state.crawlers) {
          if (crawler.dead || bullet.life <= 0) continue;
          if (!bullet.low) continue;
          if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: crawler.x - 24, y: crawler.y - 12, w: 48, h: 26 })) {
            crawler.hp -= bullet.damage;
            crawler.flash = 1;
            bullet.life = 0;
            if (crawler.hp <= 0) {
              crawler.dead = true;
              state.score += 350;
              state.kills += 1;
              burst(state.particles, crawler.x, crawler.y, "#67e8f9", 22);
            }
          }
        }
        for (const robot of state.robots) {
          if (robot.hp <= 0 || bullet.life <= 0) continue;
          const radius = robotRadius(robot);
          if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: robot.x - radius, y: GROUND_Y - radius * 2, w: radius * 2, h: radius * 2 })) {
            robot.hp -= bullet.damage;
            robot.flash = 1;
            bullet.life = 0;
            if (robot.hp <= 0) {
              state.score += robot.type === "tank" ? 900 : 450;
              state.kills += 1;
              burst(state.particles, robot.x, GROUND_Y - radius, "#67e8f9", robot.type === "tank" ? 36 : 22);
            }
          }
        }
        for (const alien of state.aliens) {
          if (alien.hp <= 0 || bullet.life <= 0) continue;
          if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: alien.x - 18, y: alien.y - 30, w: 36, h: 38 })) {
            alien.hp -= 1;
            alien.flash = 1;
            bullet.life = 0;
            if (alien.hp <= 0) {
              state.helicopter.aliensKilled += 1;
              state.score += 500;
              state.kills += 1;
              burst(state.particles, alien.x, alien.y, "#a7f3d0", 18);
            }
          }
        }
        if (state.bossPhase === "attack") {
          for (const cannon of state.cannons) {
            if (cannon.dead || bullet.life <= 0) continue;
            const cx = state.helicopter.x + cannon.ox;
            const cy = state.helicopter.y + cannon.oy;
            if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: cx - 24, y: cy - 18, w: 48, h: 36 })) {
              cannon.hp -= 1;
              cannon.flash = 1;
              bullet.life = 0;
              if (cannon.hp <= 0) {
                cannon.dead = true;
                state.score += 1500;
                burst(state.particles, cx, cy, "#fde047", 32);
              }
            }
          }
        }
      }
      state.bullets = state.bullets.filter((bullet) => bullet.life > 0 && bullet.x > state.cameraX - 160 && bullet.x < state.cameraX + window.innerWidth + 240 && bullet.y > 0 && bullet.y < GROUND_Y + 80);

      for (const particle of state.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 440 * dt;
        particle.life -= dt;
      }
      state.particles = state.particles.filter((particle) => particle.life > 0);
      state.cameraX += (p.x - 250 - state.cameraX) * 0.14;
      state.cameraX = clamp(state.cameraX, 0, FINISH_X - window.innerWidth + 260);
    };

    const drawPlayer = () => {
      const p = state.player;
      const h = p.duck ? DUCK_H : PLAYER_H;
      ctx.save();
      ctx.translate(p.x, p.y + PLAYER_H - h);
      ctx.scale(p.facing, 1);
      if (p.invuln > 0) ctx.globalAlpha = 0.55 + Math.sin(performance.now() * 0.05) * 0.25;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(-15, 20, 30, h - 25);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-10, 27, 20, 12);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(-13, h - 7, 10, 14);
      ctx.fillRect(3, h - 7, 10, 14);
      if (!p.duck) {
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.arc(0, 4, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(14,165,233,0.65)";
        ctx.beginPath();
        ctx.ellipse(4, 4, 11, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(10, p.duck ? 25 : 32, 42, 11);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(43, p.duck ? 28 : 35, 20, 5);
      ctx.restore();
    };

    const drawRobot = (robot: Robot) => {
      if (robot.hp <= 0) return;
      const r = robot.type === "tank" ? 28 : robot.type === "gunner" ? 21 : 19;
      ctx.save();
      ctx.translate(robot.x, GROUND_Y - r);
      ctx.fillStyle = robot.flash > 0 ? "white" : robot.type === "tank" ? "#94a3b8" : robot.type === "gunner" ? "#a78bfa" : "#22d3ee";
      ctx.fillRect(-r, -r, r * 2, r * 1.7);
      ctx.fillStyle = "#020617";
      ctx.fillRect(-r * 0.65, -r * 0.55, r * 1.3, r * 0.38);
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(-r * 0.42, -r * 0.44, 7, 5);
      ctx.fillRect(r * 0.2, -r * 0.44, 7, 5);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-r * 0.75, r * 0.8, r * 0.55, 8);
      ctx.fillRect(r * 0.2, r * 0.8, r * 0.55, 8);
      if (robot.type !== "walker") {
        ctx.fillStyle = "#111827";
        ctx.fillRect(-r - 26, -3, 34, 9);
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(-r - 30, -1, 7, 5);
      }
      ctx.restore();
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(robot.x - r, GROUND_Y - r * 2 - 13, r * 2, 5);
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(robot.x - r, GROUND_Y - r * 2 - 13, r * 2 * Math.max(0, robot.hp / robot.maxHp), 5);
    };

    const drawCrawler = (crawler: Crawler) => {
      if (crawler.dead) return;
      ctx.fillStyle = crawler.flash > 0 ? "white" : "#ef4444";
      ctx.fillRect(crawler.x - 24, crawler.y - 10, 48, 22);
      ctx.fillStyle = "#111827";
      ctx.fillRect(crawler.x - 17, crawler.y - 17, 34, 9);
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(crawler.x - 8, crawler.y - 5, 16, 4);
    };

    const drawAlien = (alien: Alien) => {
      if (alien.hp <= 0) return;
      ctx.fillStyle = alien.flash > 0 ? "white" : "#a7f3d0";
      ctx.beginPath();
      ctx.ellipse(alien.x, alien.y - 14, 17, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#052e16";
      ctx.beginPath();
      ctx.arc(alien.x - 6, alien.y - 18, 3, 0, Math.PI * 2);
      ctx.arc(alien.x + 6, alien.y - 18, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBoss = () => {
      if (!state.bossStarted || state.bossPhase === "dead") return;
      const heli = state.helicopter;
      ctx.save();
      ctx.translate(heli.x, heli.y);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-130, -28, 260, 62);
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.ellipse(-35, 2, 82, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(103,232,249,0.65)";
      ctx.fillRect(-78, -12, 78, 22);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-170, -42);
      ctx.lineTo(170, -42);
      ctx.moveTo(0, -58);
      ctx.lineTo(0, -26);
      ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.fillRect(100, -8, 70, 16);
      for (const cannon of state.cannons) {
        if (cannon.dead) continue;
        ctx.fillStyle = cannon.flash > 0 ? "white" : "#111827";
        ctx.fillRect(cannon.ox - 23, cannon.oy - 14, 46, 28);
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(cannon.ox - 7, cannon.oy + 12, 14, 24);
        ctx.fillStyle = "rgba(15,23,42,0.8)";
        ctx.fillRect(cannon.ox - 24, cannon.oy - 25, 48, 5);
        ctx.fillStyle = "#fde047";
        ctx.fillRect(cannon.ox - 24, cannon.oy - 25, 48 * Math.max(0, cannon.hp / cannon.maxHp), 5);
      }
      ctx.restore();
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0f172a");
      sky.addColorStop(0.5, "#312e81");
      sky.addColorStop(1, "#581c87");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      for (let i = 0; i < 85; i += 1) ctx.fillRect((i * 137 - state.cameraX * 0.08) % (w + 80), (i * 71) % 260 + 16, 1 + (i % 3), 1 + (i % 3));

      ctx.save();
      ctx.translate(-state.cameraX, 0);
      for (let x = -200; x < FINISH_X + 700; x += 340) {
        ctx.fillStyle = x % 680 === 0 ? "#4c1d95" : "#5b21b6";
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 80, 230);
        ctx.lineTo(x + 165, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(103,232,249,0.55)";
        ctx.fillRect(x + 204, GROUND_Y - 132, 20, 132);
      }
      ctx.fillStyle = "#3b0764";
      ctx.fillRect(-200, GROUND_Y, FINISH_X + 900, 170);
      ctx.fillStyle = "rgba(103,232,249,0.35)";
      for (let x = 0; x < FINISH_X + 500; x += 150) ctx.fillRect(x, GROUND_Y + 58, 70, 8);
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      for (let x = 40; x < FINISH_X + 500; x += 330) {
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 25, 62, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(239,68,68,0.45)";
      ctx.fillRect(BOSS_X - 30, 120, 22, GROUND_Y - 120);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "900 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("HELICOPTER BOSS", BOSS_X + 160, 105);

      for (const crawler of state.crawlers) drawCrawler(crawler);
      for (const robot of state.robots) drawRobot(robot);
      for (const alien of state.aliens) drawAlien(alien);
      drawBoss();
      for (const bullet of state.bullets) {
        ctx.fillStyle = bullet.enemy ? "#fb7185" : bullet.low ? "#22d3ee" : "#fde047";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.enemy ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const particle of state.particles) {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      drawPlayer();
      ctx.restore();

      if (!state.started || state.gameOver || state.won) {
        ctx.fillStyle = "rgba(2,6,23,0.78)";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = "white";
        ctx.font = "900 50px Inter, sans-serif";
        ctx.fillText(state.won ? "Helicopter Down!" : state.gameOver ? "Mission Failed" : "Rough Run: Robot Silius", w / 2, h / 2 - 72);
        ctx.fillStyle = "#fde68a";
        ctx.font = "900 19px Inter, sans-serif";
        ctx.fillText(state.won || state.gameOver ? `Score ${state.score.toLocaleString()} • Robots ${state.kills}` : "One long run-and-gun stage: jump, duck, shoot, and fight a helicopter boss", w / 2, h / 2 - 24);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "800 16px Inter, sans-serif";
        ctx.fillText("A/D move • W/↑ jump • S/↓ duck • Space/F shoot • R reload", w / 2, h / 2 + 24);
      }

      if (hudRef.current) {
        hudRef.current.innerHTML = `<div><span>Suit</span><strong>${Math.round(state.player.hp)}/${state.player.maxHp}</strong></div><div><span>Cells</span><strong>${state.player.reload > 0 ? "Reload" : `${state.player.ammo}/${state.player.maxAmmo}`}</strong></div><div><span>Robots</span><strong>${state.kills}</strong></div><div><span>Score</span><strong>${state.score.toLocaleString()}</strong></div><div><span>Boss</span><strong>${state.bossStarted ? state.bossPhase : "Ahead"}</strong></div><div><span>Tip</span><strong>${state.message}</strong></div>`;
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
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-3xl border border-white/10 bg-black/50 px-5 py-4 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Rough Run</p>
          <h1 className="text-2xl font-black">Robot Silius Mission</h1>
          <p className="mt-1 text-sm font-bold text-slate-300">Run, jump-shoot, duck-shoot ground mines, then destroy helicopter cannons.</p>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-cyan-100" to="/">
          Back to Lobby
        </Link>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute bottom-4 left-1/2 z-10 grid w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/55 p-3 text-center shadow-2xl backdrop-blur-md sm:grid-cols-6 [&_div]:rounded-2xl [&_div]:bg-white/10 [&_div]:px-3 [&_div]:py-2 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-slate-400 [&_strong]:text-sm [&_strong]:font-black" />
    </main>
  );
}
