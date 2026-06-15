import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import LiveScoreCard from "../components/dashboard/LiveScoreCard";
import MatchDetailTabs from "../components/dashboard/MatchDetailTabs";
import { HighlightsStrip, MatchHighlights } from "../components/dashboard/MatchHighlights";
import HeadToHeadComparison from "../components/analytics/HeadToHeadComparison";
import PredictionEngine from "../components/analytics/PredictionEngine";
import XGChart from "../components/analytics/xGChart";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useStandings } from "../hooks/useStandings";
import { exportUrl, fetchMatches, fetchPlayers } from "../utils/apiClient";
import { toISTString } from "../utils/timeUtils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "groups", label: "Group stage" },
  { id: "knockouts", label: "Knockouts" },
];

const GROUPS = "ABCDEFGHIJKL".split("");

function MatchModal({ match, onClose }) {
  const standings = useStandings();
  const players = useQuery({
    queryKey: ["match-players", match.id],
    queryFn: async () => {
      const [home, away] = await Promise.all([
        fetchPlayers({ team: match.home.id }),
        fetchPlayers({ team: match.away.id }),
      ]);
      return [...home, ...away];
    },
    enabled: Boolean(match.home && match.away),
  });

  const rowFor = (teamId) =>
    standings.data?.flatMap((g) => g.rows).find((r) => r.team.id === teamId);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl space-y-5 rounded-2xl border border-navy-600 bg-navy-900 p-5 sm:p-6"
        initial={{ y: 30, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {match.home?.flag} {match.home?.name || "TBD"} <span className="text-slate-500">vs</span>{" "}
              {match.away?.flag} {match.away?.name || "TBD"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {match.group ? `Group ${match.group}` : match.stage} · {toISTString(match.kickoff_utc)} ·{" "}
              {match.venue}, {match.city}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        {match.home && match.away ? (
          <>
            <MatchHighlights match={match} />
            {/* prediction makes no sense once the match has kicked off — show
                the real scorecard (timeline / lineups / stats) instead */}
            {["FT", "LIVE", "HT"].includes(match.status) ? (
              <MatchDetailTabs match={match} />
            ) : (
              <PredictionEngine home={match.home.id} away={match.away.id} />
            )}
            {standings.data && (
              <HeadToHeadComparison
                homeTeam={match.home}
                awayTeam={match.away}
                homeRow={rowFor(match.home.id)}
                awayRow={rowFor(match.away.id)}
              />
            )}
            {players.isLoading ? (
              <LoadingSkeleton variant="table" count={3} />
            ) : players.data?.length ? (
              <XGChart players={players.data} title="Key players — goals vs xG (both squads)" />
            ) : null}
          </>
        ) : (
          <div className="card p-6 text-center text-slate-400">
            Teams will be confirmed once the qualifying round completes.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Matches() {
  const [filter, setFilter] = useState("all");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["all-matches"],
    queryFn: () => fetchMatches(),
    staleTime: 2 * 60_000,
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    let out = data;
    const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (filter === "today") {
      out = out.filter(
        (m) => new Date(m.kickoff_utc).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayIst
      );
    } else if (filter === "week") {
      const end = Date.now() + 7 * 86400_000;
      out = out.filter((m) => {
        const t = new Date(m.kickoff_utc).getTime();
        return t >= Date.now() - 86400_000 && t <= end;
      });
    } else if (filter === "groups") {
      out = out.filter((m) => m.stage === "Group Stage");
    } else if (filter === "knockouts") {
      out = out.filter((m) => m.stage !== "Group Stage");
    }
    if (group) out = out.filter((m) => m.group === group);
    return out;
  }, [data, filter, group]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-white">Matches</h1>
        <a href={exportUrl("matches.csv")} className="btn-ghost text-sm">
          ⬇ Download CSV
        </a>
      </div>

      <HighlightsStrip />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              filter === f.id ? "bg-gold font-semibold text-navy-900" : "border border-navy-600 text-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input-dark ml-auto">
          <option value="">All groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              Group {g}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton count={6} />
      ) : isError ? (
        <ErrorState message="Could not load matches." onRetry={refetch} />
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => (
            <LiveScoreCard key={m.id} match={m} index={Math.min(i, 8)} onClick={() => setSelected(m)} />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">No matches for this filter.</div>
      )}

      <AnimatePresence>{selected && <MatchModal match={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}
