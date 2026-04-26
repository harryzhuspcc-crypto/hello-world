import { Link } from "react-router";

import type { Route } from "./+types/super-mario";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Super Mario | Harry's Game Center" },
    {
      name: "description",
      content: "Play the Super Mario-inspired Plumber Quest platformer.",
    },
  ];
}

export default function SuperMario() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-sky-400 text-white">
      <iframe
        className="h-full w-full border-0"
        src="/embedded/super-mario/index.html"
        title="Super Mario"
        allow="fullscreen; gamepad"
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
