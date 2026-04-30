import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const GAME_CENTER_PASSWORD = "5933";

function GameCenterPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password === GAME_CENTER_PASSWORD) {
      sessionStorage.setItem("game-center-unlocked", "yes");
      onUnlock();
      return;
    }
    setError("Wrong password");
    setPassword("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-slate-950">
      <form className="w-72" onSubmit={submit}>
        <input
          autoFocus
          aria-label="Game center password"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl font-bold outline-none focus:border-slate-900"
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          placeholder="Password"
          type="password"
          value={password}
        />
        {error && <p className="mt-3 text-center text-sm font-bold text-red-600">{error}</p>}
      </form>
    </main>
  );
}

function CanvaBlankPage() {
  const sideItems = ["Design", "Elements", "Text", "Brand", "Uploads", "Draw", "Projects", "Apps"];

  return (
    <main className="min-h-screen bg-[#f2f3f5] font-sans text-[#0d1216]">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-r from-[#00c4cc] via-[#7d2ae8] to-[#ff66c4] bg-clip-text text-2xl font-black italic text-transparent">
            Canva
          </div>
          <nav className="hidden items-center gap-1 text-sm font-semibold text-slate-700 md:flex">
            <button className="rounded-lg px-3 py-2 hover:bg-slate-100" type="button">Home</button>
            <button className="rounded-lg px-3 py-2 hover:bg-slate-100" type="button">File</button>
            <button className="rounded-lg px-3 py-2 hover:bg-slate-100" type="button">Resize</button>
          </nav>
        </div>
        <div className="mx-4 hidden max-w-xl flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 md:block">
          Search your content or Canva
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100" type="button">Share</button>
          <button className="rounded-lg bg-[#7d2ae8] px-4 py-2 text-sm font-black text-white" type="button">Download</button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        <aside className="hidden w-20 flex-col items-center gap-3 border-r border-slate-200 bg-white py-4 md:flex">
          {sideItems.map((item) => (
            <button className="flex w-full flex-col items-center gap-1 px-1 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100" key={item} type="button">
              <span className="h-7 w-7 rounded-xl bg-slate-200" />
              {item}
            </button>
          ))}
        </aside>

        <section className="flex flex-1 flex-col">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600">
            <span>Untitled design</span>
            <div className="flex items-center gap-3">
              <span>100%</span>
              <span>Position</span>
              <span>Animate</span>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#ebedf0]">
            <div className="absolute left-6 top-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">
              Page 1 - Blank
            </div>
            <div className="aspect-[8.5/11] h-[78vh] max-h-[780px] rounded-sm bg-white shadow-[0_8px_30px_rgba(15,23,42,0.18)]" />
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-lg">
              <button type="button">−</button>
              <span>100%</span>
              <button type="button">+</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [canvaMode, setCanvaMode] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("game-center-unlocked") === "yes") setUnlocked(true);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const commandLike = event.ctrlKey || event.metaKey;
      if (!commandLike || !event.altKey) return;
      if (event.code === "KeyL") {
        event.preventDefault();
        sessionStorage.removeItem("game-center-unlocked");
        setCanvaMode(false);
        setUnlocked(false);
      } else if (event.code === "KeyC" && unlocked) {
        event.preventDefault();
        setCanvaMode(true);
      } else if (event.code === "KeyG" && unlocked) {
        event.preventDefault();
        setCanvaMode(false);
      }
    };
    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [unlocked]);

  if (!unlocked) return <GameCenterPasswordGate onUnlock={() => setUnlocked(true)} />;
  if (canvaMode) return <CanvaBlankPage />;
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
