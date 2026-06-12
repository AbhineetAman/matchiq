import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Generous timeout: the free-tier backend can take ~40s to wake from sleep,
// and a slow success beats a fast timeout error.
const api = axios.create({ baseURL: API_URL, timeout: 65000 });

// Fire-and-forget wake-up call as soon as the app loads, so the backend is
// already warming while the user is still looking at the first page.
api.get("/health").catch(() => {});

export const fetchLive = () => api.get("/api/matches/live").then((r) => r.data);
export const fetchToday = () => api.get("/api/matches/today").then((r) => r.data);
export const fetchMatches = (params = {}) => api.get("/api/matches", { params }).then((r) => r.data);
export const fetchMatch = (id) => api.get(`/api/matches/${id}`).then((r) => r.data);
export const fetchStandings = () => api.get("/api/standings").then((r) => r.data);
export const fetchTeams = () => api.get("/api/teams").then((r) => r.data);
export const fetchTeamSquad = (ref) => api.get(`/api/teams/${ref}`).then((r) => r.data);
export const fetchPlayers = (params = {}) => api.get("/api/players", { params }).then((r) => r.data);
export const fetchPrediction = (home, away) =>
  api.get(`/api/predictions/${encodeURIComponent(home)}/${encodeURIComponent(away)}`).then((r) => r.data);
export const fetchSimulation = (runs = 1000) =>
  api.get("/api/simulate", { params: { runs } }).then((r) => r.data);
export const fetchNews = () => api.get("/api/news").then((r) => r.data);
export const exportUrl = (file) => `${API_URL}/api/export/${file}`;

export default api;
