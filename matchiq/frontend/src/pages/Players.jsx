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

function radarData(player) {
  const metrics = [
    ["Goals", (p) => p.goals, 8],
    ["Assists", (p) => p.assists, 6],
    ["xG", (p) => p.xg, 8],
    ["Passing", (p) => p.pass_accuracy, 100],
    ["Rating", (p) => p.rating, 10],
    ["Minutes", (p) => p.minutes, 320],
    ["Age", (p) => p.age, 40],
  ];
  // live-mode players carry no advanced metrics
  const usable = metrics.filter(([, fn]) => fn(player) != null);
  return usable.map(([label, fn, max]) => ({
    metric: label,
    [player.name]: Math.round(((fn(player) ?? 0) / max) * 100),
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
        <div>
          <div className="stat font-bold text-white">
            {(player.yellow_cards || 0) + (player.red_cards || 0) > 0 ? (
              <>
                {player.yellow_cards > 0 && <span className="text-amber">🟨{player.yellow_cards}</span>}
                {player.red_cards > 0 && <span className="text-danger"> 🟥{player.red_cards}</span>}
              </>
            ) : "–"}
          </div>
          <div className="text-slate-500">Cards</div>
        </div>
        <div><div className="stat font-bold text-white">{player.xg ?? "–"}</div><div className="text-slate-500">xG</div></div>
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
  const [selectedPlayer, setSelectedPlayer] = useState(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Players</h1>
          <p className="mt-1 text-sm text-slate-400">Tap a player to view their profile and stats.</p>
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

      {selectedPlayer && (
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PlayerAvatar player={selectedPlayer} size="lg" />
              <div>
                <h2 className="text-xl font-bold text-white">{selectedPlayer.name}</h2>
                <div className="text-sm text-slate-400">
                  {selectedPlayer.team_flag} {selectedPlayer.team_name} · {selectedPlayer.nationality || selectedPlayer.team_name} · {selectedPlayer.position} {selectedPlayer.age ? `· ${selectedPlayer.age}y` : ""}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedPlayer(null)} className="text-sm text-slate-400 hover:text-danger">Close</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Player Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">Rating</div>
                  <div className="text-lg font-bold text-gold">{selectedPlayer.rating ?? "–"}</div>
                </div>
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">Goals</div>
                  <div className="text-lg font-bold text-white">{selectedPlayer.goals ?? "0"}</div>
                </div>
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">Assists</div>
                  <div className="text-lg font-bold text-white">{selectedPlayer.assists ?? "0"}</div>
                </div>
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">xG</div>
                  <div className="text-lg font-bold text-white">{selectedPlayer.xg ?? "–"}</div>
                </div>
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">Pass Accuracy</div>
                  <div className="text-lg font-bold text-white">{selectedPlayer.pass_accuracy ? `${selectedPlayer.pass_accuracy}%` : "–"}</div>
                </div>
                <div className="card bg-navy-800 p-3">
                  <div className="text-xs text-slate-500">Minutes</div>
                  <div className="text-lg font-bold text-white">{selectedPlayer.minutes ?? "0"}</div>
                </div>
              </div>
            </div>
            <div className="h-64 lg:h-auto">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData(selectedPlayer)}>
                  <PolarGrid stroke="#27314A" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={selectedPlayer.name} dataKey={selectedPlayer.name} stroke="#FFD700" fill="#FFD700" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <PlayerHeatmap player={selectedPlayer} />
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
              selected={selectedPlayer?.id === p.id}
              onToggle={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">No players match your filters.</div>
      )}
    </div>
  );
}
