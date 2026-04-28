import { useEffect } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/tank-fight";
import "../games/tank-game.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Tank Fight | Harry's Game Center" },
    {
      name: "description",
      content: "Command a battle tank across Iron Plains Assault.",
    },
  ];
}

export default function TankFight() {
  useEffect(() => {
    let game: { destroy(): void } | undefined;
    let isMounted = true;

    void import("../games/tank-game").then(({ TankGame }) => {
      if (isMounted) {
        game = new TankGame();
      }
    });

    return () => {
      isMounted = false;
      game?.destroy();
    };
  }, []);

  return (
    <main className="tank-game-page">
      <Link
        className="fixed left-4 top-4 z-50 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-2xl backdrop-blur transition hover:bg-black/55"
        to="/"
      >
        ← Lobby
      </Link>
      <div className="tank-game-root">
        <canvas id="game-canvas" aria-label="Iron Plains Assault" />
        <div className="vignette" />

        <div className="hud">
          <div className="hud__top">
            <div className="panel stat-card">
              <span className="label">Health</span>
              <div className="health-bar">
                <div id="health-bar-fill" className="health-bar__fill" />
              </div>
              <span id="health-value" className="value">100</span>
            </div>

            <div className="panel stat-card stat-card--compact">
              <span className="label">Wave</span>
              <span id="wave-value" className="value">1</span>
            </div>

            <div className="panel stat-card stat-card--compact">
              <span className="label">Targets</span>
              <span id="enemy-count" className="value">0</span>
            </div>

            <div className="panel stat-card stat-card--compact">
              <span className="label">Kills</span>
              <span id="kills-value" className="value">0</span>
            </div>

            <div className="panel stat-card stat-card--compact">
              <span className="label">Coins</span>
              <span id="coin-value" className="value">0</span>
            </div>

            <div className="panel stat-card">
              <span className="label">Shift Mode</span>
              <div className="energy-bar">
                <div id="shift-bar-fill" className="energy-bar__fill" />
              </div>
              <span id="shift-value" className="value">Strike • 0 / 5</span>
            </div>
          </div>

          <div id="status-pill" className="status-pill">Click start to engage the tank optics</div>
          <div id="charge-meter" className="charge-meter" aria-hidden="true">
            <div id="charge-meter-fill" className="charge-meter__fill" />
            <span id="charge-meter-text" className="charge-meter__text">Charge 0%</span>
          </div>
          <div id="crosshair" className="crosshair" aria-hidden="true" />
          <div id="target-dot" className="target-dot" aria-hidden="true" />
          <div id="hit-marker" className="hit-marker" aria-hidden="true" />
        </div>

        <section id="menu-overlay" className="overlay overlay--visible">
          <div className="overlay__card hero-card">
            <div className="eyebrow">Armored survival operation</div>
            <h1>Iron Plains Assault</h1>
            <p>
              Command a battle tank across the open plain, survive escalating waves, and unlock
              upgrades between rounds. Use WASD for directional movement, E and Q to rise or drop,
              and move the mouse to aim after starting the battle. Hold left click to charge a
              glowing explosive shell, then release to blast tanks and heavy attack planes. Every 10th
              wave brings a fortress tank with cannons on every side, rear tank ramps, and infantry doors.
              Every 5 kills charges your Shift special, and Tab swaps between Strike and Wave modes.
            </p>

            <div className="controls-grid">
              <div><span>Move</span><strong>W A S D</strong></div>
              <div><span>Rise / descend</span><strong>E / Q</strong></div>
              <div><span>Look around</span><strong>Move Mouse</strong></div>
              <div><span>Charge / fire shell</span><strong>Hold + Release Left Click</strong></div>
              <div><span>Toggle Shift mode</span><strong>Tab</strong></div>
              <div><span>Use Shift ability</span><strong>Shift when ready</strong></div>
              <div><span>Stay still</span><strong>Release movement keys</strong></div>
              <div><span>Pause</span><strong>Esc</strong></div>
            </div>

            <div className="shop-header">
              <div>
                <div className="eyebrow">Hangar upgrades</div>
                <p className="shop-copy">Each enemy kill grants 1 coin. Spend coins here before starting a new battle.</p>
              </div>
              <div className="shop-bank panel">
                <span className="label">Hangar coins</span>
                <span id="bank-coins-value" className="value">0</span>
              </div>
            </div>

            <div className="shop-grid">
              <button type="button" className="shop-card" data-store-upgrade="starterHealth">
                <span className="upgrade-card__eyebrow">Starter Hull</span>
                <strong>Reinforced Hull</strong>
                <span className="shop-card__desc">Start each run with +20 max health.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">3 coins</span></span>
              </button>
              <button type="button" className="shop-card" data-store-upgrade="starterDamage">
                <span className="upgrade-card__eyebrow">Starter Cannon</span>
                <strong>Shell Damage</strong>
                <span className="shop-card__desc">Start each run with +1 direct shell damage.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">5 coins</span></span>
              </button>
              <button type="button" className="shop-card" data-store-upgrade="starterArmor">
                <span className="upgrade-card__eyebrow">Starter Armor</span>
                <strong>Composite Plating</strong>
                <span className="shop-card__desc">Take less damage at the start of every run.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">4 coins</span></span>
              </button>
              <button type="button" className="shop-card" data-store-upgrade="starterReload">
                <span className="upgrade-card__eyebrow">Starter Loader</span>
                <strong>Quick Breech</strong>
                <span className="shop-card__desc">Start each run with a faster reload speed.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">4 coins</span></span>
              </button>
              <button type="button" className="shop-card" data-store-upgrade="starterChargePower">
                <span className="upgrade-card__eyebrow">Charged Shot</span>
                <strong>Power Core</strong>
                <span className="shop-card__desc">Start each run with stronger charged-shot explosion damage.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">6 coins</span></span>
              </button>
              <button type="button" className="shop-card" data-store-upgrade="starterChargeRange">
                <span className="upgrade-card__eyebrow">Charged Shot</span>
                <strong>Blast Radius</strong>
                <span className="shop-card__desc">Start each run with a wider explosive impact radius.</span>
                <span className="shop-card__meta"><span className="shop-card__level">Level 0</span><span className="shop-card__cost">6 coins</span></span>
              </button>
            </div>

            <button id="start-button" type="button" className="cta-button">Start Battle</button>
          </div>
          <button id="scroll-to-play-button" className="scroll-button" type="button">Scroll to Play ↓</button>
        </section>

        <section id="paused-overlay" className="overlay">
          <div className="overlay__card">
            <div className="eyebrow">Optics disengaged</div>
            <h2>Battle Paused</h2>
            <p>Resume to relock your view and continue the armored assault.</p>
            <button id="resume-button" type="button" className="cta-button">Resume Battle</button>
          </div>
        </section>

        <section id="upgrade-overlay" className="overlay">
          <div className="overlay__card hero-card">
            <div className="eyebrow">Wave cleared</div>
            <h2 id="upgrade-title">Choose an Upgrade</h2>
            <p id="upgrade-subtitle">Your armor has been fully restored. Pick one bonus before the next wave.</p>

            <div className="upgrade-grid">
              <button type="button" className="upgrade-card" data-upgrade="health">
                <span className="upgrade-card__eyebrow">Survivability</span>
                <strong>Extra Health</strong>
                <span>Increase max health and fully restore it.</span>
              </button>
              <button type="button" className="upgrade-card" data-upgrade="damage">
                <span className="upgrade-card__eyebrow">Offense</span>
                <strong>High-Explosive Rounds</strong>
                <span>Increase direct shell damage against tanks and attack planes.</span>
              </button>
              <button type="button" className="upgrade-card" data-upgrade="armor">
                <span className="upgrade-card__eyebrow">Defense</span>
                <strong>Reinforced Armor</strong>
                <span>Reduce incoming shell and drone damage.</span>
              </button>
              <button type="button" className="upgrade-card" data-upgrade="reload">
                <span className="upgrade-card__eyebrow">Tempo</span>
                <strong>Rapid Loader</strong>
                <span>Shorten the delay between cannon shots.</span>
              </button>
              <button type="button" className="upgrade-card" data-upgrade="chargePower">
                <span className="upgrade-card__eyebrow">Charged Shot</span>
                <strong>Power Core</strong>
                <span>Increase charged-shot explosion damage scaling.</span>
              </button>
              <button type="button" className="upgrade-card" data-upgrade="chargeRange">
                <span className="upgrade-card__eyebrow">Charged Shot</span>
                <strong>Blast Radius</strong>
                <span>Increase charged-shot explosion radius scaling.</span>
              </button>
            </div>
          </div>
        </section>

        <section id="gameover-overlay" className="overlay">
          <div className="overlay__card">
            <div className="eyebrow">Tank destroyed</div>
            <h2>Operation Lost</h2>
            <p id="final-score-text">You reached wave 1.</p>
            <button id="restart-button" type="button" className="cta-button">Return to Hangar</button>
          </div>
        </section>
      </div>
    </main>
  );
}
