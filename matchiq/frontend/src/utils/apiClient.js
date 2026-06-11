import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL, timeout: 20000 });

export const fetchLive = () => api.get("/api/matches/live").then((r) => r.data);
export const fetchToday = () => api.get("/api/matches/today").then((r) => r.data);
export const fetchMatches = (params = {}) => api.get("/api/matches", { params }).then((r) => r.data);
export const fetchMatch = (id) => api.get(`/api/matches/${id}`).then((r) => r.data);
export const fetchStandings = () => api.get("/api/standings").then((r) => r.data);
export const fetchTeams = () => api.get("/api/teams").then((r) => r.data);
export const fetchPlayers = (params = {}) => api.get("/api/players", { params }).then((r) => r.data);
export const fetchPrediction = (home, away) =>
  api.get(`/api/predictions/${encodeURIComponent(home)}/${encodeURIComponent(away)}`).then((r) => r.data);
export const fetchSimulation = (runs = 1000) =>
  api.get("/api/simulate", { params: { runs } }).then((r) => r.data);
export const exportUrl = (file) => `${API_URL}/api/export/${file}`;

export default api;
