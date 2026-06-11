import { useEffect, useState } from "react";
import { countdownParts, toISTString } from "../../utils/timeUtils";

function Unit({ value, label }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-navy-900 px-3 py-2 sm:px-5 sm:py-3">
      <span className="stat text-3xl font-bold text-gold sm:text-5xl">{String(value).padStart(2, "0")}</span>
      <span className="text-[10px] uppercase tracking-widest text-slate-400 sm:text-xs">{label}</span>
    </div>
  );
}

export default function MatchCountdown({ match }) {
  const [parts, setParts] = useState(() => countdownParts(match?.kickoff_utc));

  useEffect(() => {
    if (!match) return undefined;
    const t = setInterval(() => setParts(countdownParts(match.kickoff_utc)), 1000);
    return () => clearInterval(t);
  }, [match]);

  if (!match) return null;

  return (
    <section className="card overflow-hidden">
      <div className="bg-gradient-to-r from-gold/15 via-transparent to-pitch/10 p-5 sm:p-7">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">Next match</div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xl font-bold text-white sm:text-2xl">
          <span>
            {match.home?.flag} {match.home?.name || "TBD"}
          </span>
          <span className="text-slate-500">vs</span>
          <span>
            {match.away?.flag} {match.away?.name || "TBD"}
          </span>
        </div>
        {parts ? (
          <div className="flex gap-2 sm:gap-3">
            <Unit value={parts.days} label="days" />
            <Unit value={parts.hours} label="hours" />
            <Unit value={parts.mins} label="mins" />
            <Unit value={parts.secs} label="secs" />
          </div>
        ) : (
          <div className="text-pitch font-semibold">Kicking off now!</div>
        )}
        <div className="mt-4 text-sm text-slate-400">
          🗓 {toISTString(match.kickoff_utc)} · 📍 {match.venue}, {match.city}
        </div>
      </div>
    </section>
  );
}
