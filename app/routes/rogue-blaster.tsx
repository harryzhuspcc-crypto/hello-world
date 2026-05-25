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

type BossLane = "high" | "mid" | "low";
type Bullet = { x: number; y: number; vx: number; vy?: number; life: number; damage: number; enemy: boolean; low: boolean; lane?: BossLane };
type Robot = { x: number; y: number; hp: number; maxHp: number; speed: number; active: boolean; flash: number; shootTimer: number; type: "walker" | "gunner" | "tank" };
type Crawler = { x: number; y: number; hp: number; dead: boolean; flash: number };
type Alien = { x: number; y: number; vx: number; vy: number; hp: number; flash: number; active: boolean; jumpTimer: number; targetDir: -1 | 1 };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Cannon = { ox: number; oy: number; hp: number; maxHp: number; dead: boolean; flash: number; cooldown: number };
type Drone = { x: number; y: number; hp: number; maxHp: number; active: boolean; flash: number; shootTimer: number };
type Launcher = { x: number; y: number; hp: number; maxHp: number; active: boolean; flash: number; popTimer: number; missileTimer: number; popped: boolean };
type Missile = { x: number; y: number; vx: number; vy: number; hp: number; flash: number; armed: boolean; dead: boolean };
type Wave = { x: number; y: number; vx: number; life: number };
type GiantBot = { x: number; hp: number; maxHp: number; active: boolean; flash: number; hitTimer: number };
type TankBoss = { x: number; hp: number; maxHp: number; active: boolean; flash: number; bombTimer: number };
type Bomb = { x: number; y: number; vy: number; life: number; warn: number };

const GROUND_Y = 500;
const WORLD_W = 5200;
const PLAYER_W = 34;
const PLAYER_H = 76;
const DUCK_H = 44;
const BOSS_X = 4450;
const FINISH_X = 5050;
const BOSS_LEFT_X = BOSS_X - 120;
const BOSS_RIGHT_X = FINISH_X - 95;
const ALIEN_JUMP_VX = 255;
const ALIEN_JUMP_VY = -470;
const ALIEN_JUMP_DELAY = 0.62;
const BOSS_ATTACK_Y = 395;
const BOSS_LANES: BossLane[] = ["high", "mid", "low"];
const STAGE2_GIANT_X = 2550;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bossLaneY(lane: BossLane) {
  if (lane === "high") return GROUND_Y - 70;
  if (lane === "mid") return GROUND_Y - 56;
  return GROUND_Y - 16;
}

function bossLaneMessage(lane: BossLane) {
  if (lane === "high") return "HIGH SHOT — DUCK!";
  if (lane === "mid") return "MID SHOT — DUCK OR JUMP!";
  return "LOW SHOT — JUMP!";
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
  return robot.type === "tank" ? 31 : robot.type === "gunner" ? 24 : 22;
}

function robotHeight(robot: Robot) {
  return robot.type === "tank" ? 104 : robot.type === "gunner" ? 88 : 82;
}

function makeCrawlers(): Crawler[] {
  return [700, 1080, 1480, 1910, 2240, 2660, 3030, 3360, 3720, 4100].map((x) => ({ x, y: GROUND_Y - 20, hp: 2, dead: false, flash: 0 }));
}

function makeStage2Drones(): Drone[] {
  return [620, 980, 1510, 1960, 3100, 3600].map((x, i) => ({ x, y: 250 + (i % 2) * 34, hp: 4, maxHp: 4, active: false, flash: 0, shootTimer: 0.9 + i * 0.12 }));
}

function makeStage2Launchers(): Launcher[] {
  return [820, 1350, 2210, 3380, 3960].map((x, i) => ({ x, y: GROUND_Y, hp: 5, maxHp: 5, active: false, flash: 0, popTimer: 0.6 + i * 0.2, missileTimer: 1.4, popped: false }));
}

function makeGiantBot(): GiantBot {
  return { x: STAGE2_GIANT_X, hp: 34, maxHp: 34, active: false, flash: 0, hitTimer: 0 };
}

function makeTankBoss(): TankBoss {
  return { x: BOSS_X + 260, hp: 70, maxHp: 70, active: false, flash: 0, bombTimer: 1.2 };
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
      stage: 1,
      player: { x: 90, y: GROUND_Y - PLAYER_H, vy: 0, hp: 100, maxHp: 100, facing: 1, duck: false, cooldown: 0, invuln: 0, ammo: 36, maxAmmo: 36, reload: 0 },
      robots: makeRobots(),
      crawlers: makeCrawlers(),
      aliens: [] as Alien[],
      drones: [] as Drone[],
      launchers: [] as Launcher[],
      missiles: [] as Missile[],
      waves: [] as Wave[],
      bombs: [] as Bomb[],
      giantBot: makeGiantBot(),
      tankBoss: makeTankBoss(),
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
      bossShotTimer: 1.0,
      helicopter: { x: BOSS_X + 280, y: 135, targetY: 135, dropTimer: 1.0, aliensDropped: 0, aliensKilled: 0 },
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
      state.stage = 1;
      state.player = { x: 90, y: GROUND_Y - PLAYER_H, vy: 0, hp: 100, maxHp: 100, facing: 1, duck: false, cooldown: 0, invuln: 0, ammo: 36, maxAmmo: 36, reload: 0 };
      state.robots = makeRobots();
      state.crawlers = makeCrawlers();
      state.aliens = [];
      state.drones = [];
      state.launchers = [];
      state.missiles = [];
      state.waves = [];
      state.bombs = [];
      state.giantBot = makeGiantBot();
      state.tankBoss = makeTankBoss();
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
      state.bossShotTimer = 1.0;
      state.helicopter = { x: BOSS_X + 280, y: 135, targetY: 135, dropTimer: 1.0, aliensDropped: 0, aliensKilled: 0 };
      state.cannons = [
        { ox: -88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 0.8 },
        { ox: 0, oy: 58, hp: 9, maxHp: 9, dead: false, flash: 0, cooldown: 1.2 },
        { ox: 88, oy: 42, hp: 7, maxHp: 7, dead: false, flash: 0, cooldown: 1.6 },
      ];
      state.message = "Go forward. Duck to shoot ground mines. Shoot boss cannons while dodging.";
    };

    const startStage2 = () => {
      state.stage = 2;
      state.player = { ...state.player, x: 90, y: GROUND_Y - PLAYER_H, vy: 0, hp: Math.min(state.player.maxHp, state.player.hp + 45), facing: 1, duck: false, cooldown: 0, invuln: 1.2, reload: 0 };
      state.robots = [];
      state.crawlers = [];
      state.aliens = [];
      state.drones = makeStage2Drones();
      state.launchers = makeStage2Launchers();
      state.missiles = [];
      state.waves = [];
      state.bombs = [];
      state.giantBot = makeGiantBot();
      state.tankBoss = makeTankBoss();
      state.bullets = [];
      state.particles = [];
      state.cameraX = 0;
      state.bossStarted = false;
      state.bossPhase = "drop";
      state.bossShotTimer = 1.2;
      state.message = "Stage 2: green robot lab. Infinite bullets — jump-shoot drones!";
    };

    const playerRect = () => {
      const height = state.player.duck ? DUCK_H : PLAYER_H;
      return { x: state.player.x - PLAYER_W / 2, y: state.player.y + PLAYER_H - height, w: PLAYER_W, h: height };
    };
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

    const shoot = () => {
      if (!state.started || state.gameOver || state.won || state.player.cooldown > 0) return;
      const low = state.player.duck;
      const y = low ? GROUND_Y - 13 : state.player.y + 28;
      state.bullets.push({ x: state.player.x + state.player.facing * 24, y, vx: state.player.facing * 760, life: 0.9, damage: 1, enemy: false, low });
      state.player.cooldown = 0.1;
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
        if (!state.started || state.gameOver || state.won) reset();
        else state.message = "Infinite cells — no reload needed.";
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
        const height = robotHeight(robot);
        if (rectsOverlap(playerRect(), { x: robot.x - radius, y: GROUND_Y - height, w: radius * 2, h: height })) hurtPlayer(robot.type === "tank" ? 16 : 9);
      }
    };

    const startBoss = () => {
      if (state.bossStarted) return;
      state.bossStarted = true;
      if (state.stage === 2) {
        state.tankBoss.active = true;
        state.tankBoss.bombTimer = 1.0;
        state.message = "Stage 2 Boss: lab tank! Shoot it and dodge falling bombs.";
      } else {
        state.message = "Boss: shoot down every dropped alien first!";
      }
    };

    const updateBoss = (dt: number) => {
      if (state.stage !== 1 || !state.bossStarted || state.bossPhase === "dead") return;
      const heli = state.helicopter;
      const frontX = clamp(state.player.x + 235, BOSS_X + 160, FINISH_X - 240);
      heli.y += (heli.targetY - heli.y) * 0.04;
      if (state.bossPhase === "drop") {
        heli.x += (frontX - heli.x) * 0.025;
        heli.dropTimer -= dt;
        const livingAlien = state.aliens.some((alien) => alien.hp > 0);
        if (heli.aliensDropped < 10 && !livingAlien && heli.dropTimer <= 0) {
          state.aliens.push({ x: clamp(heli.x, BOSS_LEFT_X + 90, BOSS_RIGHT_X - 90), y: heli.y + 70, vx: 0, vy: 0, hp: 2, flash: 0, active: false, jumpTimer: 0.2, targetDir: -1 });
          heli.aliensDropped += 1;
          heli.dropTimer = 0.7;
          state.message = `Alien ${heli.aliensDropped}/10 dropped — it jumps left edge, then right edge!`;
        }
        if (heli.aliensDropped >= 10 && state.aliens.every((alien) => alien.hp <= 0)) {
          state.bossPhase = "attack";
          heli.targetY = BOSS_ATTACK_Y;
          state.message = "Helicopter is landing right in front of you. Shoot straight and dodge!";
        }
      } else if (state.bossPhase === "attack") {
        heli.x += (frontX - heli.x) * 0.08;
        for (const cannon of state.cannons) {
          cannon.flash = Math.max(0, cannon.flash - dt * 8);
        }
        state.bossShotTimer -= dt;
        const liveCannons = state.cannons.filter((cannon) => !cannon.dead);
        if (liveCannons.length > 0 && state.bossShotTimer <= 0) {
          const cannon = liveCannons[Math.floor(Math.random() * liveCannons.length)];
          const lane = BOSS_LANES[Math.floor(Math.random() * BOSS_LANES.length)];
          cannon.flash = 1;
          state.bullets.push({ x: heli.x - 140, y: bossLaneY(lane), vx: -430, life: 1.8, damage: 9, enemy: true, low: false, lane });
          state.message = bossLaneMessage(lane);
          state.bossShotTimer = 1.25;
        }
        if (state.cannons.every((cannon) => cannon.dead)) {
          state.bossPhase = "dead";
          state.score += 8000;
          state.message = "Stage 1 complete — entering the robot lab!";
          burst(state.particles, heli.x, heli.y, "#fde047", 80);
          startStage2();
        }
      }
    };

    const updateStage2 = (dt: number) => {
      const p = state.player;
      for (const drone of state.drones) {
        if (drone.hp <= 0) continue;
        drone.flash = Math.max(0, drone.flash - dt * 8);
        if (drone.x - p.x < 680) drone.active = true;
        if (!drone.active) continue;
        drone.y += Math.sin(performance.now() * 0.003 + drone.x) * 0.35;
        drone.shootTimer -= dt;
        if (Math.abs(drone.x - p.x) < 650 && drone.shootTimer <= 0) {
          for (let i = -2; i <= 2; i += 1) {
            const dx = p.x - drone.x;
            const dy = p.y + 36 - drone.y + i * 32;
            const len = Math.hypot(dx, dy) || 1;
            state.bullets.push({ x: drone.x - 18, y: drone.y, vx: (dx / len) * 360, vy: (dy / len) * 360, life: 1.45, damage: 6, enemy: true, low: false });
          }
          drone.shootTimer = 1.6;
          state.message = "Drone shotgun blast — jump-shoot it out of the air!";
        }
      }

      for (const launcher of state.launchers) {
        if (launcher.hp <= 0) continue;
        launcher.flash = Math.max(0, launcher.flash - dt * 8);
        if (launcher.x - p.x < 620) launcher.active = true;
        if (!launcher.active) continue;
        launcher.popTimer -= dt;
        if (launcher.popTimer <= 0) launcher.popped = true;
        if (launcher.popped) {
          launcher.missileTimer -= dt;
          if (launcher.missileTimer <= 0) {
            state.missiles.push({ x: launcher.x, y: GROUND_Y - 74, vx: 0, vy: -300, hp: 2, flash: 0, armed: false, dead: false });
            launcher.missileTimer = 3.0;
            launcher.popTimer = 1.2;
            launcher.popped = false;
            state.message = "Missile launched — duck and shoot it before the ground wave!";
          }
        }
      }

      for (const missile of state.missiles) {
        if (missile.dead) continue;
        missile.flash = Math.max(0, missile.flash - dt * 8);
        if (!missile.armed && missile.y < GROUND_Y - 260) {
          missile.armed = true;
          const dx = p.x - missile.x;
          missile.vx = clamp(dx * 1.3, -260, 260);
          missile.vy = 220;
        }
        missile.x += missile.vx * dt;
        missile.y += missile.vy * dt;
        if (rectsOverlap(playerRect(), { x: missile.x - 12, y: missile.y - 22, w: 24, h: 44 })) {
          missile.dead = true;
          hurtPlayer(18);
          burst(state.particles, missile.x, missile.y, "#bef264", 26);
        }
        if (missile.y >= GROUND_Y - 10) {
          missile.dead = true;
          burst(state.particles, missile.x, GROUND_Y - 12, "#bef264", 22);
          state.waves.push({ x: missile.x, y: GROUND_Y - 18, vx: missile.x > p.x ? -285 : 285, life: 1.8 });
          state.message = "Ground wave! Jump over it.";
        }
      }
      state.missiles = state.missiles.filter((missile) => !missile.dead);

      for (const wave of state.waves) {
        wave.x += wave.vx * dt;
        wave.life -= dt;
        if (rectsOverlap(playerRect(), { x: wave.x - 28, y: wave.y - 12, w: 56, h: 24 })) hurtPlayer(16);
      }
      state.waves = state.waves.filter((wave) => wave.life > 0);

      const giant = state.giantBot;
      if (giant.hp > 0) {
        giant.flash = Math.max(0, giant.flash - dt * 8);
        giant.hitTimer = Math.max(0, giant.hitTimer - dt);
        if (Math.abs(giant.x - p.x) < 760) giant.active = true;
        if (giant.active) giant.x += Math.sign(p.x - giant.x) * 32 * dt;
        if (rectsOverlap(playerRect(), { x: giant.x - 48, y: GROUND_Y - 190, w: 96, h: 190 })) {
          if (giant.hitTimer <= 0) {
            hurtPlayer(14);
            giant.hitTimer = 0.65;
            state.message = "Massive lab robot is crushing your suit — shoot it down!";
          }
        }
      }

      if (state.bossStarted && state.tankBoss.active && state.tankBoss.hp > 0) {
        const tank = state.tankBoss;
        tank.flash = Math.max(0, tank.flash - dt * 8);
        tank.x += (p.x + 330 - tank.x) * 0.025;
        tank.bombTimer -= dt;
        if (tank.bombTimer <= 0) {
          state.bombs.push({ x: p.x + (Math.random() - 0.5) * 210, y: 80, vy: 0, life: 3.0, warn: 0.6 });
          tank.bombTimer = 0.95;
          state.message = "Bomb from tank turret — move out of the warning spot!";
        }
      }
      for (const bomb of state.bombs) {
        bomb.life -= dt;
        bomb.warn -= dt;
        if (bomb.warn <= 0) {
          bomb.vy += 900 * dt;
          bomb.y += bomb.vy * dt;
        }
        if (bomb.y >= GROUND_Y - 12) {
          bomb.life = 0;
          burst(state.particles, bomb.x, GROUND_Y - 20, "#bbf7d0", 30);
          if (Math.abs(p.x - bomb.x) < 58 && p.y > GROUND_Y - PLAYER_H - 8) hurtPlayer(22);
        }
      }
      state.bombs = state.bombs.filter((bomb) => bomb.life > 0);
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
      if (state.stage === 2 && state.giantBot.hp > 0 && p.x > STAGE2_GIANT_X + 130) {
        p.x = STAGE2_GIANT_X + 130;
        state.message = "The massive human robot blocks the lab — destroy it first!";
      }
      if (!state.bossStarted && p.x > BOSS_X - 170) startBoss();

      if (state.stage === 1) {
        updateRobots(dt);
        updateBoss(dt);
      } else {
        updateStage2(dt);
      }

      if (state.stage === 1) {
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
        if (alien.active) {
          alien.jumpTimer -= dt;
          if (alien.x <= BOSS_LEFT_X + 18) alien.targetDir = 1;
          if (alien.x >= BOSS_RIGHT_X - 18) alien.targetDir = -1;
          const onTopOfPlayer = Math.abs(state.player.x - alien.x) < 24;
          if (onTopOfPlayer) {
            const escapeDir = alien.targetDir === 1 ? 1 : -1;
            alien.x += escapeDir * 85 * dt;
          }
          if (alien.y >= GROUND_Y - 27 && alien.jumpTimer <= 0) {
            alien.vy = ALIEN_JUMP_VY;
            alien.vx = alien.targetDir * ALIEN_JUMP_VX;
            alien.jumpTimer = ALIEN_JUMP_DELAY;
          }
          alien.x = clamp(alien.x, BOSS_LEFT_X, BOSS_RIGHT_X);
        }
        if (rectsOverlap(playerRect(), { x: alien.x - 18, y: alien.y - 28, w: 36, h: 36 })) hurtPlayer(11);
      }
      }

      for (const bullet of state.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += (bullet.vy ?? 0) * dt;
        bullet.life -= dt;
        if (bullet.enemy) {
          const enemyBulletRect = bullet.lane ? { x: bullet.x - 20, y: bullet.y - 5, w: 40, h: 10 } : { x: bullet.x - 5, y: bullet.y - 5, w: 10, h: 10 };
          if (rectsOverlap(playerRect(), enemyBulletRect)) {
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
          const height = robotHeight(robot);
          if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: robot.x - radius, y: GROUND_Y - height, w: radius * 2, h: height })) {
            robot.hp -= bullet.damage;
            robot.flash = 1;
            bullet.life = 0;
            if (robot.hp <= 0) {
              state.score += robot.type === "tank" ? 900 : 450;
              state.kills += 1;
              burst(state.particles, robot.x, GROUND_Y - height / 2, "#67e8f9", robot.type === "tank" ? 36 : 22);
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
        if (state.stage === 2) {
          for (const drone of state.drones) {
            if (drone.hp <= 0 || bullet.life <= 0) continue;
            if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: drone.x - 28, y: drone.y - 18, w: 56, h: 36 })) {
              drone.hp -= 1;
              drone.flash = 1;
              bullet.life = 0;
              if (drone.hp <= 0) {
                state.score += 650;
                state.kills += 1;
                burst(state.particles, drone.x, drone.y, "#86efac", 24);
              }
            }
          }
          for (const launcher of state.launchers) {
            if (launcher.hp <= 0 || bullet.life <= 0) continue;
            if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: launcher.x - 25, y: GROUND_Y - 74, w: 50, h: 74 })) {
              launcher.hp -= 1;
              launcher.flash = 1;
              bullet.life = 0;
              if (launcher.hp <= 0) {
                state.score += 700;
                state.kills += 1;
                burst(state.particles, launcher.x, GROUND_Y - 45, "#bef264", 26);
              }
            }
          }
          for (const missile of state.missiles) {
            if (missile.dead || bullet.life <= 0 || !bullet.low) continue;
            if (rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: missile.x - 16, y: missile.y - 24, w: 32, h: 48 })) {
              missile.hp -= 1;
              missile.flash = 1;
              bullet.life = 0;
              if (missile.hp <= 0) {
                missile.dead = true;
                state.score += 350;
                burst(state.particles, missile.x, missile.y, "#bbf7d0", 24);
              }
            }
          }
          const giant = state.giantBot;
          if (giant.hp > 0 && bullet.life > 0 && rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: giant.x - 48, y: GROUND_Y - 190, w: 96, h: 190 })) {
            giant.hp -= 1;
            giant.flash = 1;
            bullet.life = 0;
            if (giant.hp <= 0) {
              state.score += 2200;
              state.kills += 1;
              burst(state.particles, giant.x, GROUND_Y - 95, "#86efac", 60);
              state.message = "Massive lab robot destroyed!";
            }
          }
          const tank = state.tankBoss;
          if (state.bossStarted && tank.hp > 0 && bullet.life > 0 && rectsOverlap({ x: bullet.x - 7, y: bullet.y - 4, w: 14, h: 8 }, { x: tank.x - 95, y: GROUND_Y - 92, w: 190, h: 92 })) {
            tank.hp -= 1;
            tank.flash = 1;
            bullet.life = 0;
            if (tank.hp <= 0) {
              state.score += 10000;
              state.won = true;
              state.message = "Stage 2 lab tank defeated — mission complete!";
              burst(state.particles, tank.x, GROUND_Y - 55, "#fde047", 90);
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
      ctx.fillRect(10, p.duck ? h - 16 : 32, 42, 11);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(43, p.duck ? h - 13 : 35, 20, 5);
      ctx.restore();
    };

    const drawRobot = (robot: Robot) => {
      if (robot.hp <= 0) return;
      const r = robotRadius(robot);
      const height = robotHeight(robot);
      const bodyTop = -height;
      ctx.save();
      ctx.translate(robot.x, GROUND_Y);
      ctx.fillStyle = robot.flash > 0 ? "white" : robot.type === "tank" ? "#94a3b8" : robot.type === "gunner" ? "#a78bfa" : "#22d3ee";
      ctx.fillRect(-r, bodyTop + 18, r * 2, height - 28);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-r * 0.9, bodyTop + 4, r * 1.8, 26);
      ctx.strokeStyle = "rgba(226,232,240,0.85)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-r, bodyTop + 18, r * 2, height - 28);
      ctx.fillStyle = "#020617";
      ctx.fillRect(-r * 0.7, bodyTop + 12, r * 1.4, 12);
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(-r * 0.48, bodyTop + 15, 8, 5);
      ctx.fillRect(r * 0.2, bodyTop + 15, 8, 5);
      ctx.strokeStyle = robot.type === "tank" ? "#fef08a" : "#67e8f9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, bodyTop + 4);
      ctx.lineTo(-r * 0.7, bodyTop - 16);
      ctx.moveTo(r * 0.4, bodyTop + 4);
      ctx.lineTo(r * 0.7, bodyTop - 16);
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.fillRect(-r * 0.95, -10, r * 0.65, 12);
      ctx.fillRect(r * 0.3, -10, r * 0.65, 12);
      ctx.fillStyle = "#475569";
      ctx.fillRect(-r * 0.72, bodyTop + 40, 9, height - 50);
      ctx.fillRect(r * 0.42, bodyTop + 40, 9, height - 50);
      if (robot.type !== "walker") {
        ctx.fillStyle = "#111827";
        ctx.fillRect(-r - 30, bodyTop + 48, 38, 10);
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(-r - 34, bodyTop + 51, 8, 5);
      }
      ctx.restore();
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(robot.x - r, GROUND_Y - height - 18, r * 2, 5);
      ctx.fillStyle = "#67e8f9";
      ctx.fillRect(robot.x - r, GROUND_Y - height - 18, r * 2 * Math.max(0, robot.hp / robot.maxHp), 5);
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
      if (state.stage !== 1 || !state.bossStarted || state.bossPhase === "dead") return;
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

    const drawStage2Enemy = () => {
      for (const drone of state.drones) {
        if (drone.hp <= 0) continue;
        ctx.save();
        ctx.translate(drone.x, drone.y);
        ctx.fillStyle = drone.flash > 0 ? "white" : "#4ade80";
        ctx.fillRect(-28, -12, 56, 24);
        ctx.fillStyle = "#052e16";
        ctx.fillRect(-16, -6, 32, 12);
        ctx.fillStyle = "#bbf7d0";
        ctx.fillRect(-8, -3, 16, 6);
        ctx.strokeStyle = "#86efac";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-34, 0, 12, 0, Math.PI * 2);
        ctx.arc(34, 0, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "rgba(5,46,22,0.85)";
        ctx.fillRect(drone.x - 28, drone.y - 30, 56, 5);
        ctx.fillStyle = "#bbf7d0";
        ctx.fillRect(drone.x - 28, drone.y - 30, 56 * Math.max(0, drone.hp / drone.maxHp), 5);
      }
      for (const launcher of state.launchers) {
        if (launcher.hp <= 0) continue;
        ctx.fillStyle = launcher.flash > 0 ? "white" : "#166534";
        ctx.fillRect(launcher.x - 28, GROUND_Y - 26, 56, 28);
        ctx.fillStyle = launcher.popped ? "#bef264" : "#14532d";
        ctx.fillRect(launcher.x - 16, launcher.popped ? GROUND_Y - 76 : GROUND_Y - 48, 32, launcher.popped ? 52 : 24);
        ctx.fillStyle = "rgba(5,46,22,0.85)";
        ctx.fillRect(launcher.x - 28, GROUND_Y - 88, 56, 5);
        ctx.fillStyle = "#bbf7d0";
        ctx.fillRect(launcher.x - 28, GROUND_Y - 88, 56 * Math.max(0, launcher.hp / launcher.maxHp), 5);
      }
      for (const missile of state.missiles) {
        ctx.save();
        ctx.translate(missile.x, missile.y);
        ctx.fillStyle = missile.flash > 0 ? "white" : "#d9f99d";
        ctx.fillRect(-8, -22, 16, 38);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(-12, -18);
        ctx.lineTo(12, -18);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (const wave of state.waves) {
        ctx.fillStyle = "rgba(190,242,100,0.85)";
        ctx.beginPath();
        ctx.ellipse(wave.x, wave.y, 38, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const giant = state.giantBot;
      if (giant.hp > 0) {
        ctx.save();
        ctx.translate(giant.x, GROUND_Y);
        ctx.fillStyle = giant.flash > 0 ? "white" : "#22c55e";
        ctx.fillRect(-48, -178, 96, 138);
        ctx.fillStyle = "#064e3b";
        ctx.fillRect(-36, -210, 72, 42);
        ctx.fillStyle = "#bbf7d0";
        ctx.fillRect(-25, -195, 50, 10);
        ctx.fillStyle = "#166534";
        ctx.fillRect(-64, -140, 22, 88);
        ctx.fillRect(42, -140, 22, 88);
        ctx.fillRect(-38, -40, 28, 46);
        ctx.fillRect(10, -40, 28, 46);
        ctx.restore();
        ctx.fillStyle = "rgba(5,46,22,0.85)";
        ctx.fillRect(giant.x - 62, GROUND_Y - 232, 124, 7);
        ctx.fillStyle = "#86efac";
        ctx.fillRect(giant.x - 62, GROUND_Y - 232, 124 * Math.max(0, giant.hp / giant.maxHp), 7);
      }
      const tank = state.tankBoss;
      if (state.bossStarted && tank.hp > 0) {
        ctx.save();
        ctx.translate(tank.x, GROUND_Y);
        ctx.fillStyle = tank.flash > 0 ? "white" : "#15803d";
        ctx.fillRect(-95, -78, 190, 62);
        ctx.fillStyle = "#064e3b";
        ctx.fillRect(-58, -112, 106, 44);
        ctx.fillStyle = "#bbf7d0";
        ctx.fillRect(-8, -145, 18, 50);
        ctx.fillStyle = "#052e16";
        ctx.fillRect(-110, -20, 220, 20);
        ctx.restore();
        ctx.fillStyle = "rgba(5,46,22,0.9)";
        ctx.fillRect(tank.x - 105, GROUND_Y - 166, 210, 9);
        ctx.fillStyle = "#bef264";
        ctx.fillRect(tank.x - 105, GROUND_Y - 166, 210 * Math.max(0, tank.hp / tank.maxHp), 9);
      }
      for (const bomb of state.bombs) {
        ctx.fillStyle = "rgba(239,68,68,0.35)";
        ctx.fillRect(bomb.x - 42, GROUND_Y - 6, 84, 6);
        if (bomb.warn <= 0) {
          ctx.fillStyle = "#bef264";
          ctx.beginPath();
          ctx.arc(bomb.x, bomb.y, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (state.stage === 2) {
        sky.addColorStop(0, "#02130b");
        sky.addColorStop(0.5, "#064e3b");
        sky.addColorStop(1, "#14532d");
      } else {
        sky.addColorStop(0, "#0f172a");
        sky.addColorStop(0.5, "#312e81");
        sky.addColorStop(1, "#581c87");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      for (let i = 0; i < 85; i += 1) ctx.fillRect((i * 137 - state.cameraX * 0.08) % (w + 80), (i * 71) % 260 + 16, 1 + (i % 3), 1 + (i % 3));

      ctx.save();
      ctx.translate(-state.cameraX, 0);
      for (let x = -200; x < FINISH_X + 700; x += 340) {
        if (state.stage === 2) {
          ctx.fillStyle = x % 680 === 0 ? "#052e16" : "#064e3b";
          ctx.fillRect(x, 165, 145, GROUND_Y - 165);
          ctx.fillStyle = "rgba(187,247,208,0.22)";
          ctx.fillRect(x + 18, 190, 90, 38);
          ctx.fillRect(x + 26, 280, 70, 120);
        } else {
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
      }
      ctx.fillStyle = state.stage === 2 ? "#052e16" : "#3b0764";
      ctx.fillRect(-200, GROUND_Y, FINISH_X + 900, 170);
      ctx.fillStyle = state.stage === 2 ? "rgba(190,242,100,0.35)" : "rgba(103,232,249,0.35)";
      for (let x = 0; x < FINISH_X + 500; x += 150) ctx.fillRect(x, GROUND_Y + 58, 70, 8);
      ctx.fillStyle = "rgba(15,23,42,0.45)";
      for (let x = 40; x < FINISH_X + 500; x += 330) {
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 25, 62, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!state.bossStarted) {
        ctx.fillStyle = state.stage === 2 ? "rgba(190,242,100,0.35)" : "rgba(239,68,68,0.45)";
        ctx.fillRect(BOSS_X - 30, 120, 22, GROUND_Y - 120);
        ctx.fillStyle = state.stage === 2 ? "#bbf7d0" : "#fecaca";
        ctx.font = "900 18px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.stage === 2 ? "LAB TANK BOSS" : "BOSS WARNING", BOSS_X + 95, 105);
      } else {
        ctx.fillStyle = state.stage === 2 ? "rgba(190,242,100,0.22)" : "rgba(34,211,238,0.22)";
        ctx.fillRect(BOSS_X - 30, 120, 22, GROUND_Y - 120);
        ctx.fillRect(FINISH_X - 40, 120, 22, GROUND_Y - 120);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "900 20px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(state.stage === 2 ? "TANK BOSS ACTIVE" : "HELICOPTER BOSS ACTIVE", BOSS_X + 240, 105);
      }

      for (const crawler of state.crawlers) drawCrawler(crawler);
      for (const robot of state.robots) drawRobot(robot);
      for (const alien of state.aliens) drawAlien(alien);
      if (state.stage === 2) drawStage2Enemy();
      drawBoss();
      for (const bullet of state.bullets) {
        if (bullet.enemy && bullet.lane) {
          ctx.fillStyle = bullet.lane === "high" ? "#f472b6" : bullet.lane === "mid" ? "#fb923c" : "#ef4444";
          ctx.fillRect(bullet.x - 20, bullet.y - 5, 40, 10);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(bullet.x - 15, bullet.y - 1, 30, 2);
        } else {
          ctx.fillStyle = bullet.enemy ? "#fb7185" : bullet.low ? "#22d3ee" : "#fde047";
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, bullet.enemy ? 5 : 4, 0, Math.PI * 2);
          ctx.fill();
        }
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
        ctx.fillText(state.won ? "Lab Tank Down!" : state.gameOver ? "Mission Failed" : "Rough Run: Robot Silius", w / 2, h / 2 - 72);
        ctx.fillStyle = "#fde68a";
        ctx.font = "900 19px Inter, sans-serif";
        ctx.fillText(state.won || state.gameOver ? `Score ${state.score.toLocaleString()} • Robots ${state.kills}` : "Clear Stage 1 to unlock Stage 2: the green robot lab", w / 2, h / 2 - 24);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "800 16px Inter, sans-serif";
        ctx.fillText("A/D move • W/↑ jump • S/↓ duck • Space/F shoot • Infinite bullets", w / 2, h / 2 + 24);
      }

      if (hudRef.current) {
        hudRef.current.innerHTML = `<div><span>Stage</span><strong>${state.stage}/2</strong></div><div><span>Suit</span><strong>${Math.round(state.player.hp)}/${state.player.maxHp}</strong></div><div><span>Cells</span><strong>∞</strong></div><div><span>Robots</span><strong>${state.kills}</strong></div><div><span>Boss</span><strong>${state.bossStarted ? (state.stage === 2 ? "tank" : state.bossPhase) : "Ahead"}</strong></div><div><span>Tip</span><strong>${state.message}</strong></div>`;
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
          <p className="mt-1 text-sm font-bold text-slate-300">Clear Stage 1 to enter Stage 2: a green lab with drones, missile bots, a giant robot, and a tank boss. Infinite bullets.</p>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-cyan-100" to="/">
          Back to Lobby
        </Link>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute bottom-4 left-1/2 z-10 grid w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/55 p-3 text-center shadow-2xl backdrop-blur-md sm:grid-cols-6 [&_div]:rounded-2xl [&_div]:bg-white/10 [&_div]:px-3 [&_div]:py-2 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-slate-400 [&_strong]:text-sm [&_strong]:font-black" />
    </main>
  );
}
