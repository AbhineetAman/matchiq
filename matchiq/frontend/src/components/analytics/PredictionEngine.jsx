import { motion } from "framer-motion";
import { useMatchPrediction } from "../../hooks/useMatchPrediction";
import LoadingSkeleton from "../common/LoadingSkeleton";
import { ErrorState } from "../common/ErrorBoundary";

function ProbBar({ label, value, tone }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="stat font-bold text-white">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-navy-900">
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

const CONFIDENCE_TONE = {
  HIGH: "text-pitch",
  MEDIUM: "text-amber",
  LOW: "text-danger",
};

export default function PredictionEngine({ home, away }) {
  const { data, isLoading, isError, refetch } = useMatchPrediction(home, away);

  if (!home || !away) {
    return (
      <div className="card grid place-items-center p-10 text-slate-400">
        Select two teams to run the Dixon-Coles prediction model.
      </div>
    );
  }
  if (isLoading) return <LoadingSkeleton variant="table" count={4} />;
  if (isError) return <ErrorState message="Could not compute the prediction." onRetry={refetch} />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">
          {data.home.flag} {data.home.name} <span className="text-slate-500">vs</span> {data.away.flag}{" "}
          {data.away.name}
        </h3>
        <span className={`text-xs font-bold uppercase tracking-wider ${CONFIDENCE_TONE[data.confidence]}`}>
          ● {data.confidence} confidence
        </span>
      </div>

      <div className="space-y-3">
        <ProbBar label={`${data.home.name} win`} value={data.home_win} tone="bg-pitch" />
        <ProbBar label="Draw" value={data.draw} tone="bg-amber" />
        <ProbBar label={`${data.away.name} win`} value={data.away_win} tone="bg-danger" />
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-navy-700 pt-4 text-center">
        <div>
          <div className="text-xs text-slate-500">Projected score</div>
          <div className="stat text-2xl font-bold text-gold">{data.most_likely_score}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">xG {data.home.code}</div>
          <div className="stat text-2xl font-bold text-white">{data.expected_home_goals}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">xG {data.away.code}</div>
          <div className="stat text-2xl font-bold text-white">{data.expected_away_goals}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Most likely scorelines
        </div>
        <div className="flex flex-wrap gap-2">
          {data.top_scorelines.map((s) => (
            <span key={`${s.home_goals}-${s.away_goals}`} className="rounded-lg bg-navy-900 px-3 py-1.5 text-sm">
              <span className="stat font-bold text-white">
                {s.home_goals}-{s.away_goals}
              </span>{" "}
              <span className="text-slate-500">{(s.probability * 100).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
