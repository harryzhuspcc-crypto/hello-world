import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import * as THREE from "three";

import type { Route } from "./+types/plus";

type PlusGame = "plans" | "menu" | "tank" | "plane" | "mario" | "street";
type PlusAccess = "trial" | "three" | "nine";

type Keys = Set<string>;

type Rect = { x: number; y: number; w: number; h: number };
type Shot = { x: number; y: number; vx: number; vy: number; r: number; damage: number; from: "player" | "enemy" | "fire" };

type TankEnemy = Rect & { kind: "infantry" | "tank" | "boss"; hp: number; maxHp: number; cooldown: number; speed: number };
type PlaneEnemy = Rect & { kind: "fighter" | "bomber" | "boss"; hp: number; maxHp: number; cooldown: number; vx: number; vy: number };
type Platform = Rect;
type Coin = { x: number; y: number; r: number; got: boolean };
type Block = Rect & { used: boolean; reward: "coin" | "flower" };
type Goomba = Rect & { vx: number; alive: boolean };
type Flower = Rect & { vx: number; vy: number; active: boolean };
type StreetEnemy = Rect & { kind: "thug" | "bruiser" | "boss"; hp: number; maxHp: number; lane: number; vx: number; cooldown: number; hitStun: number; damage: number; alive: boolean };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GET PLUS | Harry's Game Center" },
    {
      name: "description",
      content: "Plus and Pro campaign modes with stage-based tank, plane, platformer, and blocky street fight adventures.",
    },
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bossRequiredShots(stage: number) {
  return Math.max(20, stage * 20);
}

function useCanvasLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  run: (ctx: CanvasRenderingContext2D, width: number, height: number, dt: number, keys: Keys) => void,
  deps: React.DependencyList,
) {
  const keysRef = useRef<Keys>(new Set());

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let last = performance.now();
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (time: number) => {
      const dt = Math.min((time - last) / 1000, 0.033);
      last = time;
      run(ctx, window.innerWidth, window.innerHeight, dt, keysRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, deps);
}

function PlusShell({
  title,
  subtitle,
  children,
  onMenu,
  modeAction,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onMenu: () => void;
  modeAction?: React.ReactNode;
}) {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute left-4 top-4 z-50 flex gap-3">
        <button
          className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur transition hover:bg-black/65"
          onClick={onMenu}
          type="button"
        >
          ← Plus Menu
        </button>
        <Link
          className="rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur transition hover:bg-black/65"
          to="/"
        >
          Lobby
        </Link>
        {modeAction}
      </div>
      <div className="absolute right-4 top-4 z-50 rounded-3xl border border-amber-200/25 bg-black/45 px-5 py-3 text-right shadow-2xl backdrop-blur">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">GET PLUS</div>
        <div className="text-lg font-black">{title}</div>
        <div className="text-xs text-slate-300">{subtitle}</div>
      </div>
      {children}
    </main>
  );
}

function TankPlus2DGame({ onMenu, on3d }: { onMenu: () => void; on3d?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    stage: 1,
    hp: 120,
    maxHp: 120,
    x: 140,
    y: 0,
    progress: 0,
    stopIndex: 0,
    enemies: [] as TankEnemy[],
    shots: [] as Shot[],
    cooldown: 0,
    message: "Stage 1: roll down the street",
    won: false,
  });

  useCanvasLoop(canvasRef, (ctx, w, h, dt, keys) => {
    const s = stateRef.current;
    if (s.y === 0) s.y = h * 0.62;
    ctx.clearRect(0, 0, w, h);

    const roadTop = h * 0.22;
    const roadBottom = h * 0.86;
    const roadMid = (roadTop + roadBottom) / 2;
    const stops = [310, 650, 930];
    const stageDone = s.stage > 12;

    if (stageDone) {
      ctx.fillStyle = "#07111f";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.font = "900 46px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PLUS TANK CAMPAIGN COMPLETE", w / 2, h / 2 - 20);
      ctx.font = "700 18px Inter, sans-serif";
      ctx.fillText("All 12 street stages cleared.", w / 2, h / 2 + 24);
      return;
    }

    const moving = s.enemies.length === 0 && s.stopIndex < stops.length;
    if (moving) {
      s.progress += dt * (44 + s.stage * 2);
      if (s.progress >= stops[s.stopIndex]) {
        const bossStop = s.stopIndex === stops.length - 1;
        const count = bossStop ? 1 : 3 + Math.floor(s.stage * 0.55);
        s.enemies = [];
        for (let i = 0; i < count; i += 1) {
          if (bossStop) {
            const bossHp = (12 + s.stage * 1.5) * bossRequiredShots(s.stage);
            s.enemies.push({ x: w - 260, y: roadMid - 82, w: 180, h: 164, kind: "boss", hp: bossHp, maxHp: bossHp, cooldown: 0.5, speed: 0 });
          } else if (i % 3 === 0) {
            s.enemies.push({ x: w + i * 80, y: roadTop + 55 + (i % 4) * 70, w: 54, h: 66, kind: "tank", hp: 16 + s.stage * 4, maxHp: 16 + s.stage * 4, cooldown: 0.9, speed: 30 + s.stage * 2 });
          } else {
            s.enemies.push({ x: w + i * 70, y: roadTop + 40 + (i % 6) * 55, w: 22, h: 34, kind: "infantry", hp: 5 + s.stage, maxHp: 5 + s.stage, cooldown: 0.6, speed: 46 + s.stage * 3 });
          }
        }
        s.message = bossStop ? `Stage ${s.stage} boss tank blocking the road!` : `Ambush stop ${s.stopIndex + 1}: clear the street!`;
        s.stopIndex += 1;
      }
    }

    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const up = keys.has("KeyW") || keys.has("ArrowUp");
    const down = keys.has("KeyS") || keys.has("ArrowDown");
    s.x = clamp(s.x + ((right ? 1 : 0) - (left ? 1 : 0)) * 220 * dt, 50, w * 0.48);
    s.y = clamp(s.y + ((down ? 1 : 0) - (up ? 1 : 0)) * 220 * dt, roadTop + 36, roadBottom - 40);
    s.cooldown = Math.max(0, s.cooldown - dt);
    if ((keys.has("Space") || keys.has("KeyF")) && s.cooldown <= 0) {
      s.shots.push({ x: s.x + 54, y: s.y, vx: 520, vy: 0, r: 7, damage: 12 + s.stage * 1.5, from: "player" });
      s.cooldown = 0.18;
    }

    for (const enemy of s.enemies) {
      if (enemy.kind !== "boss") enemy.x -= enemy.speed * dt;
      enemy.cooldown -= dt;
      if (enemy.kind === "infantry") {
        const dx = s.x - enemy.x;
        const dy = s.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / len) * enemy.speed * dt;
        enemy.y += (dy / len) * enemy.speed * dt;
      }
      if (enemy.cooldown <= 0) {
        const dx = s.x - enemy.x;
        const dy = s.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = enemy.kind === "boss" ? 330 : 250;
        s.shots.push({ x: enemy.x, y: enemy.y + enemy.h / 2, vx: (dx / len) * speed, vy: (dy / len) * speed, r: enemy.kind === "infantry" ? 4 : 7, damage: enemy.kind === "boss" ? 18 : enemy.kind === "tank" ? 11 : 5, from: "enemy" });
        if (enemy.kind === "boss") {
          for (const angle of [-0.8, 0, 0.8]) s.shots.push({ x: enemy.x, y: enemy.y + 62, vx: -300, vy: Math.sin(angle) * 180, r: 7, damage: 14, from: "enemy" });
        }
        enemy.cooldown = enemy.kind === "boss" ? 0.72 : 1.25;
      }
    }

    for (const shot of s.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }
    for (const shot of s.shots.filter((p) => p.from === "player")) {
      for (const enemy of s.enemies) {
        if (shot.x > enemy.x && shot.x < enemy.x + enemy.w && shot.y > enemy.y && shot.y < enemy.y + enemy.h) {
          enemy.hp -= shot.damage;
          shot.x = w + 999;
        }
      }
    }
    const playerRect = { x: s.x - 42, y: s.y - 28, w: 84, h: 56 };
    for (const enemy of s.enemies) {
      if (enemy.kind === "infantry" && overlap(playerRect, enemy)) {
        s.hp -= (10 + s.stage) * dt;
      }
    }
    for (const shot of s.shots.filter((p) => p.from === "enemy")) {
      if (shot.x > playerRect.x && shot.x < playerRect.x + playerRect.w && shot.y > playerRect.y && shot.y < playerRect.y + playerRect.h) {
        s.hp -= shot.damage;
        shot.x = -999;
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -120);
    s.shots = s.shots.filter((p) => p.x > -80 && p.x < w + 80 && p.y > -80 && p.y < h + 80);
    if (s.hp <= 0) {
      Object.assign(s, { hp: s.maxHp, x: 140, y: roadMid, progress: 0, stopIndex: 0, enemies: [], shots: [], message: `Stage ${s.stage} restarted` });
    }
    if (s.stopIndex >= stops.length && s.enemies.length === 0) {
      s.stage += 1;
      s.maxHp += 8;
      Object.assign(s, { hp: s.maxHp, x: 140, y: roadMid, progress: 0, stopIndex: 0, enemies: [], shots: [], message: s.stage <= 12 ? `Stage ${s.stage}: push forward` : "Campaign complete" });
    }

    const roadOffset = -(s.progress % 120);
    ctx.fillStyle = "#17331f";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#4d4f55";
    ctx.fillRect(0, roadTop, w, roadBottom - roadTop);
    ctx.fillStyle = "#303237";
    ctx.fillRect(0, roadTop, w, 12);
    ctx.fillRect(0, roadBottom - 12, w, 12);
    ctx.strokeStyle = "#f7d46b";
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 24]);
    ctx.beginPath();
    ctx.moveTo(roadOffset, roadMid);
    ctx.lineTo(w + 120, roadMid);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#586b3c";
    for (let x = roadOffset; x < w + 160; x += 120) {
      ctx.fillRect(x, roadTop - 48, 34, 48);
      ctx.fillRect(x + 66, roadBottom, 34, 54);
    }

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = "#587342";
    ctx.fillRect(-42, -28, 84, 56);
    ctx.fillStyle = "#26301f";
    ctx.fillRect(-50, -34, 18, 68);
    ctx.fillRect(32, -34, 18, 68);
    ctx.fillStyle = "#78925a";
    ctx.fillRect(-12, -20, 34, 40);
    ctx.fillStyle = "#d8e6b0";
    ctx.fillRect(18, -5, 54, 10);
    ctx.restore();

    for (const enemy of s.enemies) {
      ctx.fillStyle = enemy.kind === "boss" ? "#3f4240" : enemy.kind === "tank" ? "#875d3e" : "#c99a5b";
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
      if (enemy.kind === "boss") {
        ctx.fillStyle = "#1f2324";
        ctx.fillRect(enemy.x - 42, enemy.y + 56, 42, 12);
        ctx.fillRect(enemy.x + enemy.w / 2 - 7, enemy.y - 34, 14, 34);
        ctx.fillRect(enemy.x + enemy.w / 2 - 7, enemy.y + enemy.h, 14, 34);
      }
      const healthBarWidth = enemy.kind === "boss" ? 280 : enemy.w;
      const healthBarX = enemy.kind === "boss" ? enemy.x + enemy.w / 2 - healthBarWidth / 2 : enemy.x;
      ctx.fillStyle = "#ff4f4f";
      ctx.fillRect(healthBarX, enemy.y - 16, healthBarWidth, enemy.kind === "boss" ? 10 : 5);
      ctx.fillStyle = "#79ff86";
      ctx.fillRect(healthBarX, enemy.y - 16, healthBarWidth * Math.max(0, enemy.hp / enemy.maxHp), enemy.kind === "boss" ? 10 : 5);
      if (enemy.kind === "boss") {
        ctx.fillStyle = "white";
        ctx.font = "800 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.ceil(enemy.hp / (12 + s.stage * 1.5))} shots left`, enemy.x + enemy.w / 2, enemy.y - 22);
        ctx.textAlign = "left";
      }
    }
    for (const shot of s.shots) {
      ctx.fillStyle = shot.from === "player" ? "#ffe36f" : "#ff8460";
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(20, h - 86, 430, 64);
    ctx.fillStyle = "white";
    ctx.font = "800 20px Inter, sans-serif";
    ctx.fillText(`Tank Plus Stage ${Math.min(s.stage, 12)} / 12`, 38, h - 56);
    ctx.font = "600 14px Inter, sans-serif";
    ctx.fillText(`${s.message}  •  WASD move  •  Space/F fire`, 38, h - 32);
    ctx.fillStyle = "#ff5757";
    ctx.fillRect(20, 82, 220, 16);
    ctx.fillStyle = "#72ff82";
    ctx.fillRect(20, 82, 220 * (s.hp / s.maxHp), 16);
  }, []);

  return <PlusShell title="Tank Campaign 2D" subtitle="classic flat street version" onMenu={onMenu} modeAction={on3d ? <button className="rounded-full border border-cyan-200/25 bg-cyan-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-2xl backdrop-blur transition hover:bg-cyan-300/25" onClick={on3d} type="button">3D Version</button> : undefined}><canvas ref={canvasRef} /></PlusShell>;
}

function PlanePlus2DGame({ onMenu, on3d }: { onMenu: () => void; on3d?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ stage: 1, hp: 100, maxHp: 100, x: 120, y: 320, distance: 0, enemies: [] as PlaneEnemy[], shots: [] as Shot[], cooldown: 0, bossSpawned: false, message: "Stage 1 takeoff" });

  useCanvasLoop(canvasRef, (ctx, w, h, dt, keys) => {
    const s = stateRef.current;
    if (s.y === 320) s.y = h / 2;
    ctx.clearRect(0, 0, w, h);
    if (s.stage > 12) {
      ctx.fillStyle = "#061225";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "900 46px Inter, sans-serif";
      ctx.fillText("SKY PLUS CAMPAIGN COMPLETE", w / 2, h / 2);
      return;
    }

    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const up = keys.has("KeyW") || keys.has("ArrowUp");
    const down = keys.has("KeyS") || keys.has("ArrowDown");
    s.x = clamp(s.x + ((right ? 1 : 0) - (left ? 1 : 0)) * 260 * dt, 40, w * 0.45);
    s.y = clamp(s.y + ((down ? 1 : 0) - (up ? 1 : 0)) * 260 * dt, 80, h - 80);
    s.distance += dt * (38 + s.stage * 2);
    s.cooldown = Math.max(0, s.cooldown - dt);
    if ((keys.has("Space") || keys.has("KeyF")) && s.cooldown <= 0) {
      s.shots.push({ x: s.x + 42, y: s.y, vx: 650, vy: 0, r: 4, damage: 10 + s.stage * 1.2, from: "player" });
      s.cooldown = 0.12;
    }

    if (!s.bossSpawned && s.distance < 820 && Math.random() < dt * (0.9 + s.stage * 0.08)) {
      const kind = Math.random() < 0.25 ? "bomber" : "fighter";
      s.enemies.push({ x: w + 40, y: 90 + Math.random() * (h - 180), w: kind === "bomber" ? 70 : 48, h: kind === "bomber" ? 54 : 34, kind, hp: kind === "bomber" ? 22 + s.stage * 3 : 10 + s.stage * 2, maxHp: kind === "bomber" ? 22 + s.stage * 3 : 10 + s.stage * 2, cooldown: 0.8, vx: -(170 + s.stage * 9), vy: (Math.random() - 0.5) * 80 });
    }
    if (!s.bossSpawned && s.distance >= 820) {
      s.bossSpawned = true;
      s.message = `Stage ${s.stage} boss ace incoming!`;
      s.enemies.push({ x: w - 180, y: h / 2 - 58, w: 140, h: 116, kind: "boss", hp: 75 + s.stage * 14, maxHp: 75 + s.stage * 14, cooldown: 0.4, vx: 0, vy: 80 });
    }

    for (const enemy of s.enemies) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      if (enemy.kind === "boss") {
        if (enemy.y < 90 || enemy.y + enemy.h > h - 90) enemy.vy *= -1;
        enemy.cooldown -= dt;
        if (enemy.cooldown <= 0) {
          for (const offset of [-30, 0, 30]) s.shots.push({ x: enemy.x, y: enemy.y + enemy.h / 2 + offset, vx: -360, vy: offset * 2.2, r: 6, damage: 12 + s.stage, from: "enemy" });
          enemy.cooldown = 0.55;
        }
      } else {
        if (enemy.y < 70 || enemy.y + enemy.h > h - 70) enemy.vy *= -1;
        enemy.cooldown -= dt;
        if (enemy.cooldown <= 0) {
          s.shots.push({ x: enemy.x, y: enemy.y + enemy.h / 2, vx: -330, vy: 0, r: 5, damage: 8, from: "enemy" });
          enemy.cooldown = 1.5;
        }
      }
    }
    for (const shot of s.shots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    }
    for (const shot of s.shots.filter((p) => p.from === "player")) {
      for (const enemy of s.enemies) {
        if (shot.x > enemy.x && shot.x < enemy.x + enemy.w && shot.y > enemy.y && shot.y < enemy.y + enemy.h) {
          enemy.hp -= shot.damage;
          shot.x = w + 999;
        }
      }
    }
    const player = { x: s.x - 36, y: s.y - 20, w: 72, h: 40 };
    for (const enemy of s.enemies) if (overlap(player, enemy)) { s.hp -= enemy.kind === "boss" ? 22 : 12; enemy.hp = 0; }
    for (const shot of s.shots.filter((p) => p.from === "enemy")) if (shot.x > player.x && shot.x < player.x + player.w && shot.y > player.y && shot.y < player.y + player.h) { s.hp -= shot.damage; shot.x = -999; }
    s.enemies = s.enemies.filter((e) => e.hp > 0 && e.x > -120);
    s.shots = s.shots.filter((p) => p.x > -80 && p.x < w + 80 && p.y > -80 && p.y < h + 80);
    if (s.hp <= 0) Object.assign(s, { hp: s.maxHp, x: 120, y: h / 2, distance: 0, enemies: [], shots: [], bossSpawned: false, message: `Stage ${s.stage} restarted` });
    if (s.bossSpawned && s.enemies.length === 0) Object.assign(s, { stage: s.stage + 1, hp: Math.min(s.maxHp + 8, s.maxHp + 8), maxHp: s.maxHp + 8, x: 120, y: h / 2, distance: 0, enemies: [], shots: [], bossSpawned: false, message: `Stage ${s.stage + 1} takeoff` });

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6dd6ff");
    g.addColorStop(1, "#132a63");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 180 - (s.distance * 2) % 180) % (w + 220) - 80;
      const y = 80 + ((i * 73) % Math.max(120, h - 160));
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = "#f3f7ff";
    ctx.beginPath();
    ctx.moveTo(46, 0); ctx.lineTo(-34, -22); ctx.lineTo(-18, 0); ctx.lineTo(-34, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#3887ff"; ctx.fillRect(-12, -36, 18, 72); ctx.fillStyle = "#ff4c4c"; ctx.fillRect(-40, -6, 16, 12); ctx.restore();
    for (const enemy of s.enemies) {
      ctx.fillStyle = enemy.kind === "boss" ? "#56256d" : enemy.kind === "bomber" ? "#774b4b" : "#283a66";
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
      ctx.fillStyle = "#ff5959"; ctx.fillRect(enemy.x, enemy.y - 9, enemy.w, 5);
      ctx.fillStyle = "#85ff91"; ctx.fillRect(enemy.x, enemy.y - 9, enemy.w * (enemy.hp / enemy.maxHp), 5);
    }
    for (const shot of s.shots) { ctx.fillStyle = shot.from === "player" ? "#fff76d" : "#ff7d61"; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(20, h - 86, 430, 64);
    ctx.fillStyle = "white"; ctx.font = "800 20px Inter, sans-serif"; ctx.fillText(`Plane Plus Stage ${Math.min(s.stage, 12)} / 12`, 38, h - 56);
    ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(`${s.message} • WASD move • Space/F fire`, 38, h - 32);
    ctx.fillStyle = "#ff5757"; ctx.fillRect(20, 82, 220, 16); ctx.fillStyle = "#72ff82"; ctx.fillRect(20, 82, 220 * (s.hp / s.maxHp), 16);
  }, []);

  return <PlusShell title="Plane Campaign 2D" subtitle="classic flat sky version" onMenu={onMenu} modeAction={on3d ? <button className="rounded-full border border-cyan-200/25 bg-cyan-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-2xl backdrop-blur transition hover:bg-cyan-300/25" onClick={on3d} type="button">3D Version</button> : undefined}><canvas ref={canvasRef} /></PlusShell>;
}


type ThreeActor = {
  mesh: THREE.Object3D;
  kind: "infantry" | "tank" | "boss" | "fighter" | "bomber" | "thug" | "bruiser";
  hp: number;
  maxHp: number;
  cooldown: number;
  speed: number;
};

type ThreeShot = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  owner: "player" | "enemy";
  life: number;
};

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose?.();
  });
}

function useKeyTracker() {
  const keysRef = useRef<Keys>(new Set());
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  return keysRef;
}

function createTankMesh(kind: "player" | "tank" | "boss") {
  const group = new THREE.Group();
  const scale = kind === "boss" ? 2.2 : 1;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * scale, 0.8 * scale, 3.3 * scale),
    new THREE.MeshStandardMaterial({ color: kind === "player" ? 0x5d7f43 : kind === "boss" ? 0x3f4240 : 0x8f6346, roughness: 0.85 }),
  );
  hull.position.y = 0.55 * scale;
  group.add(hull);
  const turret = new THREE.Mesh(
    new THREE.BoxGeometry(1.3 * scale, 0.55 * scale, 1.4 * scale),
    new THREE.MeshStandardMaterial({ color: kind === "player" ? 0x78925a : kind === "boss" ? 0x6e5845 : 0x6f4c34, roughness: 0.8 }),
  );
  turret.position.y = 1.15 * scale;
  group.add(turret);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.24 * scale, 2.6 * scale), new THREE.MeshStandardMaterial({ color: 0x20251d }));
  barrel.position.set(0, 1.15 * scale, -1.9 * scale);
  group.add(barrel);
  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x20231e, roughness: 0.9 });
  for (const x of [-1.25 * scale, 1.25 * scale]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.45 * scale, 3.6 * scale), trackMaterial);
    track.position.set(x, 0.36 * scale, 0);
    group.add(track);
  }
  if (kind === "boss") {
    const cannonMaterial = new THREE.MeshStandardMaterial({ color: 0x151819 });
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.8), cannonMaterial);
      cannon.position.set(Math.sin(angle) * 3.4, 1.8, Math.cos(angle) * 3.4);
      cannon.rotation.y = angle;
      group.add(cannon);
    }
  }
  return group;
}

function createSoldierMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.32), new THREE.MeshStandardMaterial({ color: 0xb98b57 }));
  body.position.y = 0.7;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: 0x2c3428 }));
  head.position.y = 1.35;
  group.add(head);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), new THREE.MeshBasicMaterial({ color: 0xffcf7a }));
  rifle.position.set(0.32, 0.9, -0.42);
  group.add(rifle);
  return group;
}

function createStreetFighterMesh(kind: "player" | "thug" | "bruiser" | "boss") {
  const group = new THREE.Group();
  const scale = kind === "boss" ? 1.45 : kind === "bruiser" ? 1.2 : 1;
  const bodyColor = kind === "player" ? 0x2563eb : kind === "boss" ? 0x7f1d1d : kind === "bruiser" ? 0x7c3aed : 0x475569;
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0b68a, roughness: 0.75 });
  const cloth = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05 * scale, 1.25 * scale, 0.58 * scale), cloth);
  torso.position.y = 1.55 * scale;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.62 * scale, 0.62 * scale), skin);
  head.position.y = 2.52 * scale;
  group.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.12 * scale, 0.03 * scale), new THREE.MeshBasicMaterial({ color: 0x111827 }));
  face.position.set(0, 2.52 * scale, -0.325 * scale);
  group.add(face);
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.86 * scale, 0.34 * scale), dark);
  leftLeg.position.set(-0.32 * scale, 0.55 * scale, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.86 * scale, 0.34 * scale), dark);
  rightLeg.position.set(0.32 * scale, 0.55 * scale, 0);
  group.add(rightLeg);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.94 * scale, 0.32 * scale), skin);
  leftArm.position.set(-0.73 * scale, 1.62 * scale, -0.04);
  leftArm.rotation.z = 0.08;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.94 * scale, 0.32 * scale), skin);
  rightArm.position.set(0.73 * scale, 1.62 * scale, -0.04);
  rightArm.rotation.z = -0.08;
  group.add(rightArm);
  const leftFist = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.28 * scale, 0.38 * scale), skin);
  leftFist.position.set(-0.73 * scale, 1.06 * scale, -0.04);
  group.add(leftFist);
  const rightFist = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.28 * scale, 0.38 * scale), skin);
  rightFist.position.set(0.73 * scale, 1.06 * scale, -0.04);
  group.add(rightFist);
  group.userData.limbs = { torso, head, leftLeg, rightLeg, leftArm, rightArm, leftFist, rightFist, scale };
  if (kind === "boss") {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.46), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    crown.position.y = 3.78;
    group.add(crown);
  }
  return group;
}

function animateStreetFighterMesh(mesh: THREE.Object3D, dt: number, options: { moving?: boolean; jumping?: boolean; attack?: "none" | "punch" | "kick" | "special"; attacking?: boolean; enemySwing?: boolean }) {
  const limbs = mesh.userData.limbs as { torso: THREE.Mesh; head: THREE.Mesh; leftLeg: THREE.Mesh; rightLeg: THREE.Mesh; leftArm: THREE.Mesh; rightArm: THREE.Mesh; leftFist?: THREE.Mesh; rightFist?: THREE.Mesh; scale: number } | undefined;
  if (!limbs) return;
  const t = performance.now() * 0.012;
  const walk = options.moving ? Math.sin(t) * 0.65 : 0;
  const jumpTuck = options.jumping ? 0.85 : 0;
  let leftLegX = walk - jumpTuck * 0.55;
  let rightLegX = -walk - jumpTuck * 0.55;
  let leftArmX = -walk * 0.55;
  let rightArmX = walk * 0.55;
  let torsoZ = options.moving ? Math.sin(t) * 0.05 : 0;
  if (options.attacking && options.attack === "punch") {
    rightArmX = -1.58;
    leftLegX = 0.38;
    rightLegX = -0.28;
    limbs.rightArm.position.z = THREE.MathUtils.lerp(limbs.rightArm.position.z, -1.18 * limbs.scale, dt * 26);
    if (limbs.rightFist) limbs.rightFist.position.z = THREE.MathUtils.lerp(limbs.rightFist.position.z, -1.72 * limbs.scale, dt * 30);
    if (limbs.rightFist) limbs.rightFist.position.y = THREE.MathUtils.lerp(limbs.rightFist.position.y, 1.5 * limbs.scale, dt * 24);
    torsoZ += 0.2;
  } else if (options.attacking && options.attack === "kick") {
    rightLegX = -1.72;
    leftLegX = 0.42;
    limbs.rightLeg.position.z = THREE.MathUtils.lerp(limbs.rightLeg.position.z, -1.05 * limbs.scale, dt * 22);
    limbs.rightLeg.position.y = THREE.MathUtils.lerp(limbs.rightLeg.position.y, 0.95 * limbs.scale, dt * 18);
    leftArmX = 0.85;
    rightArmX = 0.62;
    torsoZ += 0.18;
  } else if (options.attacking && options.attack === "special") {
    leftArmX = -1.35;
    rightArmX = -1.35;
    leftLegX = -1.45;
    rightLegX = -1.45;
    limbs.leftLeg.position.z = THREE.MathUtils.lerp(limbs.leftLeg.position.z, 0.82 * limbs.scale, dt * 22);
    limbs.rightLeg.position.z = THREE.MathUtils.lerp(limbs.rightLeg.position.z, -0.82 * limbs.scale, dt * 22);
    limbs.leftLeg.position.y = THREE.MathUtils.lerp(limbs.leftLeg.position.y, 0.88 * limbs.scale, dt * 18);
    limbs.rightLeg.position.y = THREE.MathUtils.lerp(limbs.rightLeg.position.y, 0.88 * limbs.scale, dt * 18);
    mesh.rotation.y += t * 0.55;
    mesh.rotation.z = Math.sin(t * 2.4) * 0.18;
  } else if (options.enemySwing) {
    rightArmX = -1.1;
    torsoZ += 0.16;
  } else {
    limbs.rightArm.position.z = THREE.MathUtils.lerp(limbs.rightArm.position.z, -0.04, dt * 10);
    if (limbs.rightFist) limbs.rightFist.position.z = THREE.MathUtils.lerp(limbs.rightFist.position.z, -0.04, dt * 10);
    if (limbs.rightFist) limbs.rightFist.position.y = THREE.MathUtils.lerp(limbs.rightFist.position.y, 1.06 * limbs.scale, dt * 10);
    limbs.leftLeg.position.z = THREE.MathUtils.lerp(limbs.leftLeg.position.z, 0, dt * 10);
    limbs.rightLeg.position.z = THREE.MathUtils.lerp(limbs.rightLeg.position.z, 0, dt * 10);
    limbs.leftLeg.position.y = THREE.MathUtils.lerp(limbs.leftLeg.position.y, 0.55 * limbs.scale, dt * 10);
    limbs.rightLeg.position.y = THREE.MathUtils.lerp(limbs.rightLeg.position.y, 0.55 * limbs.scale, dt * 10);
    mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, 0, dt * 8);
  }
  limbs.leftLeg.rotation.x = THREE.MathUtils.lerp(limbs.leftLeg.rotation.x, leftLegX, dt * 12);
  limbs.rightLeg.rotation.x = THREE.MathUtils.lerp(limbs.rightLeg.rotation.x, rightLegX, dt * 12);
  limbs.leftArm.rotation.x = THREE.MathUtils.lerp(limbs.leftArm.rotation.x, leftArmX, dt * 12);
  limbs.rightArm.rotation.x = THREE.MathUtils.lerp(limbs.rightArm.rotation.x, rightArmX, dt * 12);
  limbs.torso.rotation.z = THREE.MathUtils.lerp(limbs.torso.rotation.z, torsoZ, dt * 10);
}

function createPlaneMesh(kind: "player" | "fighter" | "bomber" | "boss") {
  const group = new THREE.Group();
  const scale = kind === "boss" ? 2.1 : kind === "bomber" ? 1.35 : 1;
  const bodyColor = kind === "player" ? 0xf3f7ff : kind === "boss" ? 0x66277d : kind === "bomber" ? 0x7e4f4f : 0x283a66;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.55 * scale, 3.2 * scale), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.25 }));
  group.add(body);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5.0 * scale, 0.16 * scale, 1.0 * scale), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.2 }));
  wing.position.z = 0.15 * scale;
  group.add(wing);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 0.95 * scale, 14), new THREE.MeshBasicMaterial({ color: kind === "player" ? 0x3887ff : 0xff7d61 }));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.0 * scale;
  group.add(nose);
  return group;
}

function makeShot(scene: THREE.Scene, origin: THREE.Vector3, velocity: THREE.Vector3, owner: "player" | "enemy", damage: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(owner === "player" ? 0.18 : 0.24, 12, 12), new THREE.MeshBasicMaterial({ color: owner === "player" ? 0xfff06d : 0xff7555 }));
  mesh.position.copy(origin);
  scene.add(mesh);
  return { mesh, velocity, owner, damage, life: 4 } satisfies ThreeShot;
}

function TankPlus3DCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useKeyTracker();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa7b987);
    scene.fog = new THREE.Fog(0xa7b987, 70, 210);
    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 320);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xece3c1, 0x4a5232, 1.18));
    const sun = new THREE.DirectionalLight(0xfff2c6, 1.65);
    sun.position.set(42, 55, 18);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa6d0ff, 0.45);
    rim.position.set(-18, 22, -30);
    scene.add(rim);

    const world = new THREE.Group();
    scene.add(world);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 360, 36, 100), new THREE.MeshStandardMaterial({ color: 0x78935f, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -115;
    world.add(ground);
    const road = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 330), new THREE.MeshStandardMaterial({ color: 0x4b4d52, roughness: 0.95 }));
    road.position.set(0, 0.02, -115);
    world.add(road);

    const laneMarks: THREE.Mesh[] = [];
    for (let i = 0; i < 34; i += 1) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 4.4), new THREE.MeshBasicMaterial({ color: 0xf7d46b }));
      mark.position.set(0, 0.11, 42 - i * 9.5);
      world.add(mark);
      laneMarks.push(mark);
    }

    const coverObjects: THREE.Mesh[] = [];
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x676956, roughness: 0.98 });
    for (let i = 0; i < 32; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const rock = new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(2.5, 5.8), THREE.MathUtils.randFloat(1.5, 3.8), THREE.MathUtils.randFloat(2.5, 5.8)), rockMaterial);
      rock.position.set(side * THREE.MathUtils.randFloat(18, 44), rock.geometry.parameters.height / 2, 36 - i * 9.5 + THREE.MathUtils.randFloatSpread(4));
      rock.rotation.set(THREE.MathUtils.randFloatSpread(0.15), Math.random() * Math.PI, THREE.MathUtils.randFloatSpread(0.15));
      world.add(rock);
      coverObjects.push(rock);
    }

    const player = createTankMesh("player");
    player.position.set(0, 0, 34);
    scene.add(player);

    const actors: ThreeActor[] = [];
    const shots: ThreeShot[] = [];
    const game = {
      stage: 1,
      hp: 140,
      maxHp: 140,
      stop: 0,
      cooldown: 0,
      aimYaw: 0,
      aimPitch: 0.08,
      mouseDown: false,
      message: "Drive forward. Click to lock aim. This is the run-through version of Tank Fight.",
    };
    const stopZ = [-42, -118, -220];

    const clearActors = () => {
      for (const actor of actors.splice(0)) {
        scene.remove(actor.mesh);
        disposeObject(actor.mesh);
      }
      for (const shot of shots.splice(0)) {
        scene.remove(shot.mesh);
        shot.mesh.geometry.dispose();
        (shot.mesh.material as THREE.Material).dispose();
      }
    };

    const spawnActor = (kind: "infantry" | "tank" | "boss", x: number, z: number) => {
      const mesh = kind === "infantry" ? createSoldierMesh() : createTankMesh(kind);
      mesh.position.set(x, 0, z);
      if (kind !== "infantry") mesh.rotation.y = Math.PI;
      scene.add(mesh);
      const hp = kind === "boss" ? (16 + game.stage * 1.7) * bossRequiredShots(game.stage) : kind === "tank" ? 28 + game.stage * 5 : 8 + game.stage * 1.2;
      actors.push({ mesh, kind, hp, maxHp: hp, cooldown: 0.65 + Math.random() * 0.7, speed: kind === "boss" ? 0 : kind === "tank" ? 5.6 + game.stage * 0.28 : 8.2 + game.stage * 0.35 });
    };

    const spawnEncounter = () => {
      const boss = game.stop === 2;
      const baseZ = stopZ[game.stop] - 22;
      if (boss) {
        spawnActor("boss", 0, baseZ - 8);
        for (let i = 0; i < 4; i += 1) spawnActor(i % 2 === 0 ? "tank" : "infantry", THREE.MathUtils.randFloatSpread(14), baseZ + 8 + i * 4);
        game.message = `Stage ${game.stage}: fortress boss tank. It needs about ${bossRequiredShots(game.stage)} direct hits to destroy.`;
      } else {
        const count = 4 + Math.floor(game.stage * 0.65);
        for (let i = 0; i < count; i += 1) spawnActor(i % 3 === 0 ? "tank" : "infantry", THREE.MathUtils.randFloatSpread(16), baseZ - i * 5);
        game.message = `Stage ${game.stage}: street ambush ${game.stop + 1}. Stop and clear enemies to keep driving.`;
      }
      game.stop += 1;
    };

    const firePlayerShot = () => {
      if (game.cooldown > 0 || game.stage > 12) return;
      const origin = player.position.clone().add(new THREE.Vector3(Math.sin(game.aimYaw) * 1.7, 1.2, -Math.cos(game.aimYaw) * 2.9));
      const direction = new THREE.Vector3(
        Math.sin(game.aimYaw) * Math.cos(game.aimPitch),
        Math.sin(game.aimPitch),
        -Math.cos(game.aimYaw) * Math.cos(game.aimPitch),
      ).normalize();
      shots.push(makeShot(scene, origin, direction.multiplyScalar(58), "player", 16 + game.stage * 1.7));
      game.cooldown = 0.28;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      game.aimYaw -= event.movementX * 0.0048;
      game.aimPitch = clamp(game.aimPitch - event.movementY * 0.0038, -0.45, 0.55);
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) void renderer.domElement.requestPointerLock();
      if (event.button === 0) {
        game.mouseDown = true;
        firePlayerShot();
      }
    };
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) game.mouseDown = false;
    };
    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousemove", handleMouseMove);

    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.033);
      const keys = keysRef.current;
      game.cooldown = Math.max(0, game.cooldown - dt);

      if (game.stage <= 12) {
        const moveForward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
        const moveRight = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
        const forward = new THREE.Vector3(Math.sin(game.aimYaw), 0, -Math.cos(game.aimYaw));
        const right = new THREE.Vector3(Math.cos(game.aimYaw), 0, Math.sin(game.aimYaw));
        const move = new THREE.Vector3().addScaledVector(forward, moveForward).addScaledVector(right, moveRight);
        if (move.lengthSq() > 1) move.normalize();
        const oldZ = player.position.z;
        player.position.addScaledVector(move, 13 * dt);
        player.position.x = clamp(player.position.x, -10.2, 10.2);
        player.position.z = clamp(player.position.z, -252, 38);
        if (actors.length > 0 && game.stop > 0) {
          const barrier = stopZ[game.stop - 1] - 4;
          player.position.z = Math.max(player.position.z, barrier);
        }
        player.rotation.y = game.aimYaw;
        if ((keys.has("Space") || keys.has("KeyF") || game.mouseDown) && game.cooldown <= 0) firePlayerShot();
        if (actors.length === 0 && game.stop < stopZ.length && oldZ > stopZ[game.stop] && player.position.z <= stopZ[game.stop]) spawnEncounter();
        if (game.stop >= stopZ.length && actors.length === 0 && player.position.z <= -246) {
          game.stage += 1;
          game.maxHp += 9;
          Object.assign(game, { hp: game.maxHp, stop: 0, message: game.stage <= 12 ? `Stage ${game.stage}: keep rolling through the warzone.` : "Tank Plus 3D campaign complete." });
          player.position.set(0, 0, 34);
        }
      }

      for (let i = actors.length - 1; i >= 0; i -= 1) {
        const actor = actors[i];
        const target = player.position.clone();
        const toPlayer = target.sub(actor.mesh.position);
        toPlayer.y = 0;
        const dist = toPlayer.length() || 1;
        actor.mesh.lookAt(player.position.x, actor.mesh.position.y, player.position.z);
        if (actor.kind !== "boss" || dist > 17) actor.mesh.position.addScaledVector(toPlayer.normalize(), actor.speed * dt);
        actor.mesh.position.x = clamp(actor.mesh.position.x, -11, 11);
        actor.cooldown -= dt;
        if (actor.cooldown <= 0) {
          const dir = player.position.clone().add(new THREE.Vector3(0, 0.9, 0)).sub(actor.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0))).normalize();
          shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(0, actor.kind === "infantry" ? 1 : 1.5, 0)), dir.multiplyScalar(actor.kind === "boss" ? 30 : 24), "enemy", actor.kind === "boss" ? 18 : actor.kind === "tank" ? 12 : 5));
          if (actor.kind === "boss") {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(Math.sin(a) * 25, 0, Math.cos(a) * 25), "enemy", 12));
          }
          actor.cooldown = actor.kind === "boss" ? 0.95 : 1.25;
        }
        if (dist < (actor.kind === "infantry" ? 1.55 : actor.kind === "boss" ? 5.2 : 2.4)) game.hp -= (actor.kind === "infantry" ? 18 : 28) * dt;
        if (actor.hp <= 0) {
          scene.remove(actor.mesh);
          disposeObject(actor.mesh);
          actors.splice(i, 1);
        }
      }

      for (let i = shots.length - 1; i >= 0; i -= 1) {
        const shot = shots[i];
        shot.life -= dt;
        shot.mesh.position.addScaledVector(shot.velocity, dt);
        if (shot.owner === "player") {
          for (const actor of actors) {
            if (shot.mesh.position.distanceTo(actor.mesh.position.clone().add(new THREE.Vector3(0, actor.kind === "boss" ? 2.1 : 0.9, 0))) < (actor.kind === "boss" ? 4.8 : 1.45)) {
              actor.hp -= shot.damage;
              shot.life = 0;
            }
          }
        } else if (shot.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 0.85, 0))) < 1.5) {
          game.hp -= shot.damage;
          shot.life = 0;
        }
        if (shot.life <= 0 || Math.abs(shot.mesh.position.x) > 90 || shot.mesh.position.z < -290 || shot.mesh.position.z > 80) {
          scene.remove(shot.mesh);
          shot.mesh.geometry.dispose();
          (shot.mesh.material as THREE.Material).dispose();
          shots.splice(i, 1);
        }
      }

      if (game.hp <= 0) {
        clearActors();
        Object.assign(game, { hp: game.maxHp, stop: 0, message: `Stage ${game.stage} restarted. Drive forward and break through.` });
        player.position.set(0, 0, 34);
      }

      const focus = player.position.clone().add(new THREE.Vector3(0, 1.35, 0));
      const back = new THREE.Vector3(Math.sin(game.aimYaw), 0, -Math.cos(game.aimYaw)).multiplyScalar(-10.5);
      camera.position.copy(focus).add(back);
      camera.position.y += 5.2;
      const look = focus.clone().add(new THREE.Vector3(Math.sin(game.aimYaw), Math.sin(game.aimPitch) + 0.08, -Math.cos(game.aimYaw)).multiplyScalar(28));
      camera.lookAt(look);
      renderer.render(scene, camera);
      if (hudRef.current) {
        const boss = actors.find((actor) => actor.kind === "boss");
        const bossText = boss ? ` • BOSS ${Math.ceil((boss.hp / boss.maxHp) * 100)}% (${Math.ceil(boss.hp / (16 + game.stage * 1.7))} shots left)` : "";
        hudRef.current.textContent = `Tank Plus 3D Run • Stage ${Math.min(game.stage, 12)} / 12 • Hull ${Math.max(0, Math.round(game.hp))}${bossText} • ${game.message} • Click to lock mouse • WASD drive • Mouse aim • LMB/Space fire`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousemove", handleMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      clearActors();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      disposeObject(scene);
    };
  }, [keysRef]);

  return <><div ref={mountRef} className="h-full w-full" /><div ref={hudRef} className="absolute bottom-6 left-6 right-6 z-40 rounded-3xl border border-white/10 bg-black/55 px-5 py-4 text-sm font-bold text-white shadow-2xl backdrop-blur" /></>;
}
function PlanePlus3DCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useKeyTracker();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x6dd6ff);
    scene.fog = new THREE.Fog(0x6dd6ff, 50, 190);
    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 260);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x385e9a, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(12, 18, 16);
    scene.add(sun);

    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 26; i += 1) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(THREE.MathUtils.randFloat(1.4, 3.2), 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 }));
      cloud.scale.set(2.4, 0.45, 1);
      cloud.position.set(THREE.MathUtils.randFloatSpread(70), THREE.MathUtils.randFloat(-12, 14), THREE.MathUtils.randFloat(-130, 30));
      scene.add(cloud);
      clouds.push(cloud);
    }

    const player = createPlaneMesh("player");
    player.position.set(0, 0, 10);
    scene.add(player);
    const actors: ThreeActor[] = [];
    const shots: ThreeShot[] = [];
    const game = { stage: 1, hp: 110, maxHp: 110, distance: 0, cooldown: 0, bossSpawned: false, message: "3D sortie 1: fly the lane" };

    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);

    const spawnEnemy = (boss = false) => {
      const kind = boss ? "boss" : Math.random() < 0.28 ? "bomber" : "fighter";
      const mesh = createPlaneMesh(kind);
      mesh.position.set(THREE.MathUtils.randFloat(-14, 14), THREE.MathUtils.randFloat(-8, 8), -95);
      mesh.rotation.y = Math.PI;
      scene.add(mesh);
      const hp = kind === "boss" ? 100 + game.stage * 18 : kind === "bomber" ? 30 + game.stage * 3 : 14 + game.stage * 2;
      actors.push({ mesh, kind, hp, maxHp: hp, cooldown: 0.7, speed: kind === "boss" ? 0 : 22 + game.stage * 1.6 });
      if (boss) game.message = `3D Stage ${game.stage}: boss plane ahead!`;
    };

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.033);
      const keys = keysRef.current;
      if (game.stage <= 12) {
        const lateral = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
        const vertical = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
        player.position.x = clamp(player.position.x + lateral * 16 * dt, -15, 15);
        player.position.y = clamp(player.position.y + vertical * 12 * dt, -9, 10);
        player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -lateral * 0.35, dt * 6);
        player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, vertical * 0.18, dt * 6);
        game.distance += (50 + game.stage * 2) * dt;
        game.cooldown = Math.max(0, game.cooldown - dt);
        if ((keys.has("Space") || keys.has("KeyF")) && game.cooldown <= 0) {
          shots.push(makeShot(scene, player.position.clone().add(new THREE.Vector3(0, 0, -2.7)), new THREE.Vector3(0, 0, -70), "player", 11 + game.stage * 1.2));
          game.cooldown = 0.12;
        }
        if (!game.bossSpawned && game.distance < 820 && Math.random() < dt * (1.0 + game.stage * 0.08)) spawnEnemy(false);
        if (!game.bossSpawned && game.distance >= 820) {
          game.bossSpawned = true;
          spawnEnemy(true);
        }
        if (game.bossSpawned && actors.length === 0) {
          game.stage += 1;
          game.maxHp += 8;
          Object.assign(game, { hp: game.maxHp, distance: 0, bossSpawned: false, message: game.stage <= 12 ? `3D sortie ${game.stage}: next stage` : "3D plane campaign complete" });
        }
      }

      for (let i = actors.length - 1; i >= 0; i -= 1) {
        const actor = actors[i];
        if (actor.kind === "boss") {
          actor.mesh.position.x = Math.sin(clock.elapsedTime * 0.9) * 10;
          actor.mesh.position.y = Math.sin(clock.elapsedTime * 1.4) * 4;
        } else {
          actor.mesh.position.z += actor.speed * dt;
          actor.mesh.position.x += Math.sin(clock.elapsedTime * 2 + i) * dt * 4;
        }
        actor.mesh.lookAt(player.position);
        actor.cooldown -= dt;
        if (actor.cooldown <= 0) {
          const dir = player.position.clone().sub(actor.mesh.position).normalize();
          shots.push(makeShot(scene, actor.mesh.position.clone(), dir.multiplyScalar(actor.kind === "boss" ? 35 : 28), "enemy", actor.kind === "boss" ? 14 : 8));
          if (actor.kind === "boss") {
            shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(2, 0, 0)), new THREE.Vector3(0.8, 0, 1).normalize().multiplyScalar(32), "enemy", 10));
            shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(-2, 0, 0)), new THREE.Vector3(-0.8, 0, 1).normalize().multiplyScalar(32), "enemy", 10));
          }
          actor.cooldown = actor.kind === "boss" ? 0.55 : 1.2;
        }
        if (actor.mesh.position.distanceTo(player.position) < (actor.kind === "boss" ? 4.8 : 2.4)) {
          game.hp -= actor.kind === "boss" ? 20 : 12;
          actor.hp = 0;
        }
        if (actor.hp <= 0 || actor.mesh.position.z > 24) {
          scene.remove(actor.mesh);
          disposeObject(actor.mesh);
          actors.splice(i, 1);
        }
      }

      for (let i = shots.length - 1; i >= 0; i -= 1) {
        const shot = shots[i];
        shot.life -= dt;
        shot.mesh.position.addScaledVector(shot.velocity, dt);
        if (shot.owner === "player") {
          for (const actor of actors) {
            if (shot.mesh.position.distanceTo(actor.mesh.position) < (actor.kind === "boss" ? 4 : 1.8)) {
              actor.hp -= shot.damage;
              shot.life = 0;
            }
          }
        } else if (shot.mesh.position.distanceTo(player.position) < 1.5) {
          game.hp -= shot.damage;
          shot.life = 0;
        }
        if (shot.life <= 0) {
          scene.remove(shot.mesh);
          shot.mesh.geometry.dispose();
          (shot.mesh.material as THREE.Material).dispose();
          shots.splice(i, 1);
        }
      }
      if (game.hp <= 0) {
        for (const actor of actors.splice(0)) { scene.remove(actor.mesh); disposeObject(actor.mesh); }
        for (const shot of shots.splice(0)) { scene.remove(shot.mesh); shot.mesh.geometry.dispose(); (shot.mesh.material as THREE.Material).dispose(); }
        Object.assign(game, { hp: game.maxHp, distance: 0, bossSpawned: false, message: `3D Stage ${game.stage} restarted` });
        player.position.set(0, 0, 10);
      }

      for (const cloud of clouds) {
        cloud.position.z += dt * 24;
        if (cloud.position.z > 35) cloud.position.z = -135;
      }
      camera.position.set(player.position.x * 0.35, player.position.y + 5, 25);
      camera.lookAt(player.position.x * 0.2, player.position.y * 0.2, -24);
      renderer.render(scene, camera);
      if (hudRef.current) hudRef.current.textContent = `Plane Plus 3D • Stage ${Math.min(game.stage, 12)} / 12 • Hull ${Math.max(0, Math.round(game.hp))} • ${game.message} • WASD fly • Space/F fire`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      disposeObject(scene);
    };
  }, [keysRef]);

  return <><div ref={mountRef} className="h-full w-full" /><div ref={hudRef} className="absolute bottom-6 left-6 z-40 rounded-3xl border border-white/10 bg-black/55 px-5 py-4 text-sm font-bold text-white shadow-2xl backdrop-blur" /></>;
}

function TankPlusGame({ onMenu }: { onMenu: () => void }) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  if (mode === "2d") return <TankPlus2DGame onMenu={onMenu} on3d={() => setMode("3d")} />;
  return (
    <PlusShell
      title="Tank Campaign 3D"
      subtitle="12 street stages + 2D version available"
      onMenu={onMenu}
      modeAction={<button className="rounded-full border border-amber-200/25 bg-amber-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-amber-100 shadow-2xl backdrop-blur transition hover:bg-amber-300/25" onClick={() => setMode("2d")} type="button">2D Version</button>}
    >
      <TankPlus3DCanvas />
    </PlusShell>
  );
}

function PlanePlusGame({ onMenu }: { onMenu: () => void }) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  if (mode === "2d") return <PlanePlus2DGame onMenu={onMenu} on3d={() => setMode("3d")} />;
  return (
    <PlusShell
      title="Plane Campaign 3D"
      subtitle="12 boss-plane sorties + 2D version available"
      onMenu={onMenu}
      modeAction={<button className="rounded-full border border-amber-200/25 bg-amber-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-amber-100 shadow-2xl backdrop-blur transition hover:bg-amber-300/25" onClick={() => setMode("2d")} type="button">2D Version</button>}
    >
      <PlanePlus3DCanvas />
    </PlusShell>
  );
}

function createMarioStage(stage: number) {
  const length = 2300 + stage * 130;
  const groundY = 610;
  const platforms: Platform[] = [
    { x: 0, y: groundY, w: length, h: 110 },
    { x: 280, y: 500, w: 150, h: 24 },
    { x: 560, y: 440, w: 150, h: 24 },
    { x: 910, y: 505, w: 140, h: 24 },
    { x: 1250, y: 430, w: 170, h: 24 },
    { x: 1600, y: 500, w: 160, h: 24 },
    { x: 1960, y: 420, w: 180, h: 24 },
  ];
  for (let i = 0; i < stage; i += 1) platforms.push({ x: 2300 + i * 115, y: 500 - (i % 3) * 45, w: 95, h: 22 });
  const blocks: Block[] = [
    { x: 340, y: 430, w: 34, h: 34, used: false, reward: "coin" },
    { x: 620, y: 370, w: 34, h: 34, used: false, reward: "flower" },
    { x: 975, y: 435, w: 34, h: 34, used: false, reward: "coin" },
    { x: 1320, y: 360, w: 34, h: 34, used: false, reward: "flower" },
    { x: 2020, y: 350, w: 34, h: 34, used: false, reward: stage % 2 === 0 ? "flower" : "coin" },
  ];
  const coinsInWorld: Coin[] = [];
  for (const p of platforms) {
    if (p.x > 60) coinsInWorld.push({ x: p.x + p.w / 2, y: p.y - 36, r: 10, got: false });
    if (p.w > 140) coinsInWorld.push({ x: p.x + p.w / 2 + 42, y: p.y - 48, r: 10, got: false });
  }
  const enemies: Goomba[] = Array.from({ length: 4 + stage }, (_, i) => ({ x: 720 + i * 240, y: groundY - 38, w: 34, h: 38, vx: i % 2 ? -48 : 48, alive: true }));
  return { length, groundY, platforms, blocks, coinsInWorld, enemies };
}

function MarioPlusGame({ onMenu }: { onMenu: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ stage: 1, lives: 5, scoreCoins: 0, x: 90, y: 420, vx: 0, vy: 0, onGround: false, facing: 1, fire: false, cooldown: 0, camera: 0, shots: [] as Shot[], flowers: [] as Flower[], ...createMarioStage(1) });

  const resetStage = (stage: number) => {
    const s = stateRef.current;
    Object.assign(s, { stage, x: 90, y: 420, vx: 0, vy: 0, onGround: false, facing: 1, cooldown: 0, camera: 0, shots: [], flowers: [], ...createMarioStage(stage) });
  };

  useCanvasLoop(canvasRef, (ctx, w, h, dt, keys) => {
    const s = stateRef.current;
    ctx.clearRect(0, 0, w, h);
    if (s.stage > 12) {
      ctx.fillStyle = "#66bfff"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.font = "900 46px Inter, sans-serif"; ctx.fillText("MARIO PLUS COMPLETE", w / 2, h / 2); return;
    }
    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const jump = keys.has("KeyW") || keys.has("ArrowUp") || keys.has("Space");
    const fireKey = keys.has("KeyF") || keys.has("KeyJ");
    const accel = s.onGround ? 1800 : 1050;
    if (left) { s.vx -= accel * dt; s.facing = -1; }
    if (right) { s.vx += accel * dt; s.facing = 1; }
    if (!left && !right) s.vx *= Math.pow(0.001, dt);
    s.vx = clamp(s.vx, -310 - s.stage * 5, 310 + s.stage * 5);
    if (jump && s.onGround) { s.vy = -760; s.onGround = false; }
    s.vy += 2200 * dt;
    s.cooldown = Math.max(0, s.cooldown - dt);
    if (fireKey && s.fire && s.cooldown <= 0) { s.shots.push({ x: s.x + 18, y: s.y + 26, vx: s.facing * 520, vy: -80, r: 7, damage: 1, from: "fire" }); s.cooldown = 0.28; }

    const player: Rect = { x: s.x, y: s.y, w: 34, h: s.fire ? 62 : 48 };
    const solids: Rect[] = [...s.platforms, ...s.blocks];
    s.x += s.vx * dt; player.x = s.x;
    for (const solid of solids) if (overlap(player, solid)) { if (s.vx > 0) s.x = solid.x - player.w; else if (s.vx < 0) s.x = solid.x + solid.w; s.vx = 0; player.x = s.x; }
    s.y += s.vy * dt; player.y = s.y; s.onGround = false;
    for (const solid of solids) if (overlap(player, solid)) {
      if (s.vy > 0) { s.y = solid.y - player.h; s.vy = 0; s.onGround = true; }
      else if (s.vy < 0) {
        s.y = solid.y + solid.h; s.vy = 0;
        const block = s.blocks.find((b) => b === solid && !b.used);
        if (block) {
          block.used = true;
          if (block.reward === "coin") s.scoreCoins += 1;
          else s.flowers.push({ x: block.x + 2, y: block.y - 30, w: 30, h: 30, vx: 70, vy: -220, active: true });
        }
      }
      player.y = s.y;
    }
    if (s.y > h + 200) { s.lives -= 1; resetStage(s.stage); return; }
    s.x = clamp(s.x, 0, s.length - player.w);

    for (const coin of s.coinsInWorld) if (!coin.got && Math.hypot(s.x + 17 - coin.x, s.y + 24 - coin.y) < 28) { coin.got = true; s.scoreCoins += 1; }
    for (const flower of s.flowers) if (flower.active) {
      flower.vy += 1800 * dt; flower.x += flower.vx * dt; flower.y += flower.vy * dt;
      for (const solid of solids) if (overlap(flower, solid)) { if (flower.vy > 0) { flower.y = solid.y - flower.h; flower.vy = 0; } else flower.vx *= -1; }
      if (overlap(player, flower)) { flower.active = false; s.fire = true; }
    }
    for (const shot of s.shots) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.vy += 900 * dt; }
    for (const enemy of s.enemies) if (enemy.alive) {
      enemy.x += enemy.vx * dt;
      if (enemy.x < 120 || enemy.x > s.length - 160) enemy.vx *= -1;
      if (overlap(player, enemy)) {
        if (s.vy > 0 && s.y + player.h - enemy.y < 24) { enemy.alive = false; s.vy = -480; }
        else if (s.fire) s.fire = false; else { s.lives -= 1; resetStage(s.stage); return; }
      }
      for (const shot of s.shots) if (shot.x > enemy.x && shot.x < enemy.x + enemy.w && shot.y > enemy.y && shot.y < enemy.y + enemy.h) { enemy.alive = false; shot.x = -9999; }
    }
    s.shots = s.shots.filter((p) => p.x > s.camera - 100 && p.x < s.camera + w + 100 && p.y < h + 100);
    if (s.x > s.length - 120) resetStage(s.stage + 1);
    s.camera = clamp(s.x - w * 0.35, 0, Math.max(0, s.length - w));

    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#65bdff"); sky.addColorStop(1, "#dcf7ff"); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(-s.camera, 0);
    for (const p of s.platforms) { ctx.fillStyle = "#b87335"; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = "#54b948"; ctx.fillRect(p.x, p.y - 12, p.w, 12); }
    for (const b of s.blocks) { ctx.fillStyle = b.used ? "#a28b68" : "#f2b33c"; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = "#845016"; ctx.strokeRect(b.x, b.y, b.w, b.h); if (!b.used) { ctx.fillStyle = "white"; ctx.font = "900 22px Inter"; ctx.fillText("?", b.x + 10, b.y + 25); } }
    for (const c of s.coinsInWorld) if (!c.got) { ctx.fillStyle = "#ffd84f"; ctx.beginPath(); ctx.ellipse(c.x, c.y, 7, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const f of s.flowers) if (f.active) { ctx.fillStyle = "#ff4a55"; ctx.beginPath(); ctx.arc(f.x + 15, f.y + 12, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffe96b"; ctx.fillRect(f.x + 10, f.y + 9, 10, 16); }
    for (const e of s.enemies) if (e.alive) { ctx.fillStyle = "#8b4a25"; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.fillStyle = "#24140d"; ctx.fillRect(e.x + 7, e.y + 10, 5, 5); ctx.fillRect(e.x + 22, e.y + 10, 5, 5); }
    for (const shot of s.shots) { ctx.fillStyle = "#ff7a2f"; ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = s.fire ? "#ff513d" : "#d32828"; ctx.fillRect(s.x + 6, s.y + 16, 24, player.h - 16); ctx.fillStyle = "#e8b58d"; ctx.fillRect(s.x + 9, s.y + 2, 18, 18); ctx.fillStyle = "#1e55b8"; ctx.fillRect(s.x + 6, s.y + player.h - 16, 9, 16); ctx.fillRect(s.x + 21, s.y + player.h - 16, 9, 16);
    ctx.fillStyle = "#ececec"; ctx.fillRect(s.length - 80, 210, 8, 400); ctx.fillStyle = "#35c85a"; ctx.beginPath(); ctx.moveTo(s.length - 72, 220); ctx.lineTo(s.length - 10, 244); ctx.lineTo(s.length - 72, 270); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(20, h - 92, 520, 70); ctx.fillStyle = "white"; ctx.font = "800 20px Inter, sans-serif"; ctx.fillText(`Mario Plus Stage ${Math.min(s.stage, 12)} / 12`, 38, h - 62); ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(`Coins ${s.scoreCoins} • Lives ${s.lives} • Power ${s.fire ? "Fire Flower" : "Small"} • WASD jump/move • F/J fireballs`, 38, h - 36);
  }, []);

  return <PlusShell title="Mario Plus" subtitle="12 harder obby stages + lucky blocks" onMenu={onMenu}><canvas ref={canvasRef} /></PlusShell>;
}

function createStreetEnemies(stage: number): StreetEnemy[] {
  const enemies: StreetEnemy[] = [];
  const count = 3 + stage;
  for (let i = 0; i < count; i += 1) {
    const isBoss = i === count - 1 && (stage % 3 === 0 || stage === 10);
    const isBruiser = isBoss || i % 4 === 2;
    const kind: StreetEnemy["kind"] = isBoss ? "boss" : isBruiser ? "bruiser" : "thug";
    const hp = kind === "boss" ? 120 + stage * 28 : kind === "bruiser" ? 48 + stage * 9 : 28 + stage * 6;
    enemies.push({
      x: 470 + i * 175,
      y: 0,
      w: kind === "boss" ? 64 : kind === "bruiser" ? 54 : 44,
      h: kind === "boss" ? 92 : kind === "bruiser" ? 78 : 68,
      kind,
      hp,
      maxHp: hp,
      lane: (i % 3 - 1) * 34,
      vx: 0,
      cooldown: 0.7 + i * 0.18,
      hitStun: 0,
      damage: kind === "boss" ? 22 + stage * 2 : kind === "bruiser" ? 14 + stage : 9 + stage,
      alive: true,
    });
  }
  return enemies;
}

function StreetFightPro2DGame({ onMenu, on3d }: { onMenu: () => void; on3d?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    stage: 1,
    length: 1900,
    x: 90,
    lane: 0,
    jump: 0,
    jumpV: 0,
    facing: 1,
    hp: 120,
    green: 100,
    camera: 0,
    cooldown: 0,
    attackTimer: 0,
    attackType: "none" as "none" | "punch" | "kick" | "special",
    attackHit: false,
    message: "Street Fight Pro: clear each block to advance.",
    prevJ: false,
    prevK: false,
    prevI: false,
    prevL: false,
    enemies: createStreetEnemies(1),
  });

  const resetStage = (stage: number) => {
    const s = stateRef.current;
    Object.assign(s, {
      stage,
      length: 1750 + stage * 150,
      x: 90,
      lane: 0,
      jump: 0,
      jumpV: 0,
      facing: 1,
      cooldown: 0,
      attackTimer: 0,
      attackType: "none" as const,
      attackHit: false,
      message: stage > 10 ? "Street Fight Pro complete!" : `Stage ${stage}: fight through the street gang!`,
      enemies: createStreetEnemies(stage),
    });
  };

  useCanvasLoop(canvasRef, (ctx, w, h, dt, keys) => {
    const s = stateRef.current;
    const groundY = h - 112;
    const playerW = 48;
    const playerH = 76;
    const playerY = groundY - playerH + s.lane - s.jump;

    const jDown = keys.has("KeyJ");
    const kDown = keys.has("KeyK");
    const iDown = keys.has("KeyI");
    const lDown = keys.has("KeyL");
    const jPressed = jDown && !s.prevJ;
    const kPressed = kDown && !s.prevK;
    const iPressed = iDown && !s.prevI;
    const lPressed = lDown && !s.prevL;
    s.prevJ = jDown;
    s.prevK = kDown;
    s.prevI = iDown;
    s.prevL = lDown;

    ctx.clearRect(0, 0, w, h);
    if (s.hp <= 0) {
      ctx.fillStyle = "#171016";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "900 48px Inter, sans-serif";
      ctx.fillText("KNOCKED OUT", w / 2, h / 2 - 28);
      ctx.font = "700 18px Inter, sans-serif";
      ctx.fillText("Press I to restart Street Fight Pro", w / 2, h / 2 + 18);
      if (iPressed) {
        s.hp = 120;
        s.green = 100;
        resetStage(1);
      }
      return;
    }
    if (s.stage > 10) {
      ctx.fillStyle = "#10251d";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#7dff9d";
      ctx.textAlign = "center";
      ctx.font = "900 46px Inter, sans-serif";
      ctx.fillText("STREET FIGHT PRO COMPLETE", w / 2, h / 2);
      ctx.font = "700 18px Inter, sans-serif";
      ctx.fillText("You cleared all 10 street stages.", w / 2, h / 2 + 36);
      return;
    }

    const left = keys.has("KeyA") || keys.has("ArrowLeft");
    const right = keys.has("KeyD") || keys.has("ArrowRight");
    const up = keys.has("KeyW") || keys.has("ArrowUp");
    const down = keys.has("KeyS") || keys.has("ArrowDown");
    const move = 260;
    if (left) { s.x -= move * dt; s.facing = -1; }
    if (right) { s.x += move * dt; s.facing = 1; }
    if (up) s.lane -= 170 * dt;
    if (down) s.lane += 170 * dt;
    s.x = clamp(s.x, 35, s.length - playerW - 60);
    s.lane = clamp(s.lane, -72, 64);
    if (kPressed && s.jump <= 0) {
      s.jumpV = 610;
      s.message = "Jump! Use K to hop over crowded fights.";
    }
    if (s.jump > 0 || s.jumpV > 0) {
      s.jump += s.jumpV * dt;
      s.jumpV -= 1500 * dt;
      if (s.jump <= 0) { s.jump = 0; s.jumpV = 0; }
    }

    s.cooldown = Math.max(0, s.cooldown - dt);
    if (s.attackTimer > 0) s.attackTimer = Math.max(0, s.attackTimer - dt);
    if (s.attackTimer <= 0) { s.attackType = "none"; s.attackHit = false; }
    if (jPressed && s.cooldown <= 0) {
      s.attackType = "punch";
      s.attackTimer = 0.16;
      s.attackHit = false;
      s.cooldown = 0.22;
      s.message = "Punch is free. Land hits to restore green health.";
    } else if (lPressed && s.cooldown <= 0) {
      s.attackType = "kick";
      s.attackTimer = 0.22;
      s.attackHit = false;
      s.cooldown = 0.36;
      s.message = "Kick has longer reach and no green cost.";
    } else if (iPressed && s.cooldown <= 0 && s.green >= 25) {
      s.green = Math.max(0, s.green - 25);
      s.attackType = "special";
      s.attackTimer = 0.36;
      s.attackHit = false;
      s.cooldown = 0.72;
      s.message = "Tornado kick special spends green health for a wide hit.";
    } else if (iPressed && s.green < 25) {
      s.message = "Need 25 green health for the special move.";
    }

    const player: Rect = { x: s.x, y: playerY, w: playerW, h: playerH };
    const attackRange = s.attackType === "special" ? 138 : s.attackType === "kick" ? 82 : 62;
    const attackDamage = s.attackType === "special" ? 34 : s.attackType === "kick" ? 16 : 12;
    const attackBox: Rect = {
      x: s.facing > 0 ? s.x + playerW - 6 : s.x - attackRange + 6,
      y: playerY + 6,
      w: attackRange,
      h: playerH - 8,
    };

    for (const enemy of s.enemies) if (enemy.alive) {
      enemy.hitStun = Math.max(0, enemy.hitStun - dt);
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      const enemyY = groundY - enemy.h + enemy.lane;
      enemy.y = enemyY;
      if (enemy.hitStun <= 0) {
        const dx = s.x - enemy.x;
        const laneDiff = s.lane - enemy.lane;
        if (Math.abs(dx) > 58) enemy.x += Math.sign(dx) * (enemy.kind === "boss" ? 78 : enemy.kind === "bruiser" ? 95 : 120) * dt;
        if (Math.abs(laneDiff) > 10) enemy.lane += Math.sign(laneDiff) * 90 * dt;
      }
      enemy.x = clamp(enemy.x, 80, s.length - 100);

      if (s.attackType !== "none" && s.attackTimer > 0 && !s.attackHit && overlap(attackBox, enemy)) {
        enemy.hp -= attackDamage;
        enemy.hitStun = s.attackType === "special" ? 0.48 : 0.26;
        enemy.x += s.facing * (s.attackType === "special" ? 72 : 36);
        s.green = clamp(s.green + (s.attackType === "special" ? 0 : s.attackType === "kick" ? 15 : 13), 0, 100);
        s.attackHit = true;
        s.message = "Hit confirmed! Green health restored.";
        if (enemy.hp <= 0) {
          enemy.alive = false;
          s.green = clamp(s.green + 18, 0, 100);
          s.message = enemy.kind === "boss" ? "Boss down! Keep moving." : "Enemy defeated. Green health restored.";
        }
      }

      const enemyRect: Rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (enemy.alive && enemy.cooldown <= 0 && overlap(player, enemyRect) && s.jump < 20) {
        s.hp -= enemy.damage;
        s.x -= s.facing * 54;
        enemy.cooldown = enemy.kind === "boss" ? 0.75 : 1.05;
        s.message = `Enemy hit! You lost ${enemy.damage} red health.`;
      }
    }

    s.enemies = s.enemies.filter((enemy) => enemy.alive || enemy.hp > -35);
    if (s.enemies.every((enemy) => !enemy.alive)) {
      s.hp = Math.min(120, s.hp + 18);
      s.green = 100;
      resetStage(s.stage + 1);
    }
    s.camera = clamp(s.x - w * 0.36, 0, Math.max(0, s.length - w));

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#16172d");
    sky.addColorStop(1, "#332019");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-s.camera, 0);
    for (let bx = -200; bx < s.length + 300; bx += 180) {
      ctx.fillStyle = bx % 360 === 0 ? "#25253f" : "#1d2135";
      ctx.fillRect(bx, 70 + (bx % 4) * 12, 142, groundY - 130);
      ctx.fillStyle = "rgba(255,218,105,.35)";
      for (let wy = 110; wy < groundY - 170; wy += 54) for (let wx = bx + 18; wx < bx + 116; wx += 42) ctx.fillRect(wx, wy, 18, 24);
    }
    ctx.fillStyle = "#22252d";
    ctx.fillRect(-200, groundY - 82, s.length + 400, 190);
    ctx.fillStyle = "#3b3f46";
    ctx.fillRect(-200, groundY - 106, s.length + 400, 24);
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.moveTo(-200, groundY - 20);
    ctx.lineTo(s.length + 300, groundY - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#facc15";
    ctx.font = "900 28px Inter, sans-serif";
    ctx.fillText(`STAGE ${s.stage}`, s.length - 220, groundY - 130);

    const drawFighter = (x: number, y: number, facing: number, body: string, head: string, isPlayer = false) => {
      ctx.save();
      ctx.translate(x + (facing < 0 ? 48 : 0), y);
      ctx.scale(facing, 1);
      ctx.fillStyle = head;
      ctx.fillRect(14, 0, 20, 20);
      ctx.fillStyle = body;
      ctx.fillRect(8, 22, 32, 38);
      ctx.fillStyle = "#111827";
      ctx.fillRect(8, 60, 12, 18);
      ctx.fillRect(28, 60, 12, 18);
      ctx.fillStyle = isPlayer ? "#bbf7d0" : "#fecaca";
      ctx.fillRect(40, 28, 18, 9);
      if (isPlayer && s.attackType !== "none" && s.attackTimer > 0) {
        ctx.fillStyle = s.attackType === "special" ? "rgba(34,211,238,.55)" : "rgba(250,204,21,.75)";
        ctx.fillRect(52, 24, attackRange, s.attackType === "special" ? 34 : 16);
      }
      ctx.restore();
    };

    const sorted = [...s.enemies].sort((a, b) => a.lane - b.lane);
    for (const enemy of sorted) if (enemy.alive) {
      const ex = enemy.x;
      const ey = groundY - enemy.h + enemy.lane;
      drawFighter(ex, ey, enemy.x > s.x ? -1 : 1, enemy.kind === "boss" ? "#7f1d1d" : enemy.kind === "bruiser" ? "#7c3aed" : "#475569", "#f0b68a");
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(ex - 6, ey - 14, enemy.w + 12, 6);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(ex - 6, ey - 14, (enemy.w + 12) * Math.max(0, enemy.hp / enemy.maxHp), 6);
    }
    drawFighter(s.x, playerY, s.facing, "#2563eb", "#f7c59f", true);
    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(20, h - 132, 670, 108);
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(42, h - 104, 220, 16);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(42, h - 104, 220 * Math.max(0, s.hp / 120), 16);
    ctx.fillStyle = "#064e3b";
    ctx.fillRect(42, h - 78, 220, 16);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(42, h - 78, 220 * Math.max(0, s.green / 100), 16);
    ctx.fillStyle = "white";
    ctx.font = "900 20px Inter, sans-serif";
    ctx.fillText(`Street Fight Pro • Stage ${s.stage} / 10`, 282, h - 94);
    ctx.font = "700 14px Inter, sans-serif";
    ctx.fillText(`Red HP ${Math.max(0, Math.round(s.hp))} • Green health ${Math.round(s.green)} • ${s.message}`, 282, h - 68);
    ctx.fillText("WASD move • J punch • K jump • I tornado kick (-green) • L kick • Hit enemies to restore green", 42, h - 38);
  }, []);

  return <PlusShell title="Street Fight Pro 2D" subtitle="$3 Pro slot: classic flat street fighting" onMenu={onMenu} modeAction={on3d ? <button className="rounded-full border border-cyan-200/25 bg-cyan-300/15 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-2xl backdrop-blur transition hover:bg-cyan-300/25" onClick={on3d} type="button">3D Version</button> : undefined}><canvas ref={canvasRef} /></PlusShell>;
}

function StreetFightPro3DCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const healthRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useKeyTracker();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17172d);
    scene.fog = new THREE.Fog(0x17172d, 45, 180);
    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 260);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcde7ff, 0x2d160c, 1.15));
    const streetLight = new THREE.DirectionalLight(0xffd79d, 1.85);
    streetLight.position.set(14, 24, 12);
    scene.add(streetLight);
    const neonLight = new THREE.PointLight(0x22d3ee, 1.7, 45);
    neonLight.position.set(-9, 5.5, -8);
    scene.add(neonLight);

    scene.background = new THREE.Color(0x17172d);
    scene.fog = new THREE.Fog(0x17172d, 38, 110);
    const road = new THREE.Mesh(new THREE.BoxGeometry(31, 0.2, 27), new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.95 }));
    road.position.set(0, -0.1, 0);
    scene.add(road);
    const laneLineMaterial = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -10; z <= 10; z += 4) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 1.8), laneLineMaterial);
      line.position.set(0, 0.05, z);
      scene.add(line);
    }
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x444851, roughness: 0.9 });
    for (const x of [-17.5, 17.5]) {
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.26, 27), sidewalkMaterial);
      sidewalk.position.set(x, 0, 0);
      scene.add(sidewalk);
    }
    for (let i = 0; i < 14; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const height = THREE.MathUtils.randFloat(8, 20);
      const building = new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(5.5, 9.5), height, THREE.MathUtils.randFloat(5, 10)), new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x263147 : 0x30283c, roughness: 0.86 }));
      building.position.set(side * THREE.MathUtils.randFloat(23, 30), height / 2, -12 + i * 1.85);
      scene.add(building);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 0.15), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x22c55e : 0xfacc15 }));
      sign.position.set(building.position.x - side * 2.7, 3.6, building.position.z);
      scene.add(sign);
    }
    for (const z of [-9, -2, 6, 12]) {
      const trash = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }));
      trash.position.set(THREE.MathUtils.randFloat(-12, 12), 0.6, z);
      scene.add(trash);
    }

    const player = createStreetFighterMesh("player");
    player.position.set(0, 0, 7);
    scene.add(player);

    type Street3DEnemy = ThreeActor & { damage: number; hitStun: number; contactTime: number; attacking: number; healthBar: THREE.Group; healthFill: THREE.Mesh };
    const enemies: Street3DEnemy[] = [];
    const game = {
      stage: 1,
      hp: 120,
      green: 100,
      cooldown: 0,
      attackTimer: 0,
      attackType: "none" as "none" | "punch" | "kick" | "special",
      attackHit: false,
      jump: 0,
      jumpV: 0,
      facing: 0,
      prevJ: false,
      prevK: false,
      prevI: false,
      prevL: false,
      message: "Blocky Street Fight: survive each wave in the street."
    };

    const clearEnemies = () => {
      for (const enemy of enemies.splice(0)) {
        scene.remove(enemy.mesh);
        scene.remove(enemy.healthBar);
        disposeObject(enemy.mesh);
        disposeObject(enemy.healthBar);
      }
    };
    const spawnStage = () => {
      clearEnemies();
      const count = 3 + game.stage;
      for (let i = 0; i < count; i += 1) {
        const isBoss = i === count - 1 && (game.stage % 3 === 0 || game.stage === 10);
        const kind: "thug" | "bruiser" | "boss" = isBoss ? "boss" : i % 4 === 2 ? "bruiser" : "thug";
        const mesh = createStreetFighterMesh(kind);
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        mesh.position.set(Math.sin(angle) * THREE.MathUtils.randFloat(5.5, 11.5), 0, Math.cos(angle) * THREE.MathUtils.randFloat(4.8, 10.5));
        scene.add(mesh);
        const hp = kind === "boss" ? 130 + game.stage * 30 : kind === "bruiser" ? 52 + game.stage * 9 : 30 + game.stage * 6;
        const healthBar = new THREE.Group();
        const barWidth = kind === "boss" ? 2.7 : 1.9;
        const healthBack = new THREE.Mesh(new THREE.BoxGeometry(barWidth, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0x7f1d1d }));
        const healthFill = new THREE.Mesh(new THREE.BoxGeometry(barWidth, 0.13, 0.09), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        healthFill.position.x = 0;
        healthBar.add(healthBack, healthFill);
        scene.add(healthBar);
        enemies.push({ mesh, kind, hp, maxHp: hp, cooldown: 0.6 + i * 0.2, speed: kind === "boss" ? 4.4 : kind === "bruiser" ? 5.5 : 6.7, damage: kind === "boss" ? 23 + game.stage * 2 : kind === "bruiser" ? 15 + game.stage : 9 + game.stage, hitStun: 0, contactTime: 0, attacking: 0, healthBar, healthFill });
      }
      player.position.set(0, 0, 7);
      game.green = 100;
      game.message = `Wave ${game.stage}: blocky enemies are rushing the street.`;
    };
    spawnStage();

    const clock = new THREE.Clock();
    let frame = 0;
    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.033);
      const keys = keysRef.current;
      const kDown = keys.has("KeyK");
      const kPressed = kDown && !game.prevK;
      game.prevK = kDown;

      if (game.hp <= 0) {
        if (keys.has("KeyR") || keys.has("Enter")) {
          Object.assign(game, { stage: 1, hp: 120, green: 100, cooldown: 0, attackTimer: 0, attackType: "none" as const, message: "Restarted Blocky Street Fight." });
          spawnStage();
        }
      } else if (game.stage <= 10) {
        const moveX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
        const moveZ = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
        const move = new THREE.Vector3(moveX, 0, moveZ);
        const isMoving = move.lengthSq() > 0;
        if (isMoving) {
          move.normalize();
          player.position.addScaledVector(move, 9.6 * dt);
          game.facing = Math.atan2(move.x, -move.z);
        }
        player.position.x = clamp(player.position.x, -14, 14);
        player.position.z = clamp(player.position.z, -12, 12);
        player.rotation.y = game.facing;

        if (kPressed && game.jump <= 0) { game.jumpV = 7.5; game.message = "K jump: hop over close enemies."; }
        if (game.jump > 0 || game.jumpV > 0) {
          game.jump += game.jumpV * dt;
          game.jumpV -= 18 * dt;
          if (game.jump <= 0) { game.jump = 0; game.jumpV = 0; }
        }
        player.position.y = game.jump;
        game.cooldown = Math.max(0, game.cooldown - dt);
        game.attackTimer = Math.max(0, game.attackTimer - dt);
        if (game.attackTimer <= 0) { game.attackType = "none"; game.attackHit = false; }

        const autoPunchRange = 3.15;
        let nearestEnemy: Street3DEnemy | undefined;
        let nearestDistance = Infinity;
        for (const enemy of enemies) {
          const distance = enemy.mesh.position.distanceTo(player.position);
          if (distance < nearestDistance) {
            nearestEnemy = enemy;
            nearestDistance = distance;
          }
        }
        if (nearestEnemy && nearestDistance <= autoPunchRange && game.cooldown <= 0) {
          const aim = nearestEnemy.mesh.position.clone().sub(player.position);
          aim.y = 0;
          if (aim.lengthSq() > 0.001) game.facing = Math.atan2(aim.x, -aim.z);
          player.rotation.y = game.facing;
          Object.assign(game, { attackType: "punch" as const, attackTimer: 0.18, attackHit: false, cooldown: 0.16, message: "Auto combo: blocky punches fire when enemies are close." });
        }

        const forward = new THREE.Vector3(Math.sin(game.facing), 0, -Math.cos(game.facing));
        const attackRange = autoPunchRange;
        const attackDamage = 10 + Math.min(game.stage, 10) * 0.8;
        animateStreetFighterMesh(player, dt, { moving: isMoving, jumping: game.jump > 0.05, attack: game.attackType, attacking: game.attackType !== "none" && game.attackTimer > 0 });

        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          const enemy = enemies[i];
          enemy.cooldown = Math.max(0, enemy.cooldown - dt);
          enemy.hitStun = Math.max(0, enemy.hitStun - dt);
          enemy.attacking = Math.max(0, enemy.attacking - dt);
          const toPlayer = player.position.clone().sub(enemy.mesh.position); toPlayer.y = 0;
          const dist = toPlayer.length() || 1;
          enemy.mesh.lookAt(player.position.x, enemy.mesh.position.y, player.position.z);
          const enemyMoving = enemy.hitStun <= 0 && dist > 2.0;
          if (enemyMoving) enemy.mesh.position.addScaledVector(toPlayer.normalize(), enemy.speed * dt);
          enemy.mesh.position.x = clamp(enemy.mesh.position.x, -14.2, 14.2);
          enemy.mesh.position.z = clamp(enemy.mesh.position.z, -12.2, 12.2);
          animateStreetFighterMesh(enemy.mesh, dt, { moving: enemyMoving, enemySwing: enemy.attacking > 0 });
          enemy.healthBar.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, enemy.kind === "boss" ? 4.6 : enemy.kind === "bruiser" ? 3.85 : 3.3, 0));
          enemy.healthBar.lookAt(camera.position);
          enemy.healthFill.scale.x = Math.max(0.03, enemy.hp / enemy.maxHp);
          if (game.attackType === "punch" && game.attackTimer > 0 && !game.attackHit) {
            const toEnemy = enemy.mesh.position.clone().sub(player.position); toEnemy.y = 0;
            const enemyDistance = toEnemy.length();
            const rangeOk = enemyDistance < attackRange + (enemy.kind === "boss" ? 1.2 : 0.4);
            const angleOk = enemyDistance <= 1.25 || toEnemy.normalize().dot(forward) > 0.18;
            if (rangeOk && angleOk) {
              enemy.hp -= attackDamage;
              enemy.hitStun = 0.26;
              enemy.mesh.position.addScaledVector(forward, 0.95);
              game.green = 100;
              game.attackHit = true;
              game.message = "Blocky auto-punch landed! Walk into range to keep the combo going.";
            }
          }
          if (enemy.hp <= 0) {
            scene.remove(enemy.mesh);
            scene.remove(enemy.healthBar);
            disposeObject(enemy.mesh);
            disposeObject(enemy.healthBar);
            enemies.splice(i, 1);
            game.green = clamp(game.green + 18, 0, 100);
            continue;
          }
          const closeEnough = dist < (enemy.kind === "boss" ? 2.45 : 1.8) && game.jump < 0.35;
          if (closeEnough && enemy.cooldown <= 0) {
            enemy.contactTime += dt;
            if (enemy.contactTime > 0.62) {
              game.hp -= enemy.damage;
              player.position.addScaledVector(toPlayer.normalize(), 1.9);
              enemy.cooldown = enemy.kind === "boss" ? 0.75 : 1.05;
              enemy.contactTime = 0;
              enemy.attacking = 0.34;
              game.message = `Enemy stayed close and hit! You lost ${enemy.damage} red health.`;
            }
          } else {
            enemy.contactTime = Math.max(0, enemy.contactTime - dt * 2.5);
          }
        }
        if (enemies.length === 0) {
          game.stage += 1;
          game.hp = Math.min(120, game.hp + 18);
          if (game.stage <= 10) spawnStage();
          else game.message = "Blocky Street Fight complete!";
        }
      }

      camera.position.set(player.position.x, player.position.y + 7.4, player.position.z + 15.5);
      camera.lookAt(player.position.x, player.position.y + 1.25, player.position.z - 3.5);
      renderer.render(scene, camera);
      const status = game.hp <= 0 ? "KNOCKED OUT • Press R to restart" : game.stage > 10 ? "COMPLETE" : game.message;
      if (hudRef.current) {
        hudRef.current.textContent = `Blocky Street Fight • Wave ${Math.min(game.stage, 10)} / 10 • ${status} • WASD move • Walk close to auto-punch • K jump`;
      }
      if (healthRef.current) {
        healthRef.current.innerHTML = `<div class="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-white"><span>Red Health</span><span>${Math.max(0, Math.round(game.hp))}/120</span></div><div class="h-4 overflow-hidden rounded-full bg-red-950 ring-1 ring-white/15"><div class="h-full rounded-full bg-red-500" style="width:${Math.max(0, Math.min(100, (game.hp / 120) * 100))}%"></div></div><div class="mt-3 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 p-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Auto punch range: walk up to enemies and the combo starts by itself.</div>`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      clearEnemies();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      disposeObject(scene);
    };
  }, [keysRef]);

  return <><div ref={mountRef} className="h-full w-full" /><div ref={healthRef} className="absolute left-6 top-28 z-40 w-80 rounded-3xl border border-white/10 bg-black/60 px-5 py-4 shadow-2xl backdrop-blur" /><div ref={hudRef} className="absolute bottom-6 left-6 right-6 z-40 rounded-3xl border border-white/10 bg-black/55 px-5 py-4 text-sm font-bold text-white shadow-2xl backdrop-blur" /></>;
}

function StreetFightProGame({ onMenu }: { onMenu: () => void }) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  if (mode === "2d") return <StreetFightPro2DGame onMenu={onMenu} on3d={() => setMode("3d")} />;
  return (
    <PlusShell
      title="Blocky Street Fight"
      subtitle="$3 Pro slot: 10-wave auto-punch blocky street beat 'em up"
      onMenu={onMenu}
    >
      <StreetFightPro3DCanvas />
    </PlusShell>
  );
}

function PlusPlanScreen({ continueToPlus }: { continueToPlus: (access: PlusAccess) => void }) {
  const [selectedPlan, setSelectedPlan] = useState<"trial" | "three" | "nine" | null>(null);
  const [planPassword, setPlanPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const plans = [
    {
      id: "trial" as const,
      name: "Free Trial",
      price: "$0",
      detail: "Try everything first",
      badge: "Decor only",
      button: "Start Free Trial",
    },
    {
      id: "three" as const,
      name: "Plus Forever",
      price: "$3",
      detail: "Pay once and play forever — Pro slot shows Street Fight Pro",
      badge: "$3 Pro slot",
      button: "Choose $3 Plan",
    },
    {
      id: "nine" as const,
      name: "Ultra Forever",
      price: "$9",
      detail: "Premium-looking forever pass",
      badge: "Same access",
      button: "Choose $9 Plan",
    },
  ];
  const selectedPlanInfo = plans.find((plan) => plan.id === selectedPlan);

  const submitPlanPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlan) return;
    if (selectedPlan === "trial") {
      continueToPlus("trial");
      return;
    }
    const expected = selectedPlan === "three" ? String.fromCharCode(48, 57, 56, 55) : String.fromCharCode(49, 51, 53, 55);
    if (planPassword === expected) {
      continueToPlus(selectedPlan);
      return;
    }
    setPasswordError("Wrong password");
    setPlanPassword("");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.25),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#111827_48%,_#2f1d05_100%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-amber-200/20 bg-white/5 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur">
          <Link className="text-sm font-bold uppercase tracking-[0.24em] text-white/80 hover:text-white" to="/">← Back to Lobby</Link>
          <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-950">GET PLUS</span>
        </nav>

        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-200">Choose your Plus pass</p>
          <h1 className="mt-4 text-6xl font-black tracking-tight sm:text-7xl">Pick any option</h1>
          <p className="mt-6 text-xl leading-8 text-slate-300">
            Plus adds bigger campaign-style versions of the arcade: 12-stage Tank missions, 12-stage Plane missions,
            Mario Plus worlds, and a new $3 Pro-slot Street Fight game.
          </p>
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 text-slate-200 shadow-xl shadow-black/20 backdrop-blur">
            <h2 className="text-lg font-black text-white">What does Plus do?</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 sm:grid-cols-4">
              <li><strong className="text-amber-200">Tank Plus:</strong> run-through 3D tank stages with ambushes and boss tanks.</li>
              <li><strong className="text-cyan-200">Plane Plus:</strong> stage-based sky missions with boss planes.</li>
              <li><strong className="text-orange-200">Mario Plus:</strong> harder 2D stages, reachable coins, lucky blocks, and fireballs.</li>
              <li><strong className="text-emerald-200">Blocky Street Fight:</strong> blocky wave-by-wave street fights where walking into range starts auto-punch combos.</li>
            </ul>
            <p className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-100">
              Free Trial opens the Plus games except Street Fight Pro. The $3 and $9 passwords unlock Street Fight Pro too.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <button
              key={plan.name}
              className={`group rounded-[1.75rem] border p-6 text-left shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-2 hover:bg-white/[0.12] ${
                index === 1
                  ? "border-amber-200/40 bg-amber-300/[0.13]"
                  : "border-white/10 bg-white/[0.07]"
              }`}
              onClick={() => {
                setSelectedPlan(plan.id);
                setPlanPassword("");
                setPasswordError("");
              }}
              type="button"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-100 ring-1 ring-white/10">
                  {plan.badge}
                </span>
                {index === 1 && (
                  <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-950">
                    Popular
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black">{plan.name}</h2>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl font-black tracking-tight">{plan.price}</span>
                <span className="pb-2 text-sm font-bold uppercase tracking-[0.18em] text-slate-300">forever</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{plan.detail}</p>
              <p className="mt-3 rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-3 text-sm font-bold text-cyan-100">
                Free Trial excludes Street Fight Pro. $3 and $9 unlock every mode.
              </p>
              {index === 1 && (
                <div className="mt-3 rounded-2xl border border-emerald-200/25 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">
                  New under the $3 Pro slot: Blocky Street Fight — WASD move, walk close to auto-punch, K jump.
                </div>
              )}
              <span className="mt-6 inline-block rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
                {plan.button}
              </span>
            </button>
          ))}
        </div>

        {selectedPlanInfo && (
          <form className="mt-8 max-w-md rounded-[1.5rem] border border-white/10 bg-black/45 p-5 shadow-2xl shadow-black/30 backdrop-blur" onSubmit={submitPlanPassword}>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-200">{selectedPlanInfo.name}</p>
            <label className="mt-3 block text-sm font-bold text-slate-200" htmlFor="plan-password">
              {selectedPlan === "three" ? "Enter the $3 password" : selectedPlan === "nine" ? "Enter the $9 password" : "Free trial: no extra password needed"}
            </label>
            <input
              autoFocus
              className="mt-3 w-full rounded-2xl border border-white/15 bg-white px-4 py-3 text-center text-xl font-black text-slate-950 outline-none focus:border-amber-300"
              id="plan-password"
              onChange={(event) => {
                setPlanPassword(event.target.value);
                setPasswordError("");
              }}
              placeholder={selectedPlan === "trial" ? "Press Enter" : "Password"}
              type="password"
              value={planPassword}
            />
            {passwordError && <p className="mt-3 text-sm font-bold text-red-300">{passwordError}</p>}
            <div className="mt-4 flex gap-3">
              <button className="rounded-full bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950" type="submit">
                Unlock
              </button>
              <button className="rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white" onClick={() => setSelectedPlan(null)} type="button">
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function PlusMenu({ setGame, access }: { setGame: (game: PlusGame) => void; access: PlusAccess }) {
  const cards = [
    { id: "tank" as const, title: "Tank Plus Campaign", desc: "12 street stages. Roll forward, stop at ambushes, clear infantry and tanks, then defeat a boss tank at each stage end.", accent: "from-lime-300 to-emerald-500" },
    { id: "plane" as const, title: "Plane Plus Campaign", desc: "12 sky sorties with no infantry: fighters and bombers rush your lane, then a boss plane guards every stage finish.", accent: "from-cyan-300 to-blue-500" },
    { id: "mario" as const, title: "Mario Plus Worlds", desc: "12 harder obby stages with reachable coins, reachable lucky blocks, fire flowers, and fireballs.", accent: "from-amber-300 to-orange-500" },
    { id: "street" as const, title: "Blocky Street Fight", desc: "$3 Pro-slot game. Fight wave by wave on a city street with blocky characters. Walk close and your character auto-punches; K jumps.", accent: "from-emerald-300 to-green-600" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.22),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#111827_48%,_#2f1d05_100%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-amber-200/20 bg-white/5 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur">
          <Link className="text-sm font-bold uppercase tracking-[0.24em] text-white/80 hover:text-white" to="/">← Back to Lobby</Link>
          <div className="flex items-center gap-3">
            <button className="text-xs font-black uppercase tracking-[0.18em] text-white/70 hover:text-white" onClick={() => setGame("plans")} type="button">Change Plan</button>
            <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-950">GET PLUS</span>
          </div>
        </nav>
        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-200">Plus Arcade Expansion</p>
          <h1 className="mt-4 text-6xl font-black tracking-tight sm:text-7xl">Stage-by-stage campaigns</h1>
          <p className="mt-6 text-xl leading-8 text-slate-300">Pick a Plus mode. These are campaign versions built around stage progression, boss endings, and new power mechanics.</p>
          {access === "trial" && (
            <p className="mt-4 rounded-2xl border border-amber-200/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
              Free Trial active: Street Fight Pro is locked. Use a paid-plan password to unlock it.
            </p>
          )}
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {cards.map((card) => {
            const locked = card.id === "street" && access === "trial";
            return (
              <button
                key={card.id}
                className={`group rounded-[1.75rem] border p-6 text-left shadow-xl shadow-black/20 backdrop-blur transition ${
                  locked
                    ? "cursor-not-allowed border-red-200/20 bg-red-950/25 opacity-70"
                    : "border-white/10 bg-white/[0.07] hover:-translate-y-2 hover:border-white/25 hover:bg-white/[0.11]"
                }`}
                disabled={locked}
                onClick={() => setGame(card.id)}
                type="button"
              >
                <div className={`mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br ${card.accent} shadow-lg transition group-hover:rotate-3 group-hover:scale-105`} />
                <h2 className="text-2xl font-bold">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.desc}</p>
                {locked && <p className="mt-4 rounded-2xl border border-red-200/20 bg-red-500/10 p-3 text-sm font-black text-red-100">Locked in Free Trial — choose $3 or $9 first.</p>}
                <span className="mt-6 inline-block rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950">{locked ? "Locked" : "Play Plus"}</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default function Plus() {
  const [game, setGame] = useState<PlusGame>("plans");
  const [access, setAccess] = useState<PlusAccess>("trial");
  const unlockPlan = (nextAccess: PlusAccess) => {
    setAccess(nextAccess);
    setGame("menu");
  };
  if (game === "tank") return <TankPlusGame onMenu={() => setGame("menu")} />;
  if (game === "plane") return <PlanePlusGame onMenu={() => setGame("menu")} />;
  if (game === "mario") return <MarioPlusGame onMenu={() => setGame("menu")} />;
  if (game === "street") {
    if (access === "trial") return <PlusMenu setGame={setGame} access={access} />;
    return <StreetFightProGame onMenu={() => setGame("menu")} />;
  }
  if (game === "menu") return <PlusMenu setGame={setGame} access={access} />;
  return <PlusPlanScreen continueToPlus={unlockPlan} />;
}
