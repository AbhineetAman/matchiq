import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMatchDetails } from "../../utils/apiClient";
import LoadingSkeleton from "../common/LoadingSkeleton";

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "lineups", label: "Lineups" },
  { id: "stats", label: "Stats" },
];

const EVENT_ICONS = { goal: "⚽", own_goal: "⚽", penalty_goal: "⚽", yellow: "🟨", red: "🟥", sub: "🔁" };
const EVENT_NOTES = { own_goal: "OG", penalty_goal: "P" };

function minuteLabel(e) {
  return e.injury_time ? `${e.minute}+${e.injury_time}'` : `${e.minute}'`;
}

function TimelineRow({ event }) {
  const home = event.team === "home";
  const body = (
    <div className={`min-w-0 ${home ? "text-left" : "text-right"}`}>
      <span className="font-semibold text-slate-200">{event.player || "—"}</span>
      {EVENT_NOTES[event.type] && <span className="text-slate-500"> ({EVENT_NOTES[event.type]})</span>}
      {event.detail && (
        <div className="truncate text-xs text-slate-500">
          {event.type === "sub" ? `↓ ${event.detail}` : `assist: ${event.detail}`}
        </div>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 justify-self-start">{home && <><span>{EVENT_ICONS[event.type]}</span>{body}</>}</div>
      <div className="text-center">
        <span className="stat rounded-full bg-navy-900 px-2 py-0.5 text-xs text-slate-400">{minuteLabel(event)}</span>
        {event.score && <div className="stat mt-0.5 text-xs font-bold text-gold">{event.score}</div>}
      </div>
      <div className="flex items-center gap-2 justify-self-end">{!home && <>{body}<span>{EVENT_ICONS[event.type]}</span></>}</div>
    </div>
  );
}

/* When the free feed has no minute-by-minute events, the timeline still shows
   the real score progression — kick-off, half-time and the live/full-time
   score — derived entirely from data we already have. */
function ScoreProgression({ match, stats }) {
  const ht = stats.find((s) => s.label === "Half-time");
  const scored = match.home_score !== null && match.home_score !== undefined;
  const milestones = [{ label: "Kick-off", home: "0", away: "0" }];
  if (ht) milestones.push({ label: "Half-time", home: ht.home, away: ht.away });
  if (scored) {
    const live = match.status === "LIVE" || match.status === "HT";
    milestones.push({
      label: live ? `Live${match.minute ? ` ${match.minute}'` : ""}` : "Full-time",
      home: String(match.home_score),
      away: String(match.away_score),
    });
  }
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        <span className="justify-self-start text-xl leading-none">{match.home?.flag}</span>
        <span>Score progression</span>
        <span className="justify-self-end text-xl leading-none">{match.away?.flag}</span>
      </div>
      <div className="divide-y divide-navy-700/40 pb-1">
        {milestones.map((m) => (
          <div key={m.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-sm">
            <span className="stat justify-self-start text-lg font-bold text-slate-200">{m.home}</span>
            <span className="text-center text-xs text-slate-400">{m.label}</span>
            <span className="stat justify-self-end text-lg font-bold text-slate-200">{m.away}</span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-2.5 pt-1 text-[10px] uppercase tracking-wider text-slate-600">
        Goal scorers and minutes need a live data feed
      </div>
    </div>
  );
}

function LineupColumn({ team, lineup }) {
  if (!lineup) {
    return <div className="p-4 text-center text-sm text-slate-500">Lineup not available yet.</div>;
  }
  return (
    <div className="min-w-0 p-4">
      <div className="mb-1 flex items-center gap-2 font-bold text-white">
        <span className="text-xl">{team?.flag}</span>
        <span className="truncate">{team?.name}</span>
      </div>
      <div className="mb-3 text-xs text-slate-500">
        {lineup.is_full_xi ? `Starting XI${lineup.formation ? ` · ${lineup.formation}` : ""}` : "Squad"}
        {lineup.coach ? ` · Coach: ${lineup.coach}` : ""}
      </div>
      <ul className="space-y-1.5 text-sm">
        {lineup.starting.map((p) => (
          <li key={`${p.name}-${p.shirt}`} className="flex items-center gap-2">
            <span className="stat w-6 shrink-0 text-right text-xs text-slate-500">{p.shirt ?? "·"}</span>
            <span className="truncate text-slate-200">{p.name}</span>
            {p.position && (
              <span className="shrink-0 rounded bg-navy-900 px-1.5 py-0.5 text-[10px] text-slate-400">
                {p.position}
              </span>
            )}
          </li>
        ))}
      </ul>
      {lineup.bench.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
            Bench ({lineup.bench.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {lineup.bench.map((p) => (
              <li key={`${p.name}-${p.shirt}`} className="flex items-center gap-2 text-slate-400">
                <span className="stat w-6 shrink-0 text-right text-xs text-slate-600">{p.shirt ?? "·"}</span>
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatRow({ row }) {
  const num = (v) => parseFloat(String(v).replace("%", "")) || 0;
  const home = num(row.home);
  const away = num(row.away);
  const pill = "rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-navy-900";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-sm">
      <span className={`stat justify-self-start ${home > away ? pill : "text-slate-300"}`}>{row.home}</span>
      <span className="text-center text-slate-400">{row.label}</span>
      <span className={`stat justify-self-end ${away > home ? pill : "text-slate-300"}`}>{row.away}</span>
    </div>
  );
}

/* Tabbed Timeline / Lineups / Stats panel for a match that is in play or
   finished — shown in the match modal instead of the prediction engine. */
export default function MatchDetailTabs({ match }) {
  const [tab, setTab] = useState("stats");
  const live = match.status === "LIVE" || match.status === "HT";
  const { data, isLoading } = useQuery({
    queryKey: ["match-details", match.id],
    queryFn: () => fetchMatchDetails(match.id),
    staleTime: live ? 60_000 : 15 * 60_000,
    refetchInterval: live ? 60_000 : false,
  });

  if (isLoading) return <LoadingSkeleton variant="table" count={4} />;
  if (!data?.available) {
    return (
      <div className="card p-5 text-center text-sm text-slate-400">
        Match details aren't available yet — check back shortly after kickoff.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-3 border-b border-navy-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2.5 text-xs font-bold uppercase tracking-wider transition ${
              tab === t.id ? "border-b-2 border-gold text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timeline" &&
        (data.timeline.length ? (
          <div className="divide-y divide-navy-700/60 py-1">
            {data.timeline.map((e, i) => (
              <TimelineRow key={i} event={e} />
            ))}
          </div>
        ) : (
          <ScoreProgression match={match} stats={data.stats} />
        ))}

      {tab === "lineups" && (
        <div className="grid divide-y divide-navy-700/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <LineupColumn team={match.home} lineup={data.home_lineup} />
          <LineupColumn team={match.away} lineup={data.away_lineup} />
        </div>
      )}

      {tab === "stats" && (
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            <span className="justify-self-start text-xl leading-none">{match.home?.flag}</span>
            <span>Team stats</span>
            <span className="justify-self-end text-xl leading-none">{match.away?.flag}</span>
          </div>
          <div className="divide-y divide-navy-700/40 pb-2">
            {data.stats.map((row) => (
              <StatRow key={row.label} row={row} />
            ))}
          </div>
          {data.referee && (
            <div className="px-4 pb-1 text-xs text-slate-500">Referee: {data.referee}</div>
          )}
          {data.note && (
            <div className="px-4 pb-2.5 pt-1 text-[10px] uppercase tracking-wider text-slate-600">{data.note}</div>
          )}
        </div>
      )}
    </div>
  );
}
