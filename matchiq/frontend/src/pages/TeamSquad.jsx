import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import PlayerAvatar from "../components/common/PlayerAvatar";
import { ErrorState } from "../components/common/ErrorBoundary";
import { fetchTeamSquad } from "../utils/apiClient";

const SECTIONS = [
  ["GK", "Goalkeepers"],
  ["DF", "Defenders"],
  ["MF", "Midfielders"],
  ["FW", "Forwards"],
];

function PlayerRow({ player, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index, 12) * 0.02 }}
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
    >
      <PlayerAvatar player={player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-200">{player.name}</div>
        <div className="truncate text-xs text-slate-500">
          {player.role || player.position}
          {player.age ? ` · ${player.age}y` : ""}
          {player.nationality ? ` · ${player.nationality}` : ""}
        </div>
      </div>
      {(player.goals > 0 || player.assists > 0) && (
        <span className="stat shrink-0 rounded bg-navy-900 px-2 py-0.5 text-xs text-slate-300">
          ⚽ {player.goals} · 🅰 {player.assists}
        </span>
      )}
      {player.rating != null && (
        <span className="stat shrink-0 rounded bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
          {player.rating}
        </span>
      )}
    </motion.div>
  );
}

export default function TeamSquad() {
  const { teamId } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team-squad", teamId],
    queryFn: () => fetchTeamSquad(teamId),
    staleTime: 30 * 60_000,
  });

  if (isLoading) return <LoadingSkeleton count={6} />;
  if (isError) return <ErrorState message="Could not load this squad." onRetry={refetch} />;

  const { team, coach, players, squad_size } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{team.flag}</span>
          <div>
            <h1 className="text-2xl font-extrabold text-white">{team.name}</h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Group {team.group} · {team.code} · {squad_size} players in squad
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/players?team=${team.id}`} className="btn-ghost text-sm">⚔️ Compare players</Link>
          <Link to="/teams" className="btn-ghost text-sm">← All teams</Link>
        </div>
      </div>

      {coach && (
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-700 text-2xl">🎩</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Head coach</div>
            <div className="font-semibold text-white">{coach.name}</div>
            <div className="text-xs text-slate-400">
              {[coach.nationality, coach.age ? `${coach.age}y` : null].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map(([code, label]) => {
          const group = players.filter((p) => p.position === code);
          if (!group.length) return null;
          return (
            <section key={code} className="card min-w-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-navy-700 px-4 py-2.5">
                <span className="font-bold text-white">{label}</span>
                <span className="stat text-xs text-slate-500">{group.length}</span>
              </div>
              <div className="divide-y divide-navy-700/50">
                {group.map((p, i) => (
                  <PlayerRow key={p.id} player={p} index={i} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
