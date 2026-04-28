import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import * as THREE from "three";

import type { Route } from "./+types/plus";

type PlusGame = "menu" | "tank" | "plane" | "mario";

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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GET PLUS | Harry's Game Center" },
    {
      name: "description",
      content: "Plus campaign modes with stage-based tank, plane, and platformer adventures.",
    },
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
            s.enemies.push({ x: w - 210, y: roadMid - 62, w: 132, h: 124, kind: "boss", hp: 70 + s.stage * 13, maxHp: 70 + s.stage * 13, cooldown: 0.5, speed: 0 });
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
      ctx.fillStyle = "#ff4f4f";
      ctx.fillRect(enemy.x, enemy.y - 10, enemy.w, 5);
      ctx.fillStyle = "#79ff86";
      ctx.fillRect(enemy.x, enemy.y - 10, enemy.w * Math.max(0, enemy.hp / enemy.maxHp), 5);
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
  kind: "infantry" | "tank" | "boss" | "fighter" | "bomber";
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
    scene.background = new THREE.Color(0x8fb1d6);
    scene.fog = new THREE.Fog(0x8fb1d6, 35, 130);
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 240);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0cc, 1.8);
    sun.position.set(12, 24, 10);
    scene.add(sun);

    const road = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 180), new THREE.MeshStandardMaterial({ color: 0x4b4d52, roughness: 0.95 }));
    road.position.z = -45;
    scene.add(road);
    const grass = new THREE.Mesh(new THREE.BoxGeometry(90, 0.15, 190), new THREE.MeshStandardMaterial({ color: 0x315d2d, roughness: 1 }));
    grass.position.set(0, -0.12, -45);
    scene.add(grass);
    grass.renderOrder = -1;

    const laneMarks: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i += 1) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 4.5), new THREE.MeshBasicMaterial({ color: 0xf7d46b }));
      mark.position.set(0, 0.02, 20 - i * 10);
      scene.add(mark);
      laneMarks.push(mark);
    }

    const player = createTankMesh("player");
    player.position.set(0, 0, 9);
    scene.add(player);

    const actors: ThreeActor[] = [];
    const shots: ThreeShot[] = [];
    const game = { stage: 1, hp: 130, maxHp: 130, progress: 0, stop: 0, cooldown: 0, message: "3D Stage 1: roll down the street" };
    const stops = [180, 410, 660];

    const spawnWave = () => {
      const boss = game.stop === 2;
      const count = boss ? 1 : 3 + Math.floor(game.stage * 0.6);
      for (let i = 0; i < count; i += 1) {
        const kind = boss ? "boss" : i % 3 === 0 ? "tank" : "infantry";
        const mesh = kind === "infantry" ? createSoldierMesh() : createTankMesh(kind);
        mesh.position.set(THREE.MathUtils.randFloat(-7, 7), 0, -55 - i * 5);
        if (kind !== "infantry") mesh.rotation.y = Math.PI;
        scene.add(mesh);
        const hp = kind === "boss" ? 95 + game.stage * 18 : kind === "tank" ? 24 + game.stage * 4 : 7 + game.stage;
        actors.push({ mesh, kind, hp, maxHp: hp, cooldown: 0.8, speed: kind === "boss" ? 0 : kind === "tank" ? 7 + game.stage * 0.4 : 10 + game.stage * 0.5 });
      }
      game.message = boss ? `3D Stage ${game.stage}: boss tank at the end!` : `3D ambush ${game.stop + 1}: clear the street`;
      game.stop += 1;
    };

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
      if (game.stage <= 12) {
        const lateral = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
        const forward = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
        player.position.x = clamp(player.position.x + lateral * 12 * dt, -8, 8);
        player.position.z = clamp(player.position.z + forward * 10 * dt, 4, 14);
        game.cooldown = Math.max(0, game.cooldown - dt);
        if ((keys.has("Space") || keys.has("KeyF")) && game.cooldown <= 0) {
          shots.push(makeShot(scene, player.position.clone().add(new THREE.Vector3(0, 1.2, -2.8)), new THREE.Vector3(0, 0, -48), "player", 13 + game.stage * 1.5));
          game.cooldown = 0.18;
        }
        if (actors.length === 0 && game.stop < stops.length) {
          game.progress += (42 + game.stage * 2) * dt;
          if (game.progress >= stops[game.stop]) spawnWave();
        }
        if (game.stop >= stops.length && actors.length === 0) {
          game.stage += 1;
          game.maxHp += 8;
          Object.assign(game, { hp: game.maxHp, progress: 0, stop: 0, message: game.stage <= 12 ? `3D Stage ${game.stage}: advance` : "3D tank campaign complete" });
        }
      }

      for (let i = actors.length - 1; i >= 0; i -= 1) {
        const actor = actors[i];
        const toPlayer = player.position.clone().sub(actor.mesh.position);
        toPlayer.y = 0;
        const dist = toPlayer.length() || 1;
        actor.mesh.lookAt(player.position.x, actor.mesh.position.y, player.position.z);
        if (actor.kind !== "boss" || dist > 18) actor.mesh.position.addScaledVector(toPlayer.normalize(), actor.speed * dt);
        actor.cooldown -= dt;
        if (actor.cooldown <= 0) {
          const dir = player.position.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(actor.mesh.position).normalize();
          shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(0, actor.kind === "infantry" ? 1 : 1.5, 0)), dir.multiplyScalar(actor.kind === "boss" ? 28 : 22), "enemy", actor.kind === "boss" ? 18 : actor.kind === "tank" ? 11 : 5));
          if (actor.kind === "boss") {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) shots.push(makeShot(scene, actor.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)), new THREE.Vector3(Math.sin(a) * 22, 0, Math.cos(a) * 22), "enemy", 12));
          }
          actor.cooldown = actor.kind === "boss" ? 0.9 : 1.35;
        }
        if (dist < (actor.kind === "infantry" ? 1.6 : 2.8)) game.hp -= (actor.kind === "infantry" ? 16 : 24) * dt;
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
            if (shot.mesh.position.distanceTo(actor.mesh.position.clone().add(new THREE.Vector3(0, 1, 0))) < (actor.kind === "boss" ? 3.8 : 1.4)) {
              actor.hp -= shot.damage;
              shot.life = 0;
            }
          }
        } else if (shot.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 0.8, 0))) < 1.5) {
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
        Object.assign(game, { hp: game.maxHp, progress: 0, stop: 0, message: `3D Stage ${game.stage} restarted` });
        player.position.set(0, 0, 9);
      }

      for (const mark of laneMarks) {
        mark.position.z += dt * (actors.length === 0 ? 18 : 0);
        if (mark.position.z > 24) mark.position.z -= 180;
      }
      camera.position.set(player.position.x * 0.35, 9, 25);
      camera.lookAt(player.position.x * 0.2, 0.8, -18);
      renderer.render(scene, camera);
      if (hudRef.current) hudRef.current.textContent = `Tank Plus 3D • Stage ${Math.min(game.stage, 12)} / 12 • Hull ${Math.max(0, Math.round(game.hp))} • ${game.message} • WASD move • Space/F fire`;
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

function PlusMenu({ setGame }: { setGame: (game: PlusGame) => void }) {
  const cards = [
    { id: "tank" as const, title: "Tank Plus Campaign", desc: "12 street stages. Roll forward, stop at ambushes, clear infantry and tanks, then defeat a boss tank at each stage end.", accent: "from-lime-300 to-emerald-500" },
    { id: "plane" as const, title: "Plane Plus Campaign", desc: "12 sky sorties with no infantry: fighters and bombers rush your lane, then a boss plane guards every stage finish.", accent: "from-cyan-300 to-blue-500" },
    { id: "mario" as const, title: "Mario Plus Worlds", desc: "12 harder obby stages with reachable coins, reachable lucky blocks, fire flowers, and fireballs.", accent: "from-amber-300 to-orange-500" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.22),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#111827_48%,_#2f1d05_100%)]" />
      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-amber-200/20 bg-white/5 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur">
          <Link className="text-sm font-bold uppercase tracking-[0.24em] text-white/80 hover:text-white" to="/">← Back to Lobby</Link>
          <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-950">GET PLUS</span>
        </nav>
        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-200">Plus Arcade Expansion</p>
          <h1 className="mt-4 text-6xl font-black tracking-tight sm:text-7xl">Stage-by-stage campaigns</h1>
          <p className="mt-6 text-xl leading-8 text-slate-300">Pick a Plus mode. These are campaign versions built around stage progression, boss endings, and new power mechanics.</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {cards.map((card) => (
            <button key={card.id} className="group rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-6 text-left shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-2 hover:border-white/25 hover:bg-white/[0.11]" onClick={() => setGame(card.id)} type="button">
              <div className={`mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br ${card.accent} shadow-lg transition group-hover:rotate-3 group-hover:scale-105`} />
              <h2 className="text-2xl font-bold">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.desc}</p>
              <span className="mt-6 inline-block rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950">Play Plus</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function Plus() {
  const [game, setGame] = useState<PlusGame>("menu");
  if (game === "tank") return <TankPlusGame onMenu={() => setGame("menu")} />;
  if (game === "plane") return <PlanePlusGame onMenu={() => setGame("menu")} />;
  if (game === "mario") return <MarioPlusGame onMenu={() => setGame("menu")} />;
  return <PlusMenu setGame={setGame} />;
}
