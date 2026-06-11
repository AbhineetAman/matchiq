import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PredictionEngine from "../components/analytics/PredictionEngine";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useTeams } from "../hooks/useStandings";
import { fetchSimulation } from "../utils/apiClient";

function TeamSelect({ teams, value, onChange, label, exclude }) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-sm text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-dark w-full">
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} disabled={String(t.id) === exclude}>
            {t.flag} {t.name} (Group {t.group})
          </option>
        ))}
      </select>
    </label>
  );
}

function SimulationPanel() {
  const [requested, setRequested] = useState(false);
  const sim = useQuery({
    queryKey: ["simulation"],
    queryFn: () => fetchSimulation(1000),
    enabled: requested,
    staleTime: 10 * 60_000,
  });

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">🎲 Tournament simulation</h2>
          <p className="text-sm text-slate-400">
            Runs the full 48-team tournament 1,000 times with the Dixon-Coles model — groups, best-thirds and
            knockouts included.
          </p>
        </div>
        <button onClick={() => (requested ? sim.refetch() : setRequested(true))} className="btn-gold">
          {sim.isFetching ? "Simulating…" : "Run 1,000 simulations"}
        </button>
      </div>

      {sim.isFetching && <LoadingSkeleton variant="line" count={6} className="mt-5" />}
      {sim.isError && (
        <div className="mt-5">
          <ErrorState message="Simulation failed." onRetry={sim.refetch} />
        </div>
      )}
      {sim.data && !sim.isFetching && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">Most likely champion</div>
              <div className="text-xl font-extrabold text-gold">
                {sim.data.most_likely_champion.flag} {sim.data.most_likely_champion.name} —{" "}
                {sim.data.results[0].champion_pct}%
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {sim.data.results.slice(0, 12).map((r, i) => (
              <div key={r.team.id} className="flex items-center gap-3 text-sm">
                <span className="stat w-5 text-slate-500">{i + 1}</span>
                <span className="w-40 truncate font-medium text-slate-200">
                  {r.team.flag} {r.team.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-900">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold to-pitch"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, r.champion_pct * 4)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04 }}
                  />
                </div>
                <span className="stat w-14 text-right font-bold text-white">{r.champion_pct}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Win the title % over {sim.data.runs} Monte Carlo runs · reach-final and semi-final rates available via{" "}
            <code className="text-slate-400">/api/simulate</code>.
          </p>
        </div>
      )}
    </section>
  );
}

export default function Predictions() {
  const [params, setParams] = useSearchParams();
  const teams = useTeams();
  const home = params.get("home") || "";
  const away = params.get("away") || "";

  const setTeam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Predictions</h1>
        <p className="mt-1 text-sm text-slate-400">
          Dixon-Coles Poisson engine — the same model used by professional trading desks, tuned for international
          football.
        </p>
      </div>

      {teams.isLoading ? (
        <LoadingSkeleton variant="table" count={2} />
      ) : teams.isError ? (
        <ErrorState message="Could not load teams." onRetry={teams.refetch} />
      ) : (
        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <TeamSelect teams={teams.data} value={home} onChange={(v) => setTeam("home", v)} label="Team A" exclude={away} />
          <span className="hidden pb-2 font-bold text-slate-500 sm:block">VS</span>
          <TeamSelect teams={teams.data} value={away} onChange={(v) => setTeam("away", v)} label="Team B" exclude={home} />
        </div>
      )}

      <PredictionEngine home={home} away={away} />
      <SimulationPanel />
    </div>
  );
}
