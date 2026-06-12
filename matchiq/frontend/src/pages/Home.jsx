import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import LiveScoreCard from "../components/dashboard/LiveScoreCard";
import MatchCountdown from "../components/dashboard/MatchCountdown";
import TodayMatches from "../components/dashboard/TodayMatches";
import TournamentBuzz from "../components/dashboard/TournamentBuzz";
import GroupStandingsTable from "../components/dashboard/GroupStandingsTable";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import PlayerAvatar from "../components/common/PlayerAvatar";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useLiveScores, useTodayMatches } from "../hooks/useLiveScores";
import { useStandings } from "../hooks/useStandings";
import { fetchMatches, fetchPlayers } from "../utils/apiClient";
import { istToday } from "../utils/timeUtils";

function SectionTitle({ children, to, linkLabel }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold text-white">{children}</h2>
      {to && (
        <Link to={to} className="text-sm text-gold hover:underline">
          {linkLabel || "View all →"}
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const live = useLiveScores();
  const today = useTodayMatches();
  const standings = useStandings();
  const matches = useQuery({ queryKey: ["all-matches"], queryFn: () => fetchMatches(), staleTime: 5 * 60_000 });
  const trending = useQuery({
    queryKey: ["trending-players"],
    queryFn: () => fetchPlayers({ sort: "rating", limit: 8 }),
    staleTime: 30 * 60_000,
  });

  const nextMatch = matches.data?.find((m) => m.status === "NS" && m.home && m.away);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
          World Cup 2026 <span className="text-gold">Command Center</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">{istToday()} · All timings in IST</p>
      </div>

      <section>
        <SectionTitle to="/matches">🔴 Live now</SectionTitle>
        {live.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : live.isError ? (
          <ErrorState message="Could not load live scores." onRetry={live.refetch} />
        ) : live.data.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.data.map((m, i) => (
              <LiveScoreCard key={m.id} match={m} index={i} />
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-slate-400">No matches in play right now.</div>
        )}
      </section>

      {nextMatch && <MatchCountdown match={nextMatch} />}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionTitle to="/matches">📅 Today's matches</SectionTitle>
          {today.isLoading ? (
            <LoadingSkeleton variant="table" count={4} />
          ) : today.isError ? (
            <ErrorState message="Could not load today's matches." onRetry={today.refetch} />
          ) : (
            <TodayMatches matches={today.data} />
          )}
        </section>

        <section className="min-w-0">
          <SectionTitle to="/players">🔥 Trending players</SectionTitle>
          {trending.isLoading ? (
            <LoadingSkeleton variant="table" count={4} />
          ) : trending.isError ? (
            <ErrorState message="Could not load players." onRetry={trending.refetch} />
          ) : (
            <div className="card divide-y divide-navy-700/60">
              {trending.data.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="stat w-5 text-slate-500">{i + 1}</span>
                  <PlayerAvatar player={p} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{p.name}</span>
                  <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[10px] text-slate-400">{p.position}</span>
                  <span className="stat text-xs text-slate-400">⚽ {p.goals}</span>
                  <span className="stat rounded bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
                    {p.rating ?? `🅰 ${p.assists}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <SectionTitle>📡 Tournament buzz</SectionTitle>
        <TournamentBuzz />
      </section>

      <section>
        <SectionTitle to="/standings">📊 Group standings snapshot</SectionTitle>
        {standings.isLoading ? (
          <LoadingSkeleton variant="table" count={4} />
        ) : standings.isError ? (
          <ErrorState message="Could not load standings." onRetry={standings.refetch} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {standings.data.slice(0, 4).map((g) => (
              <GroupStandingsTable key={g.group} group={g} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
