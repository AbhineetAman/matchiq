import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useTeams } from "../hooks/useStandings";

export default function Teams() {
  const { data, isLoading, isError, refetch } = useTeams();

  const byGroup = useMemo(() => {
    const map = {};
    (data || []).forEach((t) => {
      (map[t.group] ||= []).push(t);
    });
    return map;
  }, [data]);

  if (isLoading) return <LoadingSkeleton count={9} />;
  if (isError) return <ErrorState message="Could not load teams." onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">All 48 Teams</h1>
        <p className="mt-1 text-sm text-slate-400">Ratings power the Dixon-Coles prediction engine.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.keys(byGroup).sort().map((letter, gi) => (
          <motion.div
            key={letter}
            className="card overflow-hidden"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: gi * 0.03 }}
          >
            <div className="border-b border-navy-700 px-4 py-2.5 font-bold text-white">Group {letter}</div>
            <div className="divide-y divide-navy-700/50">
              {byGroup[letter].map((t) => (
                <Link
                  key={t.id}
                  to={`/players?team=${t.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-navy-700/40"
                >
                  <span className="text-xl">{t.flag}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{t.name}</span>
                  <span className="stat text-xs text-slate-500">{t.code}</span>
                  <span className="stat rounded bg-navy-900 px-2 py-0.5 text-xs font-bold text-gold">{t.rating}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
