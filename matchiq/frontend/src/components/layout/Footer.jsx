import { exportUrl, API_URL } from "../../utils/apiClient";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-navy-700 bg-navy-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="font-extrabold text-white">
            Match<span className="text-gold">IQ</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            FIFA World Cup 2026 intelligence — live scores in IST, standings, player analytics, Dixon-Coles
            predictions and tournament simulations.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-semibold text-slate-200">Data exports</div>
          <ul className="space-y-1 text-slate-400">
            <li><a className="hover:text-gold" href={exportUrl("matches.csv")}>Matches CSV</a></li>
            <li><a className="hover:text-gold" href={exportUrl("standings.csv")}>Standings CSV</a></li>
            <li><a className="hover:text-gold" href={exportUrl("players.csv")}>Players CSV</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-semibold text-slate-200">Developers</div>
          <ul className="space-y-1 text-slate-400">
            <li><a className="hover:text-gold" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">API documentation</a></li>
            <li><a className="hover:text-gold" href="/widget">Embeddable widgets</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-800 py-4 text-center text-xs text-slate-500">
        MatchIQ v1.0 · Unofficial fan analytics platform · Not affiliated with FIFA
      </div>
    </footer>
  );
}
