const { QueryType } = require("discord-player");
const { getTrackMoodTags, pickGenreFromMoodTags, TAGGED_GENRE_BY_MOOD } = require("./moodDetection");

const SIMILAR_CACHE_TTL_MS = 10 * 60 * 1000; // 10m
const similarCache = new Map(); // trackUrlOrKey -> { at, tracks }

function limitUniqueByUrl(tracks, limit = 20) {
  const out = [];
  const seen = new Set();
  for (const t of tracks || []) {
    const url = (t && (t.url || t.id)) ? String(t.url || t.id) : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

function buildSearchQueries({ currentTrack }) {
  const title = currentTrack?.title || "";
  const artist = currentTrack?.author || currentTrack?.artist || "";
  const moodTags = getTrackMoodTags(currentTrack);
  const primaryMood = moodTags[0] || "";
  const genreMarker = pickGenreFromMoodTags(moodTags) || "";

  const queries = [];
  if (artist) {
    queries.push(`${artist} similar`);
    queries.push(`${artist} - topic`);
    queries.push(`${artist} official audio`);
  }

  if (primaryMood) {
    // Mood/context fallback.
    queries.push(`${primaryMood} mix`);
    queries.push(`${primaryMood} chill`);
  }

  if (genreMarker) {
    queries.push(`${genreMarker} mix`);
    queries.push(`${genreMarker} audio`);
  }

  // Extract a couple quick tags from title as additional fallbacks.
  const tokens = (title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 6);
  if (tokens.length >= 2) queries.push(`${tokens.slice(0, 3).join(" ")} mix`);

  return Array.from(new Set(queries)).slice(0, 5);
}

async function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRelatedViaExtractor({ currentTrack, queueHistory }) {
  if (!currentTrack) return [];
  const relFn = currentTrack.extractor?.getRelatedTracks;
  if (typeof relFn !== "function") return [];
  const related = await relFn(currentTrack, queueHistory);
  return related?.tracks || [];
}

async function fetchViaYouTubeSearch({ player, query, requestedBy }) {
  const result = await player.search(query, {
    requestedBy: requestedBy || null,
    searchEngine: QueryType.YOUTUBE_SEARCH
  });
  return result?.tracks || [];
}

async function fetchSimilarFromYouTubeMixes({ player, currentTrack, preferredSources }) {
  const queries = buildSearchQueries({ currentTrack });
  const tracks = [];
  // Keep this loop short to satisfy "recommendation < 2s" requirement.
  for (const q of queries.slice(0, 2)) {
    if (preferredSources && preferredSources !== "both" && preferredSources !== "youtube") break;
    try {
      const t = await withTimeout(fetchViaYouTubeSearch({ player, query: q, requestedBy: currentTrack?.requestedBy }), 1200);
      tracks.push(...t);
      if (tracks.length >= 12) break;
    } catch {
      // ignore
    }
  }
  return tracks;
}

/**
 * Multi-source similar track fetching with graceful fallbacks.
 *
 * Note: We only hard require YouTube to keep runtime < 2s.
 * Last.fm is attempted only if `LASTFM_API_KEY` is present.
 */
async function fetchSimilarTracks({ player, currentTrack, queueHistory, guildId, preferredSources }) {
  const urlKey = currentTrack?.url || currentTrack?.id || currentTrack?.title || "";
  if (urlKey) {
    const cached = similarCache.get(urlKey);
    if (cached && Date.now() - cached.at < SIMILAR_CACHE_TTL_MS) {
      return cached.tracks;
    }
  }

  const requestedBy = currentTrack?.requestedBy || null;

  let candidates = [];

  // 1) Primary: extractor-related (often YouTube-related).
  try {
    candidates = await withTimeout(
      fetchRelatedViaExtractor({ currentTrack, queueHistory }),
      1400
    );
  } catch {
    candidates = [];
  }

  // 2) Fallbacks: official/artist/topic + mood keywords searches.
  if (!Array.isArray(candidates) || candidates.length < 5) {
    try {
      const ytMixTracks = await withTimeout(
        fetchSimilarFromYouTubeMixes({ player, currentTrack, preferredSources }),
        1200
      );
      candidates = (candidates || []).concat(ytMixTracks);
    } catch {
      // ignore
    }
  }

  // 3) Fallback: targeted official audio search if mood extraction found tags.
  if (!candidates || candidates.length < 5) {
    const moodTags = getTrackMoodTags(currentTrack);
    const mood = moodTags[0];
    const artist = currentTrack?.author || currentTrack?.artist;
    if (artist && mood) {
      const q = `${artist} ${mood} official audio`;
      try {
          const extra = await withTimeout(fetchViaYouTubeSearch({ player, query: q, requestedBy }), 1200);
        candidates = (candidates || []).concat(extra);
      } catch {}
    }
  }

  // 4) Optional Last.fm similar artists (best-effort).
  // This is not critical for performance and is skipped if no API key.
  try {
    const lastFmKey = process.env.LASTFM_API_KEY;
    if (lastFmKey && (!preferredSources || preferredSources === "both" || preferredSources === "youtube") && (!candidates || candidates.length < 10)) {
      const artist = currentTrack?.author || currentTrack?.artist || "";
      if (artist) {
        const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getSimilar&artist=${encodeURIComponent(artist)}&limit=6&api_key=${encodeURIComponent(lastFmKey)}&format=json`;
        const res = await withTimeout(fetch(url), 1800);
        const json = await res.json();
        const simArtists = json?.similarartists?.artist || [];
        for (const a of simArtists.slice(0, 4)) {
          const name = a?.name;
          if (!name) continue;
          const q = `${name} official audio`;
          try {
            const extra = await withTimeout(fetchViaYouTubeSearch({ player, query: q, requestedBy }), 900);
            candidates = (candidates || []).concat(extra);
          } catch {}
        }
      }
    }
  } catch {
    // ignore last.fm errors
  }

  const final = limitUniqueByUrl(candidates, 25);

  if (urlKey) {
    similarCache.set(urlKey, { at: Date.now(), tracks: final });
  }
  return final;
}

module.exports = {
  fetchSimilarTracks
};

