import { useQuery } from "@tanstack/react-query";
import { fetchPrediction } from "../utils/apiClient";

export function useMatchPrediction(home, away) {
  return useQuery({
    queryKey: ["prediction", home, away],
    queryFn: () => fetchPrediction(home, away),
    enabled: Boolean(home && away && home !== away),
    staleTime: 30 * 60_000,
  });
}
