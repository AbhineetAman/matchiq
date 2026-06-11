import { useQuery } from "@tanstack/react-query";
import { fetchStandings, fetchTeams } from "../utils/apiClient";

export function useStandings() {
  return useQuery({
    queryKey: ["standings"],
    queryFn: fetchStandings,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
    staleTime: 60 * 60_000,
  });
}
