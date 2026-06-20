import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toISTTime } from "../../utils/timeUtils";
import { fetchMatchDetails } from "../../utils/apiClient";

function statusLabel(m) {
  if (m.status === "LIVE") return <span className="text-pitch font-bold">{m.minute}'</span>;
  if (m.status === "HT") return <span className="text-pitch font-bold">HT</span>;
  if (m.status === "FT") return <span className="text-slate-500 font-bold">FT</span>;
  return <span className="text-gold">{toISTTime(m.kickoff_utc)}</span>;
}

function MatchStats({ matchId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["match-details", matchId],
    queryFn: () => fetchMatchDetails(matchId),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="shrink-0 text-[10px] text-slate-500">Loading stats...</div>;
  if (!data?.available) return <div className="shrink-0 text-[10px] text-slate-500">No stats available</div>;

  const getStat = (label) => data.stats.find(s => s.label === label);
  const poss = getStat("Possession") || getStat("Ball Possession");
  const passes = getStat("Passes");

  return (
    <div className="shrink-0 text-[10px] text-slate-400 text-right leading-tight flex flex-col justify-center">
      {poss && <div>Poss: {poss.home} - {poss.away}</div>}
      {passes && <div>Passes: {passes.home} - {passes.away}</div>}
    </div>
  );
}

export default function TodayMatches({ matches }) {
  if (!matches?.length) {
    return <div className="card p-6 text-center text-slate-400">No matches scheduled today.</div>;
  }

  return (
    <div className="card divide-y divide-navy-700/60">
      {matches.map((m) => {
        const isFuture = !["FT", "LIVE", "HT"].includes(m.status);
        
        return (
          <Link key={m.id} to={`/matches/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-800 transition">
            <div className="w-20 shrink-0 text-xs stat">{statusLabel(m)}</div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <div className="flex w-full items-center justify-center gap-2 text-sm">
                <span className="truncate text-right font-medium text-slate-200" style={{ flexBasis: "40%" }}>
                  {m.home?.name || "TBD"} {m.home?.flag}
                </span>
                <span className="stat shrink-0 rounded bg-navy-900 px-2 py-0.5 font-bold text-white">
                  {m.home_score ?? "–"} : {m.away_score ?? "–"}
                </span>
                <span className="truncate font-medium text-slate-200" style={{ flexBasis: "40%" }}>
                  {m.away?.flag} {m.away?.name || "TBD"}
                </span>
              </div>
              {(!isFuture && (m.home_scorers?.length > 0 || m.away_scorers?.length > 0)) && (
                <div className="flex w-full text-[10px] text-slate-400">
                  <div className="flex-1 text-right pr-2 truncate">
                    {m.home_scorers?.map((g, i) => <span key={i}>{g.player} {g.minute}'{i < m.home_scorers.length - 1 ? ', ' : ''}</span>)}
                  </div>
                  <div className="w-[38px] shrink-0"></div>
                  <div className="flex-1 text-left pl-2 truncate">
                    {m.away_scorers?.map((g, i) => <span key={i}>{g.player} {g.minute}'{i < m.away_scorers.length - 1 ? ', ' : ''}</span>)}
                  </div>
                </div>
              )}
            </div>
            {m.home && m.away && (
              isFuture ? (
                <div
                  className="shrink-0 rounded-lg border border-navy-600 px-2.5 py-1 text-xs text-slate-300 transition hover:border-gold hover:text-gold"
                >
                  Predict
                </div>
              ) : (
                <MatchStats matchId={m.id} />
              )
            )}
          </Link>
        );
      })}
    </div>
  );
}
