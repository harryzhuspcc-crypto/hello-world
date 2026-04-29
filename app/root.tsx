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

const GAME_CENTER_PASSWORD = "1234";

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

export default function App() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("game-center-unlocked") === "yes") setUnlocked(true);
  }, []);

  if (!unlocked) return <GameCenterPasswordGate onUnlock={() => setUnlocked(true)} />;
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
