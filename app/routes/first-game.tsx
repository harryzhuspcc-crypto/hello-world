import { Link } from "react-router";

import type { Route } from "./+types/first-game";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "First Game | Harry's Game Center" },
    {
      name: "description",
      content: "Play Harry's Godot platformer: sword, mushrooms, portals, and five bosses.",
    },
  ];
}

export default function FirstGame() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <iframe
        className="h-full w-full border-0"
        src="/embedded/first-game/index.html"
        title="First Game"
        allow="fullscreen; gamepad; autoplay"
      />
      <Link
        className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur transition hover:bg-black/50"
        to="/"
      >
        ← Lobby
      </Link>
    </main>
  );
}
