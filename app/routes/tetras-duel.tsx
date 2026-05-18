import { useEffect, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/tetras-duel";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Block Drop Duel | Harry's Game Center" },
    {
      name: "description",
      content: "A two-player block-dropping duel against a silly adaptive AI with garbage attacks.",
    },
  ];
}

type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Board = Cell[][];
type PieceName = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Piece = { name: PieceName; x: number; y: number; r: number };
type PlayerSide = "player" | "ai";

type GameSide = {
  board: Board;
  piece: Piece;
  next: PieceName;
  score: number;
  lines: number;
  tetrises: number;
  garbageSent: number;
  alive: boolean;
  dropTimer: number;
};

const COLS = 10;
const ROWS = 20;
const VISIBLE_ROWS = 20;
const CELL = 27;
const BOARD_W = COLS * CELL;
const BOARD_H = VISIBLE_ROWS * CELL;
const COLORS = ["#020617", "#22d3ee", "#fde047", "#c084fc", "#34d399", "#fb7185", "#60a5fa", "#f97316", "#64748b"];
const BAG: PieceName[] = ["I", "O", "T", "S", "Z", "J", "L"];

const SHAPES: Record<PieceName, number[][]> = {
  I: [
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
  ],
  O: [
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  ],
};

const PIECE_VALUE: Record<PieceName, Cell> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0 as Cell));
}

function randomPiece(): PieceName {
  return BAG[Math.floor(Math.random() * BAG.length)];
}

function spawn(name: PieceName): Piece {
  return { name, x: 3, y: -1, r: 0 };
}

function cells(piece: Piece) {
  const shape = SHAPES[piece.name][piece.r % 4];
  const result: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) if (shape[y * 4 + x]) result.push({ x: piece.x + x, y: piece.y + y });
  }
  return result;
}

function collides(board: Board, piece: Piece) {
  return cells(piece).some(({ x, y }) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0));
}

function merge(board: Board, piece: Piece) {
  const value = PIECE_VALUE[piece.name];
  for (const { x, y } of cells(piece)) if (y >= 0 && y < ROWS && x >= 0 && x < COLS) board[y][x] = value;
}

function clearLines(board: Board) {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every((cell) => cell !== 0)) {
      board.splice(y, 1);
      board.unshift(Array.from({ length: COLS }, () => 0 as Cell));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function garbageFor(lines: number) {
  if (lines <= 0) return 0;
  if (lines === 1) return 1;
  if (lines === 2) return 2;
  if (lines === 3) return 4;
  return 7; // four-line clear sends big bonus garbage
}

function addGarbage(board: Board, amount: number) {
  for (let i = 0; i < amount; i += 1) {
    board.shift();
    const hole = Math.floor(Math.random() * COLS);
    board.push(Array.from({ length: COLS }, (_, x) => (x === hole ? 0 : 8) as Cell));
  }
}

function sideFactory(): GameSide {
  const next = randomPiece();
  return {
    board: createBoard(),
    piece: spawn(randomPiece()),
    next,
    score: 0,
    lines: 0,
    tetrises: 0,
    garbageSent: 0,
    alive: true,
    dropTimer: 0,
  };
}

function heights(board: Board) {
  return Array.from({ length: COLS }, (_, x) => {
    for (let y = 0; y < ROWS; y += 1) if (board[y][x]) return ROWS - y;
    return 0;
  });
}

function countHoles(board: Board) {
  let holes = 0;
  for (let x = 0; x < COLS; x += 1) {
    let found = false;
    for (let y = 0; y < ROWS; y += 1) {
      if (board[y][x]) found = true;
      else if (found) holes += 1;
    }
  }
  return holes;
}

function evaluateBoard(board: Board, cleared: number) {
  const h = heights(board);
  const aggregate = h.reduce((sum, item) => sum + item, 0);
  const bump = h.slice(1).reduce((sum, item, index) => sum + Math.abs(item - h[index]), 0);
  const holes = countHoles(board);
  const danger = board.slice(0, 5).flat().filter(Boolean).length;
  return cleared * 9.2 - aggregate * 0.45 - holes * 5.2 - bump * 0.72 - danger * 1.15;
}

function ghostY(board: Board, piece: Piece) {
  const ghost = { ...piece };
  while (!collides(board, { ...ghost, y: ghost.y + 1 })) ghost.y += 1;
  return ghost.y;
}

function placePreview(board: Board, piece: Piece) {
  const copy = board.map((row) => [...row] as Cell[]);
  const dropped = { ...piece, y: ghostY(board, piece) };
  merge(copy, dropped);
  const cleared = clearLines(copy);
  return { board: copy, cleared };
}

type SkillButton = { x: number; y: number; w: number; h: number; skill: number; label: string };

const skillOptions = [
  { label: "Level 1", skill: 0.12, note: "AI is very confused" },
  { label: "Level 2", skill: 0.24, note: "good for learning" },
  { label: "Level 3", skill: 0.38, note: "still pretty silly" },
  { label: "Level 4", skill: 0.56, note: "faster, fewer mistakes" },
  { label: "Level 5", skill: 0.74, note: "hard but beatable" },
];

function chooseAiPlan(board: Board, piece: Piece, skill: number) {
  const candidates: Array<{ x: number; r: number; score: number }> = [];
  for (let r = 0; r < 4; r += 1) {
    for (let x = -2; x < COLS + 2; x += 1) {
      const test = { ...piece, x, r };
      if (collides(board, test)) continue;
      const { board: preview, cleared } = placePreview(board, test);
      candidates.push({ x, r, score: evaluateBoard(preview, cleared) });
    }
  }
  if (candidates.length === 0) return { x: piece.x, r: piece.r };
  candidates.sort((a, b) => b.score - a.score);
  const useSmart = Math.random() < 0.18 + skill * 0.68;
  if (useSmart) return candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * Math.max(1, 5 - Math.floor(skill * 4))))];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function TetrasDuel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const readRecommendedSkill = () => {
      const stored = window.localStorage.getItem("block-drop-duel-recommended-skill");
      const parsed = stored ? Number(stored) : Number.NaN;
      return Number.isFinite(parsed) ? clamp(parsed, 0.08, 0.82) : 0.24;
    };
    const recommendedAtStart = readRecommendedSkill();

    const state = {
      player: sideFactory(),
      ai: sideFactory(),
      aiPlan: { x: 3, r: 0 },
      aiMoveTimer: 0,
      skill: recommendedAtStart,
      recommendedSkill: recommendedAtStart,
      skillButtons: [] as SkillButton[],
      setup: true,
      playerClears: 0,
      playerPieces: 0,
      winner: "" as "" | "You" | "AI",
      paused: false,
      last: performance.now(),
      message: "Choose an AI skill. The highlighted one is recommended from your past games.",
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

    const startMatch = (skill = state.skill) => {
      state.skill = clamp(skill, 0.08, 0.82);
      state.player = sideFactory();
      state.ai = sideFactory();
      state.aiPlan = chooseAiPlan(state.ai.board, state.ai.piece, state.skill);
      state.aiMoveTimer = 0;
      state.playerClears = 0;
      state.playerPieces = 0;
      state.winner = "";
      state.paused = false;
      state.setup = false;
      state.message = `AI skill set to ${(state.skill * 100).toFixed(0)}%. Clear lines to send garbage!`;
    };

    const reset = () => startMatch(state.skill);

    const adaptSkill = () => {
      const pressure = heights(state.player.board).reduce((max, h) => Math.max(max, h), 0) / ROWS;
      const attackRate = state.player.garbageSent / Math.max(1, state.playerPieces);
      const lineRate = state.player.lines / Math.max(1, state.playerPieces);
      const playerSkill = clamp(lineRate * 1.8 + attackRate * 0.42 + state.player.tetrises * 0.045 - pressure * 0.42, 0.05, 0.86);
      state.skill += (playerSkill - state.skill) * 0.012;
      if (!state.ai.alive) state.skill = Math.max(0.08, state.skill - 0.08);
      if (!state.player.alive) state.skill = Math.max(0.05, state.skill - 0.12);
      state.skill = clamp(state.skill, 0.08, 0.82);
    };

    const saveRecommendation = (playerWon: boolean) => {
      const pressure = heights(state.player.board).reduce((max, h) => Math.max(max, h), 0) / ROWS;
      const performance = clamp(state.player.lines / Math.max(1, state.playerPieces) + state.player.tetrises * 0.14 - pressure * 0.25, 0, 1);
      const target = clamp(state.skill + (playerWon ? 0.07 : -0.06) + (performance - 0.28) * 0.09, 0.08, 0.82);
      state.recommendedSkill = target;
      window.localStorage.setItem("block-drop-duel-recommended-skill", target.toFixed(3));
    };

    const spawnNext = (side: GameSide, owner: PlayerSide) => {
      side.piece = spawn(side.next);
      side.next = randomPiece();
      side.dropTimer = 0;
      if (collides(side.board, side.piece)) {
        side.alive = false;
        state.winner = owner === "player" ? "AI" : "You";
        const playerWon = owner === "ai";
        saveRecommendation(playerWon);
        state.message = playerWon
          ? `You buried the AI! New recommended skill: ${(state.recommendedSkill * 100).toFixed(0)}%. Press M to choose or R for rematch.`
          : `The AI topped you out. New recommended skill: ${(state.recommendedSkill * 100).toFixed(0)}%. Press M to choose or R for rematch.`;
      }
      if (owner === "ai") state.aiPlan = chooseAiPlan(side.board, side.piece, state.skill);
      else state.playerPieces += 1;
    };

    const lockPiece = (side: GameSide, owner: PlayerSide) => {
      merge(side.board, side.piece);
      const cleared = clearLines(side.board);
      if (cleared > 0) {
        const garbage = garbageFor(cleared);
        side.lines += cleared;
        side.score += [0, 100, 300, 500, 1000][cleared] ?? 1000;
        side.garbageSent += garbage;
        if (cleared === 4) side.tetrises += 1;
        addGarbage(owner === "player" ? state.ai.board : state.player.board, garbage);
        state.message = owner === "player" ? `${cleared === 4 ? "TETRAS!" : `${cleared} line clear!`} You sent ${garbage} garbage lines.` : `AI cleared ${cleared} and sent ${garbage} lines back.`;
        if (owner === "player") state.playerClears += cleared;
      }
      spawnNext(side, owner);
      adaptSkill();
    };

    const move = (side: GameSide, dx: number) => {
      const next = { ...side.piece, x: side.piece.x + dx };
      if (!collides(side.board, next)) side.piece = next;
    };

    const rotate = (side: GameSide, direction = 1) => {
      const base = { ...side.piece, r: (side.piece.r + direction + 4) % 4 };
      for (const kick of [0, -1, 1, -2, 2]) {
        const next = { ...base, x: base.x + kick };
        if (!collides(side.board, next)) {
          side.piece = next;
          return;
        }
      }
    };

    const softDrop = (side: GameSide, owner: PlayerSide) => {
      const next = { ...side.piece, y: side.piece.y + 1 };
      if (!collides(side.board, next)) side.piece = next;
      else lockPiece(side, owner);
    };

    const hardDrop = () => {
      if (!state.player.alive || state.winner) return;
      state.player.piece = { ...state.player.piece, y: ghostY(state.player.board, state.player.piece) };
      state.player.score += 8;
      lockPiece(state.player, "player");
    };

    const getSkillButtonRects = (w: number, h: number) => {
      const panelW = Math.min(760, w - 40);
      const panelH = 430;
      const x = (w - panelW) / 2;
      const y = Math.max(90, (h - panelH) / 2);
      const buttonW = Math.min(128, (panelW - 90) / skillOptions.length);
      const buttonH = 118;
      const gap = 12;
      const startX = x + (panelW - skillOptions.length * buttonW - (skillOptions.length - 1) * gap) / 2;
      return skillOptions.map((option, index) => ({
        x: startX + index * (buttonW + gap),
        y: y + 155,
        w: buttonW,
        h: buttonH,
        skill: option.skill,
        label: option.label,
      }));
    };

    const skillNumberFromKey = (event: KeyboardEvent) => {
      const keyNumber = Number(event.key);
      if (Number.isInteger(keyNumber) && keyNumber >= 1 && keyNumber <= skillOptions.length) return keyNumber;
      const codeMatch = event.code.match(/^(?:Digit|Numpad)([1-5])$/);
      return codeMatch ? Number(codeMatch[1]) : 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (state.setup) {
        if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          startMatch(state.recommendedSkill);
          return;
        }
        const digit = skillNumberFromKey(event);
        if (digit) {
          event.preventDefault();
          event.stopPropagation();
          startMatch(skillOptions[digit - 1].skill);
          return;
        }
      }
      if (event.code === "KeyM") {
        event.preventDefault();
        state.setup = true;
        state.paused = false;
        state.winner = "";
        state.recommendedSkill = readRecommendedSkill();
        state.message = "Choose an AI skill, or press Enter for the recommendation.";
        return;
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        reset();
        return;
      }
      if (event.code === "KeyP") {
        state.paused = !state.paused;
        return;
      }
      if (!state.player.alive || state.paused || state.winner || state.setup) return;
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        move(state.player, -1);
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        move(state.player, 1);
      } else if (event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        rotate(state.player, 1);
      } else if (event.code === "KeyQ") {
        event.preventDefault();
        rotate(state.player, -1);
      } else if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        softDrop(state.player, "player");
        state.player.score += 1;
      } else if (event.code === "Space") {
        event.preventDefault();
        hardDrop();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!state.setup) return;
      const buttons = state.skillButtons.length > 0 ? state.skillButtons : getSkillButtonRects(window.innerWidth, window.innerHeight);
      const button = buttons.find((item) => event.clientX >= item.x && event.clientX <= item.x + item.w && event.clientY >= item.y && event.clientY <= item.y + item.h);
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        startMatch(button.skill);
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);

    const updateAi = (dt: number) => {
      if (!state.ai.alive || state.winner) return;
      state.aiMoveTimer += dt;
      const moveDelay = 0.34 - state.skill * 0.2;
      if (state.aiMoveTimer >= moveDelay) {
        state.aiMoveTimer = 0;
        const mistake = Math.random() > 0.48 + state.skill * 0.45;
        if (mistake) {
          if (Math.random() < 0.5) move(state.ai, Math.random() < 0.5 ? -1 : 1);
          else rotate(state.ai, 1);
        } else if (state.ai.piece.r !== state.aiPlan.r) rotate(state.ai, 1);
        else if (state.ai.piece.x < state.aiPlan.x) move(state.ai, 1);
        else if (state.ai.piece.x > state.aiPlan.x) move(state.ai, -1);
        else if (Math.random() < state.skill * 0.22) softDrop(state.ai, "ai");
      }
    };

    const updateSideGravity = (side: GameSide, owner: PlayerSide, dt: number) => {
      if (!side.alive || state.winner) return;
      side.dropTimer += dt;
      const base = owner === "player" ? 0.72 : 0.92 - state.skill * 0.46;
      if (side.dropTimer >= base) {
        side.dropTimer = 0;
        softDrop(side, owner);
      }
    };

    const drawCell = (x: number, y: number, cell: Cell, alpha = 1) => {
      if (cell === 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[cell];
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      const gradient = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
      gradient.addColorStop(0, "rgba(255,255,255,0.32)");
      gradient.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.restore();
    };

    const drawBoard = (side: GameSide, ox: number, oy: number, title: string, isAi: boolean) => {
      ctx.fillStyle = "rgba(15,23,42,0.86)";
      ctx.fillRect(ox - 14, oy - 52, BOARD_W + 28, BOARD_H + 72);
      ctx.strokeStyle = isAi ? "rgba(248,113,113,0.7)" : "rgba(56,189,248,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeRect(ox - 14, oy - 52, BOARD_W + 28, BOARD_H + 72);
      ctx.fillStyle = "white";
      ctx.font = "900 26px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, ox + BOARD_W / 2, oy - 18);

      ctx.fillStyle = "rgba(2,6,23,0.85)";
      ctx.fillRect(ox, oy, BOARD_W, BOARD_H);
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          ctx.strokeStyle = "rgba(148,163,184,0.13)";
          ctx.strokeRect(ox + x * CELL, oy + y * CELL, CELL, CELL);
          drawCell(ox + x * CELL, oy + y * CELL, side.board[y][x]);
        }
      }

      const ghost = { ...side.piece, y: ghostY(side.board, side.piece) };
      for (const { x, y } of cells(ghost)) if (y >= 0) drawCell(ox + x * CELL, oy + y * CELL, PIECE_VALUE[ghost.name], 0.16);
      for (const { x, y } of cells(side.piece)) if (y >= 0) drawCell(ox + x * CELL, oy + y * CELL, PIECE_VALUE[side.piece.name]);

      ctx.fillStyle = "rgba(15,23,42,0.72)";
      ctx.fillRect(ox, oy + BOARD_H + 12, BOARD_W, 46);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "800 13px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Lines ${side.lines}   Score ${side.score}`, ox + 10, oy + BOARD_H + 30);
      ctx.fillText(`Tetras ${side.tetrises}   Sent ${side.garbageSent}`, ox + 10, oy + BOARD_H + 48);
    };

    const drawSkillSetup = (w: number, h: number) => {
      const panelW = Math.min(760, w - 40);
      const panelH = 430;
      const x = (w - panelW) / 2;
      const y = Math.max(90, (h - panelH) / 2);
      ctx.fillStyle = "rgba(2,6,23,0.82)";
      ctx.fillRect(x, y, panelW, panelH);
      ctx.strokeStyle = "rgba(125,211,252,0.45)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, panelW, panelH);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 42px Inter, sans-serif";
      ctx.fillText("Choose AI Skill", w / 2, y + 70);
      ctx.fillStyle = "#bae6fd";
      ctx.font = "800 17px Inter, sans-serif";
      ctx.fillText(`Recommended: ${(state.recommendedSkill * 100).toFixed(0)}% — based on your past matches`, w / 2, y + 110);

      state.skillButtons = getSkillButtonRects(w, h);
      for (let index = 0; index < skillOptions.length; index += 1) {
        const option = skillOptions[index];
        const rect = state.skillButtons[index];
        const bx = rect.x;
        const by = rect.y;
        const buttonW = rect.w;
        const buttonH = rect.h;
        const recommended = Math.abs(option.skill - state.recommendedSkill) < 0.08;
        ctx.fillStyle = recommended ? "rgba(34,211,238,0.28)" : "rgba(255,255,255,0.08)";
        ctx.fillRect(bx, by, buttonW, buttonH);
        ctx.strokeStyle = recommended ? "#67e8f9" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = recommended ? 3 : 1.5;
        ctx.strokeRect(bx, by, buttonW, buttonH);
        ctx.fillStyle = recommended ? "#fef08a" : "#e2e8f0";
        ctx.font = "900 13px Inter, sans-serif";
        ctx.fillText(`${index + 1}`, bx + buttonW / 2, by + 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 19px Inter, sans-serif";
        ctx.fillText(option.label, bx + buttonW / 2, by + 52);
        ctx.fillStyle = "#bae6fd";
        ctx.font = "900 18px Inter, sans-serif";
        ctx.fillText(`${(option.skill * 100).toFixed(0)}%`, bx + buttonW / 2, by + 79);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "700 10px Inter, sans-serif";
        ctx.fillText(option.note, bx + buttonW / 2, by + 101);
      }

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "800 15px Inter, sans-serif";
      ctx.fillText("Click a card, press 1-5, or press Enter to use the recommendation.", w / 2, y + 320);
      ctx.fillStyle = "#fef3c7";
      ctx.fillText("The AI still adjusts during the match so it stays fun.", w / 2, y + 350);
    };

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(0.55, "#111827");
      bg.addColorStop(1, "#3b0764");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgba(34,211,238,0.08)";
      for (let i = 0; i < 42; i += 1) {
        ctx.beginPath();
        ctx.arc((i * 139 + performance.now() * 0.012) % (w + 100) - 50, (i * 91) % h, 2 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }

      if (state.setup) {
        drawSkillSetup(w, h);
        if (hudRef.current) {
          hudRef.current.innerHTML = `<strong>${state.message}</strong><span>Recommended ${(state.recommendedSkill * 100).toFixed(0)}% • Click a skill or press 1-5 • Enter starts recommended</span>`;
        }
        return;
      }

      const gap = 120;
      const totalW = BOARD_W * 2 + gap;
      const startX = Math.max(24, (w - totalW) / 2);
      const y = Math.max(86, (h - BOARD_H) / 2 - 10);
      drawBoard(state.player, startX, y, "YOU", false);
      drawBoard(state.ai, startX + BOARD_W + gap, y, "SILLY AI", true);

      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(startX + BOARD_W + 22, y + 120, gap - 44, 210);
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.font = "900 24px Inter, sans-serif";
      ctx.fillText("VS", startX + BOARD_W + gap / 2, y + 165);
      ctx.font = "800 13px Inter, sans-serif";
      ctx.fillStyle = "#bae6fd";
      ctx.fillText(`AI Skill ${(state.skill * 100).toFixed(0)}%`, startX + BOARD_W + gap / 2, y + 203);
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("it learns... slowly", startX + BOARD_W + gap / 2, y + 229);
      ctx.fillStyle = "#fef3c7";
      ctx.fillText("1/2/3 lines send 1/2/4", startX + BOARD_W + gap / 2, y + 268);
      ctx.fillText("4-line Tetras sends 7", startX + BOARD_W + gap / 2, y + 292);

      if (state.winner || state.paused) {
        ctx.fillStyle = "rgba(2,6,23,0.76)";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.fillStyle = state.winner === "You" ? "#bbf7d0" : "#fecaca";
        ctx.font = "900 58px Inter, sans-serif";
        ctx.fillText(state.paused ? "Paused" : `${state.winner} Win!`, w / 2, h / 2 - 30);
        ctx.fillStyle = "white";
        ctx.font = "800 20px Inter, sans-serif";
        ctx.fillText(state.paused ? "Press P to keep playing" : "Press R for a rematch • M for skill select", w / 2, h / 2 + 18);
      }

      if (hudRef.current) {
        hudRef.current.innerHTML = `<strong>${state.message}</strong><span>Move A/D or arrows • Rotate W/↑ • Soft drop S/↓ • Hard drop Space • R rematch • M skill select • P pause</span>`;
      }
    };

    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - state.last) / 1000 || 0.016);
      state.last = now;
      if (!state.setup && !state.paused && !state.winner) {
        updateAi(dt);
        updateSideGravity(state.player, "player", dt);
        updateSideGravity(state.ai, "ai", dt);
        adaptSkill();
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-4">
        <div className="rounded-3xl border border-white/10 bg-black/45 px-5 py-4 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Block Drop Duel</p>
          <h1 className="text-2xl font-black">You vs a Pretty Stupid AI</h1>
        </div>
        <Link className="pointer-events-auto rounded-full bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-cyan-100" to="/">
          Back to Lobby
        </Link>
      </div>
      <div ref={hudRef} className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-1 rounded-3xl border border-white/10 bg-black/55 px-5 py-4 text-center text-sm font-bold text-slate-200 shadow-2xl backdrop-blur-md [&_span]:text-xs [&_span]:font-semibold [&_span]:text-slate-400" />
    </main>
  );
}
