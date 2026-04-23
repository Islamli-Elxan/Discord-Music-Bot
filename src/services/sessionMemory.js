const { getTrackMoodTags } = require("./moodDetection");

class SessionMemory {
  constructor() {
    this.sessions = new Map(); // guildId -> state
  }

  _getOrCreate(guildId) {
    if (!this.sessions.has(guildId)) {
      this.sessions.set(guildId, {
        sessionStartAt: Date.now(),
        recentTracks: [], // last N urls (hard filter window)
        recentArtists: [],
        recentMoodTags: [],
        recentTrackUrlsSet: new Set(), // for fast checks (last 20)
        skipBlacklist: new Map(), // trackUrl -> { until, reason }
        skipWithinFirst30: new Set(), // trackUrl
        recentlyPlayed10: new Set(), // last 10 urls
        lastArtistStreak: { lastArtist: null, streak: 0 },
        playedArtists: new Map(), // artist -> count
        genresThisSession: new Map(), // genre tag -> count
        predictionStats: {
          totalPredictions: 0,
          hits: 0
            },
            lastAutoplayPrediction: null // { trackUrl, predictedAt }
      });
    }
    return this.sessions.get(guildId);
  }

  getSession(guildId) {
    return this._getOrCreate(guildId);
  }

  _capRecent(session, max = 50) {
    if (session.recentTracks.length > max) {
      session.recentTracks = session.recentTracks.slice(0, max);
    }
  }

  isInHardWindow(guildId, trackUrl, windowSize = 20) {
    const session = this._getOrCreate(guildId);
    // Ensure recentTracks is in sync; recentTrackUrlsSet only reflects last 20.
    const inWindow = session.recentTracks.slice(0, windowSize).includes(trackUrl);
    return !!inWindow;
  }

  markCandidatePlayed(guildId, track) {
    const session = this._getOrCreate(guildId);
    const url = track?.url || track?.id || track?.title;
    if (!url) return;

    // Update hard window list (most recent first).
    session.recentTracks.unshift(url);
    const maxSet = 20;
    session.recentTracks = session.recentTracks.slice(0, maxSet);

    // Maintain sets for quick checks.
    session.recentTrackUrlsSet.clear();
    for (const u of session.recentTracks) session.recentTrackUrlsSet.add(u);

    // Last 10 tracks for deprioritization.
    session.recentlyPlayed10.clear();
    for (const u of session.recentTracks.slice(0, 10)) session.recentlyPlayed10.add(u);

    const artist = track?.author || track?.artist || "";
    if (artist) {
      session.recentArtists.unshift(artist);
      session.recentArtists = session.recentArtists.slice(0, 10);
      session.playedArtists.set(artist, (session.playedArtists.get(artist) || 0) + 1);

      if (session.lastArtistStreak.lastArtist === artist) session.lastArtistStreak.streak++;
      else session.lastArtistStreak = { lastArtist: artist, streak: 1 };
    }

    const moodTags = getTrackMoodTags(track);
    session.recentMoodTags.unshift(moodTags);
    session.recentMoodTags = session.recentMoodTags.slice(0, 10);

    // Genre tag marker: first mood tag.
    const genre = moodTags[0] || null;
    if (genre) session.genresThisSession.set(genre, (session.genresThisSession.get(genre) || 0) + 1);
  }

  blacklistedForSkip(trackUrl, guildId) {
    if (!trackUrl) return false;
    const session = this._getOrCreate(guildId);
    const entry = session.skipBlacklist.get(trackUrl);
    if (!entry) return false;
    if (Date.now() > entry.until) {
      session.skipBlacklist.delete(trackUrl);
      return false;
    }
    return true;
  }

  addSkipToBlacklist(guildId, trackUrl, seconds = 60) {
    if (!trackUrl) return;
    const session = this._getOrCreate(guildId);
    session.skipBlacklist.set(trackUrl, { until: Date.now() + seconds * 1000, reason: "skipped" });
  }

  markSkipWithinFirst30(guildId, trackUrl) {
    if (!trackUrl) return;
    const session = this._getOrCreate(guildId);
    session.skipWithinFirst30.add(trackUrl);
  }

  markSkipAfter50Percent(guildId, trackUrl) {
    // We keep it simple: in scoring we can check listen_history too,
    // but a session marker is enough for our heuristic.
    // For now, store it as blacklist for a shorter window.
    this.addSkipToBlacklist(guildId, trackUrl, 90);
  }

  updatePredictionOutcome(guildId, isHit) {
    const session = this._getOrCreate(guildId);
    session.predictionStats.totalPredictions += 1;
    if (isHit) session.predictionStats.hits += 1;
  }

  getPredictionAccuracy(guildId) {
    const session = this._getOrCreate(guildId);
    const total = session.predictionStats.totalPredictions || 0;
    const hits = session.predictionStats.hits || 0;
    return { total, hits, accuracy: total ? hits / total : 0 };
  }

  getTopGenresThisSession(guildId, limit = 5) {
    const session = this._getOrCreate(guildId);
    return Array.from(session.genresThisSession.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([genre, count]) => ({ genre, count }));
  }
}

module.exports = new SessionMemory();

