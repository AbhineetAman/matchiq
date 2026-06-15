import { useQuery } from "@tanstack/react-query";
import { fetchLive, fetchToday } from "../utils/apiClient";

export function useLiveScores() {
  return useQuery({
    queryKey: ["live-scores"],
    queryFn: fetchLive,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useTodayMatches() {
  return useQuery({
    queryKey: ["today-matches"],
    queryFn: fetchToday,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
