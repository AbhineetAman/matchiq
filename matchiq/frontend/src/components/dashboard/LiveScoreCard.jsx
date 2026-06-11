import { motion } from "framer-motion";
import { toISTTime } from "../../utils/timeUtils";
import ShareCard from "../widgets/ShareCard";

function StatusBadge({ match }) {
  if (match.status === "LIVE" || match.status === "HT") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-pitch/10 px-2.5 py-1 text-xs font-bold text-pitch">
        <span className="h-2 w-2 rounded-full bg-pitch animate-livepulse" />
        {match.status === "HT" ? "HT" : `LIVE ${match.minute}'`}
      </span>
    );
  }
  if (match.status === "FT") {
    return <span className="rounded-full bg-navy-700 px-2.5 py-1 text-xs font-bold text-slate-400">FT</span>;
  }
  return (
    <span className="rounded-full bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">
      {toISTTime(match.kickoff_utc)}
    </span>
  );
}

function TeamRow({ team, score, winner }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-2xl leading-none">{team?.flag || "🏳️"}</span>
        <span className={`truncate font-semibold ${winner ? "text-white" : "text-slate-300"}`}>
          {team?.name || "TBD"}
        </span>
      </div>
      {score !== null && score !== undefined && (
        <span className={`stat text-2xl font-bold ${winner ? "text-gold" : "text-slate-200"}`}>{score}</span>
      )}
    </div>
  );
}

export default function LiveScoreCard({ match, onClick, index = 0 }) {
  const played = match.home_score !== null && match.home_score !== undefined;
  const homeWin = played && match.home_score > match.away_score;
  const awayWin = played && match.away_score > match.home_score;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.05 }}
      onClick={onClick}
      className={`card p-4 transition hover:border-gold/50 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>{match.group ? `Group ${match.group}` : match.stage}</span>
        <StatusBadge match={match} />
      </div>
      <div className="space-y-2.5">
        <TeamRow team={match.home} score={match.home_score} winner={homeWin} />
        <TeamRow team={match.away} score={match.away_score} winner={awayWin} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-navy-700 pt-2.5 text-xs text-slate-500">
        <span className="truncate">📍 {match.venue}, {match.city}</span>
        <ShareCard match={match} />
      </div>
    </motion.article>
  );
}
