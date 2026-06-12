import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import ISTClock from "../common/ISTClock";
import Sidebar from "./Sidebar";

export const NAV_LINKS = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/matches", label: "Matches", icon: "⚽" },
  { to: "/standings", label: "Standings", icon: "📊" },
  { to: "/analytics", label: "Analytics", icon: "📈" },
  { to: "/predictions", label: "Predictions", icon: "🔮" },
  { to: "/players", label: "Players", icon: "👟" },
  { to: "/teams", label: "Teams", icon: "🌍" },
  { to: "/bracket", label: "Bracket", icon: "🏆" },
  { to: "/widget", label: "Embed", icon: "🧩" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold font-mono text-lg font-bold text-navy-900">
              IQ
            </span>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-white">
                Match<span className="text-gold">IQ</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">FIFA 2026 Intelligence</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? "bg-navy-700 text-gold" : "text-slate-300 hover:bg-navy-800 hover:text-white"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ISTClock className="hidden sm:inline" />
            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-navy-600 text-xl lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>
        </div>
      </header>
      <Sidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
