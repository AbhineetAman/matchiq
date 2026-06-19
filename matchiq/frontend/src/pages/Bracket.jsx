import TournamentBracket from "../components/dashboard/TournamentBracket";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorBoundary";
import { useTeams } from "../hooks/useStandings";

export default function Bracket() {
  const { data, isLoading, isError, refetch } = useTeams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Knockout Bracket Builder</h1>
        <p className="mt-1 text-sm text-slate-400">
          The 48-team knockout field, seeded by team rating. Build your own road to the final starting from the group stage — model win
          probabilities are shown next to each team.
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" count={8} />
      ) : isError ? (
        <ErrorState message="Could not load teams." onRetry={refetch} />
      ) : (
        <TournamentBracket teams={data} />
      )}
    </div>
  );
}
