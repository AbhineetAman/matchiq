import GroupStandingsTable from "../components/dashboard/GroupStandingsTable";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useStandings } from "../hooks/useStandings";
import { exportUrl } from "../utils/apiClient";

export default function Standings() {
  const { data, isLoading, isError, refetch } = useStandings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Group Standings</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-pitch" /> Qualified (top 2)</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber" /> Best-third contention</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-danger" /> Elimination zone</span>
          </div>
        </div>
        <a href={exportUrl("standings.csv")} className="btn-ghost text-sm">
          ⬇ Download CSV
        </a>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" count={6} />
      ) : isError ? (
        <ErrorState message="Could not load standings." onRetry={refetch} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((g) => (
            <GroupStandingsTable key={g.group} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}
