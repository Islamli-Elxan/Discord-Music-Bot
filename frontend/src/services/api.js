import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

export const api = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true
});

export async function fetchRecommendations(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/recommendations`);
  return res.data?.tracks || [];
}

export async function fetchAutoplayStats(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/autoplay-stats`);
  return res.data || {};
}

export async function fetchAutoplaySettings(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/autoplay-settings`);
  return res.data || {};
}

export async function fetchEqPreset(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/eq`);
  return res.data || {};
}

// Analytics endpoints (may be added server-side)
export async function fetchAnalyticsSummary(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/summary`);
  return res.data;
}

export async function fetchAnalyticsDaily(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/daily`);
  return res.data;
}

export async function fetchAnalyticsTopTracks(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/top-tracks`);
  return res.data;
}

export async function fetchAnalyticsTopListeners(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/top-listeners`);
  return res.data;
}

export async function fetchAnalyticsGenres(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/genres`);
  return res.data;
}

export async function fetchAnalyticsHeatmap(guildId) {
  const res = await api.get(`/api/${encodeURIComponent(guildId)}/analytics/heatmap`);
  return res.data;
}

export async function postAutoplaySettings(payload) {
  // Server supports websocket settings:autoplay already; if later moved to HTTP, keep this.
  const res = await api.post(`/api/autoplay/settings`, payload);
  return res.data;
}

