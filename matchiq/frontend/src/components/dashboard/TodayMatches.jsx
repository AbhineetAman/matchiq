import { Link } from "react-router-dom";
import { toISTTime } from "../../utils/timeUtils";

function statusLabel(m) {
  if (m.status === "LIVE") return <span className="text-pitch font-bold">{m.minute}'</span>;
  if (m.status === "HT") return <span className="text-pitch font-bold">HT</span>;
  if (m.status === "FT") return <span className="text-slate-500 font-bold">FT</span>;
  return <span className="text-gold">{toISTTime(m.kickoff_utc)}</span>;
}

export default function TodayMatches({ matches }) {
  if (!matches?.length) {
    return <div className="card p-6 text-center text-slate-400">No matches scheduled today.</div>;
  }

  return (
    <div className="card divide-y divide-navy-700/60">
      {matches.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
          <div className="w-20 shrink-0 text-xs stat">{statusLabel(m)}</div>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-sm">
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
          {m.home && m.away && (
            <Link
              to={`/predictions?home=${m.home.id}&away=${m.away.id}`}
              className="shrink-0 rounded-lg border border-navy-600 px-2.5 py-1 text-xs text-slate-300 transition hover:border-gold hover:text-gold"
            >
              Predict
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
