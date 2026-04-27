import { Link } from "react-router";

import type { Route } from "./+types/three-body-survival";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Three Body Survival | Harry's Game Center" },
    {
      name: "description",
      content: "Survive unstable suns in the Three Body Survival game.",
    },
  ];
}

export default function ThreeBodySurvival() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <iframe
        className="h-full w-full border-0"
        src="/embedded/three-body-survival/index.html"
        title="Three Body Survival"
        allow="fullscreen; gamepad"
      />
      <Link
        className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur transition hover:bg-black/55"
        to="/"
      >
        ← Lobby
      </Link>
    </main>
  );
}
