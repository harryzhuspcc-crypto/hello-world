import { Link } from "react-router";

import type { Route } from "./+types/city-warrior";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "City Warrior | Harry's Game Center" },
    {
      name: "description",
      content: "Play City Warrior: three stages of pixel-art fighting, forgiving platform jumps, and boss battles.",
    },
  ];
}

export default function CityWarrior() {
  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-2">
        <Link className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-white/10" to="/">
          ← Lobby
        </Link>
        <h1 className="text-sm font-bold">City Warrior</h1>
        <p className="hidden text-xs text-slate-300 md:block">
          Move: WASD / arrows · Punch: J · Jump: K · Kick: L
        </p>
      </header>
      <iframe
        className="min-h-0 w-full flex-1 border-0"
        src="/embedded/city-warrior/index.html"
        title="City Warrior"
        allow="fullscreen; gamepad; autoplay"
      />
    </main>
  );
}
