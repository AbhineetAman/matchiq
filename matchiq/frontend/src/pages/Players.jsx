import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
} from "recharts";
import PlayerHeatmap from "../components/analytics/PlayerHeatmap";
import TeamFormGuide from "../components/analytics/TeamFormGuide";
import PlayerAvatar from "../components/common/PlayerAvatar";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useTeams } from "../hooks/useStandings";
import { exportUrl, fetchPlayers } from "../utils/apiClient";

const POSITIONS = ["GK", "DF", "MF", "FW"];

function radarData(a, b) {
  const metrics = [
    ["Goals", (p) => p.goals, 8],
    ["Assists", (p) => p.assists, 6],
    ["xG", (p) => p.xg, 8],
    ["Passing", (p) => p.pass_accuracy, 100],
    ["Rating", (p) => p.rating, 10],
    ["Minutes", (p) => p.minutes, 320],
    ["Age", (p) => p.age, 40],
  ];
  // live-mode players carry no advanced metrics — only chart what both have
  const usable = metrics.filter(([, fn]) => fn(a) != null && (!b || fn(b) != null));
  return usable.map(([label, fn, max]) => ({
    metric: label,
    [a.name]: Math.round(((fn(a) ?? 0) / max) * 100),
    ...(b ? { [b.name]: Math.round(((fn(b) ?? 0) / max) * 100) } : {}),
  }));
}

function PlayerCard({ player, selected, onToggle, index }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index, 10) * 0.03 }}
      onClick={onToggle}
      className={`card p-4 text-left transition hover:border-gold/50 ${selected ? "border-pitch ring-1 ring-pitch" : ""}`}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar player={player} size="md" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{player.name}</div>
          <div className="truncate text-xs text-slate-400">
            {player.team_name} · {player.role || player.position}{player.age ? ` · ${player.age}y` : ""}
          </div>
        </div>
        {player.rating != null && (
          <span className="stat ml-auto rounded bg-gold/10 px-2 py-1 text-sm font-bold text-gold">{player.rating}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div><div className="stat font-bold text-white">{player.goals}</div><div className="text-slate-500">Goals</div></div>
        <div><div className="stat font-bold text-white">{player.assists}</div><div className="text-slate-500">Assists</div></div>
        <div><div className="stat font-bold text-white">{player.xg ?? "–"}</div><div className="text-slate-500">xG</div></div>
        <div><div className="stat font-bold text-white">{player.pass_accuracy != null ? `${player.pass_accuracy}%` : "–"}</div><div className="text-slate-500">Pass</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-navy-700 pt-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Team form</span>
        <TeamFormGuide form={player.form} size="xs" />
      </div>
    </motion.button>
  );
}

export default function Players() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState(params.get("team") || "");
  const [position, setPosition] = useState("");
  const [compare, setCompare] = useState([]);

  const teams = useTeams();
  const players = useQuery({
    queryKey: ["players", team, position],
    queryFn: () => fetchPlayers({ team: team || undefined, position: position || undefined, sort: "rating" }),
    staleTime: 15 * 60_000,
  });

  const filtered = useMemo(() => {
    if (!players.data) return [];
    if (!search) return players.data;
    return players.data.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [players.data, search]);

  const toggleCompare = (player) => {
    setCompare((prev) => {
      if (prev.find((p) => p.id === player.id)) return prev.filter((p) => p.id !== player.id);
      return [...prev.slice(-1), player];
    });
  };

  const [a, b] = compare;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Players</h1>
          <p className="mt-1 text-sm text-slate-400">Tap two players to compare them side by side.</p>
        </div>
        <a href={exportUrl("players.csv")} className="btn-ghost text-sm">⬇ Download CSV</a>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Search players…"
          className="input-dark w-full sm:w-64"
        />
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="input-dark">
          <option value="">All teams</option>
          {(teams.data || []).map((t) => (
            <option key={t.id} value={t.id}>{t.flag} {t.name}</option>
          ))}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)} className="input-dark">
          <option value="">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {a && (
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">
              ⚔️ Comparison: {a.name} {b ? `vs ${b.name}` : "(select one more player)"}
            </h2>
            <button onClick={() => setCompare([])} className="text-sm text-slate-400 hover:text-danger">Clear</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData(a, b)}>
                <PolarGrid stroke="#27314A" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={a.name} dataKey={a.name} stroke="#FFD700" fill="#FFD700" fillOpacity={0.25} />
                {b && <Radar name={b.name} dataKey={b.name} stroke="#00FF87" fill="#00FF87" fillOpacity={0.25} />}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid gap-4 sm:grid-cols-2">
              <PlayerHeatmap player={a} />
              {b && <PlayerHeatmap player={b} />}
            </div>
          </div>
        </section>
      )}

      {players.isLoading ? (
        <LoadingSkeleton count={6} />
      ) : players.isError ? (
        <ErrorState message="Could not load players." onRetry={players.refetch} />
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.slice(0, 60).map((p, i) => (
            <PlayerCard
              key={p.id}
              player={p}
              index={i}
              selected={Boolean(compare.find((c) => c.id === p.id))}
              onToggle={() => toggleCompare(p)}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">No players match your filters.</div>
      )}
    </div>
  );
}
