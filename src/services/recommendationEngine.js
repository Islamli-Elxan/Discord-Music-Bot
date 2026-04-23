const { fetchSimilarTracks } = require("./similarTracks");
const { getTrackMoodTags, getSessionMood, moodOverlap } = require("./moodDetection");
const sessionMemory = require("./sessionMemory");

function safeTrackUrl(track) {
  return (track?.url || track?.id || "").toString();
}

function extractArtist(track) {
  return (track?.author || track?.artist || "").toString();
}

function normalizeName(s) {
  return (s || "").toString().toLowerCase().trim();
}

function tagsOverlapAsGenre(currentMoodTags, candidateMoodTags) {
  if (!Array.isArray(currentMoodTags) || !Array.isArray(candidateMoodTags)) return false;
  const a = new Set(currentMoodTags);
  for (const t of candidateMoodTags) if (a.has(t)) return true;
  return false;
}

function isExplicit(text) {
  const s = (text || "").toLowerCase();
  return s.includes("explicit") || s.includes("(e)") || s.includes(" e) ") || s.includes(" - e ");
}

function computeScore({
  guildId,
  currentTrack,
  candidateTrack,
  session,
  currentMoodTags,
  currentArtist,
  currentGenreTags,
  dbTrackScores,
  settings,
  exploration
}) {
  const candidateUrl = safeTrackUrl(candidateTrack);
  const candidateArtist = extractArtist(candidateTrack);
  const candidateMoodTags = getTrackMoodTags(candidateTrack);

  // Hard blocks handled before calling computeScore, but we also keep soft blocks here.
  let score = dbTrackScores?.score != null ? Number(dbTrackScores.score) : 1.0;

  // +2.0 → track completed (not skipped)
  // We approximate "completed" by the absence of skips in our track_scores record.
  if (dbTrackScores && Number(dbTrackScores.skip_count) === 0 && Number(dbTrackScores.play_count) > 0) score += 2.0;

  // +1.0 → track played more than once this session
  // We approximate with recent plays (session state).
  // (sessionMemory already increments playedArtists; for per-track session counts we use recentTracks occurrences.)
  const playedInSession = session.recentTracks.filter((u) => u === candidateUrl).length;
  if (playedInSession > 1) score += 1.0;

  // -1.5 → track skipped within first 30 seconds
  if (session.skipWithinFirst30.has(candidateUrl)) score -= 1.5;

  // -0.5 → track played very recently (last 10 tracks)
  if (session.recentlyPlayed10.has(candidateUrl)) score -= 0.5;

  // +1.5  → same artist as current track
  if (candidateArtist && normalizeName(candidateArtist) === normalizeName(currentArtist)) score += 1.5;

  // +1.0  → same genre/mood as current track
  if (tagsOverlapAsGenre(currentMoodTags, candidateMoodTags)) score += exploration ? 0.7 : 1.0;

  // +0.5  → popular in this guild historically
  if (dbTrackScores && Number(dbTrackScores.play_count) > 1) score += 0.5;

  // Diversity bonus: prefer artists not yet played this session.
  if (candidateArtist) {
    const hasPlayed = session.playedArtists.has(candidateArtist);
    if (!hasPlayed) score += 0.3;
  }

  // Soft block: deprioritize same artist more than 2 times in a row.
  // We use lastArtistStreak.streak.
  if (candidateArtist && session.lastArtistStreak.lastArtist && normalizeName(session.lastArtistStreak.lastArtist) === normalizeName(candidateArtist)) {
    if (session.lastArtistStreak.streak >= 2) score -= 0.6;
  }

  // Time-of-day awareness (lightweight):
  // Prefer "chill" mood at night.
  if (typeof session.sessionStartAt === "number") {
    const hr = new Date().getHours();
    const isNight = hr >= 20 || hr <= 5;
    const isChill = currentGenreTags.includes("chill");
    if (isNight && isChill) {
      if (candidateMoodTags.includes("chill")) score += 0.4;
    }
  }

  // Exploration mode reduces how much we trust mood matching and increases diversity.
  if (exploration) score += 0.2;

  // Optional explicit block
  if (settings?.block_explicit && isExplicit(`${candidateTrack?.title} ${candidateArtist}`)) {
    score -= 100; // effectively discard
  }

  return { score, candidateMoodTags };
}

function chooseBest(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function shouldExplore(settings) {
  const rate = Number(settings?.exploration_rate ?? 20);
  const p = Math.max(0, Math.min(100, rate)) / 100;
  return Math.random() < p;
}

// Context is injected from `src/index.js` once at startup.
let ctx = {
  client: null,
  player: null,
  logger: null
};

function initRecommendationContext({ client, player, logger }) {
  ctx = { client, player, logger };
}

async function getTopRecommendations(guildId, currentTrack, limit = 10, queueHistory = null) {
  const { client, player, logger } = ctx;
  if (!client || !player) throw new Error("Recommendation engine not initialized");

  const session = sessionMemory.getSession(guildId);
  const settings = await client.db.getAutoplaySettings(guildId);
  // autoplay enabled is handled elsewhere; this just controls scoring.

  const currentArtist = extractArtist(currentTrack);
  const currentMoodTags = getTrackMoodTags(currentTrack);
  const currentGenreTags = currentMoodTags.length ? currentMoodTags : [];

  const exploration = shouldExplore(settings) || settings?.mode === "random";

  const lastMood = getSessionMood(session, 5);
  // If in similar_artist/same_genre modes, we bias mood/artist match.
  const mode = settings?.mode || "smart";

  const preferredSources = settings?.preferred_sources || "both";

  // Candidates from similarTracks (multi-source).
  // Performance: keep the candidate fetch under ~1.7s.
  const similarCandidates = await Promise.race([
    fetchSimilarTracks({
      player,
      currentTrack,
      queueHistory,
      guildId,
      preferredSources
    }),
    new Promise((resolve) => setTimeout(() => resolve([]), 1700))
  ]);

  // Filter out tracks played in last 20 (hard).
  const last20 = new Set(session.recentTracks.slice(0, 20));
  const filtered = similarCandidates.filter((t) => {
    const url = safeTrackUrl(t);
    if (!url) return false;
    if (last20.has(url)) return false;
    if (!t?.title) return false;
    return true;
  });

  // If too few candidates, allow anything except last 10 to avoid stalls.
  const last10 = new Set(session.recentTracks.slice(0, 10));
  const finalPool = filtered.length >= 3 ? filtered : similarCandidates.filter((t) => !last10.has(safeTrackUrl(t)));

  // Mode "random": pick from the allowed pool without heavy scoring.
  if (mode === "random") {
    const shuffled = [...finalPool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, limit);
    return picked.map((track) => ({
      track,
      score: 1.0,
      why: { mode: "random", note: "Selected randomly from diversity-safe pool" }
    }));
  }

  // Bulk fetch historical track_scores
  const urls = finalPool.slice(0, 25).map(safeTrackUrl).filter(Boolean);
  let dbTrackScoresMap = new Map();
  try {
    dbTrackScoresMap = await client.db.getTrackScoresBulk(guildId, urls);
  } catch (e) {
    logger?.warn?.("getTrackScoresBulk failed", { message: e?.message });
  }

  const scored = finalPool.slice(0, 20).map((candidate) => {
    const candidateUrl = safeTrackUrl(candidate);
    const dbTrackScores = dbTrackScoresMap.get(candidateUrl) || null;
    const isSameArtist = normalizeName(extractArtist(candidate)) === normalizeName(currentArtist);
    const moodMatch = tagsOverlapAsGenre(currentMoodTags, getTrackMoodTags(candidate));

    let modeBoost = 0;
    if (mode === "similar_artist" && isSameArtist) modeBoost += 0.8;
    if (mode === "same_genre" && moodMatch) modeBoost += 0.8;
    if (mode === "smart") {
      // Mood 80% of the time, explore 20% handled by exploration boolean above.
      if (lastMood.length && candidate?.title) {
        const candTags = getTrackMoodTags(candidate);
        const ov = moodOverlap([lastMood[0]], candTags);
        if (ov > 0) modeBoost += exploration ? 0.3 : 0.6;
      }
    }

    const { score } = computeScore({
      guildId,
      currentTrack,
      candidateTrack: candidate,
      session,
      currentMoodTags,
      currentArtist,
      currentGenreTags,
      dbTrackScores,
      settings,
      exploration: mode === "random" ? true : exploration
    });

    return {
      track: candidate,
      score: score + modeBoost,
      why: {
        base: score,
        modeBoost
      }
    };
  });

  // Deprioritize blacklisted by skip feedback in session.
  const skipBlacklist = session.skipBlacklist;
  const deprioritized = scored.map((x) => {
    const u = safeTrackUrl(x.track);
    if (u && skipBlacklist.has(u)) return { ...x, score: x.score - 50 };
    return x;
  });

  // Choose top limit
  deprioritized.sort((a, b) => b.score - a.score);
  const best = deprioritized.slice(0, limit);

  return best.map((b) => ({
    track: b.track,
    score: b.score,
    why: b.why
  }));
}

async function getNextAutoplayTrack(guildId, currentTrack, queueHistory = null) {
  const bestMany = await getTopRecommendations(guildId, currentTrack, 10, queueHistory);
  if (!bestMany || bestMany.length === 0) return null;

  const settings = ctx.client ? await ctx.client.db.getAutoplaySettings(guildId).catch(() => null) : null;
  const mode = settings?.mode || "smart";

  const chosenEntry =
    mode === "random"
      ? bestMany[Math.floor(Math.random() * Math.min(bestMany.length, 10))]
      : chooseBest(bestMany);

  if (!chosenEntry?.track) return null;

  const session = sessionMemory.getSession(guildId);
  const chosenUrl = safeTrackUrl(chosenEntry.track);
  const chosenArtist = extractArtist(chosenEntry.track);
  const chosenMoodTags = getTrackMoodTags(chosenEntry.track);
  session.lastAutoplayPrediction = { trackUrl: chosenUrl, predictedAt: Date.now() };
  session.lastAutoplayPrediction.artist = chosenArtist;
  session.lastAutoplayPrediction.moodTags = chosenMoodTags;

  ctx.logger?.info?.("[Autoplay] Next prediction", {
    guildId,
    chosen: chosenUrl,
    score: chosenEntry.score ?? 0,
    why: chosenEntry.why
  });

  return chosenEntry.track;
}

module.exports = {
  initRecommendationContext,
  getNextAutoplayTrack,
  getTopRecommendations
};

