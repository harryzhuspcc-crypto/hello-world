import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Harry's Game Center" },
    {
      name: "description",
      content: "A modern arcade hub running on React Router and Cloudflare Workers.",
    },
  ];
}

const games = [
  {
    title: "Tank Fight",
    description: "Armor up for tactical arena battles with explosive power-ups.",
    accent: "from-lime-300 to-emerald-400",
    icon: "TF",
  },
  {
    title: "Super Mario",
    description: "Dash through bright worlds, secret pipes, and classic platforming chaos.",
    accent: "from-amber-300 to-orange-500",
    icon: "SM",
  },
  {
    title: "Air Fighter",
    description: "Take the sky in high-speed dogfights built for quick reflexes.",
    accent: "from-cyan-300 to-blue-500",
    icon: "AF",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#111827_48%,_#431407_100%)]" />
      <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-12 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur">
          <span className="text-sm font-semibold uppercase tracking-[0.32em] text-orange-200">
            Arcade Cloud
          </span>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-300/20">
            Online
          </span>
        </nav>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/10 px-4 py-2 text-sm font-medium text-orange-100">
              <span className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_16px_rgba(253,186,116,0.9)]" />
              Powered by Cloudflare Workers
            </div>

            <h1 className="max-w-4xl text-6xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl">
              Harry's
              <span className="block bg-gradient-to-r from-orange-200 via-white to-cyan-200 bg-clip-text text-transparent">
                Game Center
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              A sharp little arcade lobby for fast battles, nostalgic jumps, and
              sky-high action, delivered from the edge.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                className="rounded-full bg-white px-7 py-4 text-center text-sm font-bold uppercase tracking-[0.22em] text-slate-950 shadow-[0_20px_60px_rgba(255,255,255,0.2)] transition hover:-translate-y-1 hover:bg-orange-100"
                href="#games"
              >
                Explore Games
              </a>
              <a
                className="rounded-full border border-white/15 bg-white/5 px-7 py-4 text-center text-sm font-bold uppercase tracking-[0.22em] text-white backdrop-blur transition hover:-translate-y-1 hover:border-white/30 hover:bg-white/10"
                href="https://developers.cloudflare.com/workers/"
              >
                Learn Workers
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-orange-400/25 to-cyan-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-300">
                    Current Lobby
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Ready Player One</h2>
                </div>
                <div className="rounded-2xl bg-slate-950/70 px-4 py-3 text-right">
                  <p className="text-xs text-slate-400">Latency</p>
                  <p className="text-lg font-bold text-emerald-300">18ms</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["XP", "HP", "FPS"].map((stat, index) => (
                  <div
                    className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center"
                    key={stat}
                  >
                    <p className="text-xs text-slate-400">{stat}</p>
                    <p className="mt-2 text-xl font-black">
                      {[92, 100, 60][index]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl bg-slate-950/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">
                    Next Match
                  </span>
                  <span className="rounded-full bg-orange-400 px-3 py-1 text-xs font-bold text-slate-950">
                    Launching
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-orange-300 to-cyan-300" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3" id="games">
          {games.map((game) => (
            <article
              className="group rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-6 shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-2 hover:border-white/25 hover:bg-white/[0.11]"
              key={game.title}
            >
              <div
                className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${game.accent} text-lg font-black text-slate-950 shadow-lg transition group-hover:rotate-3 group-hover:scale-105`}
              >
                {game.icon}
              </div>
              <h2 className="text-2xl font-bold">{game.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {game.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
