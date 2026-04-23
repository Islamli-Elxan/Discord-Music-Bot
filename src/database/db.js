const path = require("node:path");
const sqlite3 = require("sqlite3");

class Database {
  constructor(logger) {
    this.logger = logger;
    const dbPath = path.join(process.cwd(), "data.db");
    this.db = new sqlite3.Database(dbPath);
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(
          "CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY, volume INTEGER, loop_mode TEXT, autoplay INTEGER, stay_247 INTEGER, dj_role_id TEXT)",
          (err) => {
            if (err) return reject(err);
          }
        );

        this.db.run(
          "CREATE TABLE IF NOT EXISTS playlists (guild_id TEXT, name TEXT, tracks TEXT, PRIMARY KEY (guild_id, name))",
          (err) => {
            if (err) return reject(err);
          }
        );

        // Per-guild EQ preset selection for the audio pipeline.
        this.db.run(
          "CREATE TABLE IF NOT EXISTS eq_settings (guild_id TEXT PRIMARY KEY, preset TEXT)",
          (err) => {
            if (err) return reject(err);
          }
        );

        // Per-track loudness metadata (EBU R128) for stable volume leveling.
        // Gain stored as loudnorm `target_offset` (in dB).
        this.db.run(
          `CREATE TABLE IF NOT EXISTS track_loudness_gain (
            track_key TEXT PRIMARY KEY,
            measured_I REAL,
            measured_TP REAL,
            measured_LRA REAL,
            measured_thresh REAL,
            target_offset REAL,
            gain_db REAL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )`,
          (err) => {
            if (err) return reject(err);
          }
        );

        // ==============================
        // Smart Autoplay: listening + scoring
        // ==============================
        this.db.run(
          `CREATE TABLE IF NOT EXISTS listen_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT,
            track_url TEXT NOT NULL,
            track_title TEXT,
            track_artist TEXT,
            track_genre TEXT,
            listened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            listen_duration INTEGER,
            completed BOOLEAN DEFAULT 0
          )`,
          (err) => {
            if (err) return reject(err);
          }
        );

        this.db.run(
          `CREATE TABLE IF NOT EXISTS track_scores (
            guild_id TEXT NOT NULL,
            track_url TEXT NOT NULL,
            score REAL DEFAULT 1.0,
            play_count INTEGER DEFAULT 0,
            skip_count INTEGER DEFAULT 0,
            last_played DATETIME,
            PRIMARY KEY (guild_id, track_url)
          )`,
          (err) => {
            if (err) return reject(err);
          }
        );

        // Smart autoplay tuning (mode/exploration/source preferences).
        this.db.run(
          `CREATE TABLE IF NOT EXISTS autoplay_settings (
            guild_id TEXT PRIMARY KEY,
            mode TEXT DEFAULT 'smart',
            exploration_rate INTEGER DEFAULT 20,
            block_explicit INTEGER DEFAULT 1,
            preferred_sources TEXT DEFAULT 'both'
          )`,
          (err) => {
            if (err) return reject(err);
          }
        );

        resolve();
      });
    });
  }

  getGuildSettings(guildId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT guild_id, volume, loop_mode, autoplay, stay_247, dj_role_id FROM guild_settings WHERE guild_id = ?",
        [guildId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  upsertGuildSettings(guildId, data) {
    const payload = {
      volume: data.volume ?? null,
      loop_mode: data.loop_mode ?? null,
      autoplay: data.autoplay ?? null,
      stay_247: data.stay_247 ?? null,
      dj_role_id: data.dj_role_id ?? null
    };
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO guild_settings (guild_id, volume, loop_mode, autoplay, stay_247, dj_role_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET volume=excluded.volume, loop_mode=excluded.loop_mode, autoplay=excluded.autoplay, stay_247=excluded.stay_247, dj_role_id=excluded.dj_role_id",
        [
          guildId,
          payload.volume,
          payload.loop_mode,
          payload.autoplay,
          payload.stay_247,
          payload.dj_role_id
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  savePlaylist(guildId, name, tracks) {
    const serialized = JSON.stringify(tracks);
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO playlists (guild_id, name, tracks) VALUES (?, ?, ?) ON CONFLICT(guild_id, name) DO UPDATE SET tracks=excluded.tracks",
        [guildId, name, serialized],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  getPlaylist(guildId, name) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT tracks FROM playlists WHERE guild_id = ? AND name = ?",
        [guildId, name],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          try {
            resolve(JSON.parse(row.tracks));
          } catch (parseError) {
            this.logger.warn("Failed to parse playlist", { guildId, name });
            resolve(null);
          }
        }
      );
    });
  }

  listPlaylists(guildId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT name FROM playlists WHERE guild_id = ? ORDER BY name ASC",
        [guildId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map((r) => r.name));
        }
      );
    });
  }

  // ==============================
  // Smart Autoplay: DB helpers
  // ==============================

  getAutoplaySettings(guildId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT mode, exploration_rate, block_explicit, preferred_sources FROM autoplay_settings WHERE guild_id = ?",
        [guildId],
        (err, row) => {
          if (err) return reject(err);
          resolve(
            row || {
              mode: "smart",
              exploration_rate: 20,
              block_explicit: 1,
              preferred_sources: "both"
            }
          );
        }
      );
    });
  }

  upsertAutoplaySettings(guildId, patch) {
    const mode = patch?.mode ?? "smart";
    const exploration_rate = patch?.exploration_rate ?? 20;
    const block_explicit = patch?.block_explicit ?? 1;
    const preferred_sources = patch?.preferred_sources ?? "both";

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO autoplay_settings (guild_id, mode, exploration_rate, block_explicit, preferred_sources)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET
           mode=excluded.mode,
           exploration_rate=excluded.exploration_rate,
           block_explicit=excluded.block_explicit,
           preferred_sources=excluded.preferred_sources`,
        [guildId, mode, exploration_rate, block_explicit, preferred_sources],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  addListenHistory({ guildId, userId, trackUrl, trackTitle, trackArtist, trackGenre, listenDuration, completed }) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO listen_history
          (guild_id, user_id, track_url, track_title, track_artist, track_genre, listen_duration, completed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, userId ?? null, trackUrl, trackTitle ?? null, trackArtist ?? null, trackGenre ?? null, listenDuration ?? 0, completed ? 1 : 0],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  upsertTrackPlay({ guildId, trackUrl }) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO track_scores (guild_id, track_url, score, play_count, skip_count, last_played)
         VALUES (?, ?, 1.0, 1, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(guild_id, track_url) DO UPDATE SET
           play_count=play_count+1,
           last_played=CURRENT_TIMESTAMP`,
        [guildId, trackUrl],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  updateTrackOnSkip({ guildId, trackUrl, deltaScore = 0, deltaSkip = 1 }) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO track_scores (guild_id, track_url, score, play_count, skip_count, last_played)
         VALUES (?, ?, 1.0, 0, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(guild_id, track_url) DO UPDATE SET
           skip_count=skip_count+?,
           score=score+?,
           last_played=CURRENT_TIMESTAMP`,
        [guildId, trackUrl, deltaSkip, deltaSkip, deltaScore],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  updateTrackOnComplete({ guildId, trackUrl, deltaScore = 2 }) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE track_scores
           SET score=score+?,
               last_played=CURRENT_TIMESTAMP
         WHERE guild_id = ? AND track_url = ?`,
        [deltaScore, guildId, trackUrl],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  applyTrackFeedback({ guildId, trackUrl, deltaScore, addSkipCount = 0 }) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO track_scores (guild_id, track_url, score, play_count, skip_count, last_played)
         VALUES (?, ?, 1.0, 0, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(guild_id, track_url) DO UPDATE SET
           score=score+?,
           skip_count=skip_count+?,
           last_played=CURRENT_TIMESTAMP`,
        [guildId, trackUrl, addSkipCount, deltaScore, addSkipCount],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async getTrackScoresBulk(guildId, trackUrls) {
    if (!Array.isArray(trackUrls) || trackUrls.length === 0) return new Map();
    const urls = trackUrls.filter(Boolean);
    if (urls.length === 0) return new Map();

    const placeholders = urls.map(() => "?").join(",");
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT track_url, score, play_count, skip_count, last_played
           FROM track_scores
          WHERE guild_id = ? AND track_url IN (${placeholders})`,
        [guildId, ...urls],
        (err, rows) => {
          if (err) return reject(err);
          const map = new Map();
          (rows || []).forEach((r) => {
            map.set(r.track_url, r);
          });
          resolve(map);
        }
      );
    });
  }

  getEqPreset(guildId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT preset FROM eq_settings WHERE guild_id = ?",
        [guildId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row?.preset || null);
        }
      );
    });
  }

  upsertEqPreset(guildId, preset) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO eq_settings (guild_id, preset) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET preset=excluded.preset",
        [guildId, preset],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async upsertTrackLoudnessGain(trackKey, meta) {
    const payload = {
      measured_I: meta?.measured_I ?? null,
      measured_TP: meta?.measured_TP ?? null,
      measured_LRA: meta?.measured_LRA ?? null,
      measured_thresh: meta?.measured_thresh ?? null,
      target_offset: meta?.target_offset ?? null,
      gain_db: meta?.gain_db ?? null
    };

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO track_loudness_gain 
          (track_key, measured_I, measured_TP, measured_LRA, measured_thresh, target_offset, gain_db, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(track_key) DO UPDATE SET
           measured_I=excluded.measured_I,
           measured_TP=excluded.measured_TP,
           measured_LRA=excluded.measured_LRA,
           measured_thresh=excluded.measured_thresh,
           target_offset=excluded.target_offset,
           gain_db=excluded.gain_db,
           updated_at=CURRENT_TIMESTAMP`,
        [
          trackKey,
          payload.measured_I,
          payload.measured_TP,
          payload.measured_LRA,
          payload.measured_thresh,
          payload.target_offset,
          payload.gain_db
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  getTrackLoudnessGain(trackKey) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT track_key, measured_I, measured_TP, measured_LRA, measured_thresh, target_offset, gain_db FROM track_loudness_gain WHERE track_key = ?",
        [trackKey],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  // ==============================
  // Analytics (smart autoplay + listening history)
  // ==============================

  getAnalyticsSummary(guildId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT
          COUNT(*) AS totalTracks,
          COALESCE(SUM(listen_duration), 0) AS totalListenSeconds,
          SUM(CASE WHEN date(listened_at) = date('now') THEN 1 ELSE 0 END) AS tracksToday
        FROM listen_history
        WHERE guild_id = ?
        `,
        [guildId],
        (err, row) => {
          if (err) return reject(err);
          const totalTracks = Number(row?.totalTracks || 0);
          const totalListenSeconds = Number(row?.totalListenSeconds || 0);
          const tracksToday = Number(row?.tracksToday || 0);
          const hoursListened = totalListenSeconds / 3600;

          const topListenerQuery = `
            SELECT user_id, COUNT(*) AS tracks, COALESCE(SUM(listen_duration), 0) AS seconds
              FROM listen_history
             WHERE guild_id = ? AND user_id IS NOT NULL
             GROUP BY user_id
             ORDER BY seconds DESC
             LIMIT 1
          `;

          const favGenreQuery = `
            SELECT track_genre AS genre, COUNT(*) AS count
              FROM listen_history
             WHERE guild_id = ? AND track_genre IS NOT NULL
             GROUP BY track_genre
             ORDER BY count DESC
             LIMIT 1
          `;

          this.db.get(topListenerQuery, [guildId], (err2, listenerRow) => {
            if (err2) return reject(err2);
            this.db.get(favGenreQuery, [guildId], (err3, genreRow) => {
              if (err3) return reject(err3);
              const topListener = listenerRow
                ? {
                    userId: listenerRow.user_id,
                    tracks: Number(listenerRow.tracks || 0),
                    hours: Number(listenerRow.seconds || 0) / 3600
                  }
                : null;
              const favGenre = genreRow
                ? { genre: genreRow.genre, count: Number(genreRow.count || 0) }
                : null;

              resolve({
                totalTracks,
                tracksToday,
                hoursListened,
                topListener,
                favGenre
              });
            });
          });
        }
      );
    });
  }

  getAnalyticsDaily(guildId, days = 7) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT
          date(listened_at) AS day,
          COUNT(*) AS tracks
        FROM listen_history
        WHERE guild_id = ?
          AND listened_at >= datetime('now', ?)
        GROUP BY day
        ORDER BY day ASC
        `,
        [guildId, `-${Math.max(1, Number(days) || 7)} days`],
        (err, rows) => {
          if (err) return reject(err);

          const counts = new Map();
          (rows || []).forEach((r) => {
            counts.set(r.day, Number(r.tracks || 0));
          });

          // Fill missing days.
          const out = [];
          const now = new Date();
          for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const dayStr = d.toISOString().slice(0, 10);
            out.push({
              day: dayStr.slice(5).replace("-", "/"),
              tracks: counts.get(dayStr) || 0
            });
          }
          resolve({ dailySeries: out });
        }
      );
    });
  }

  getAnalyticsTopTracks(guildId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT
          track_url,
          COALESCE(MAX(track_title), '') AS title,
          COALESCE(MAX(track_artist), '') AS artist,
          COUNT(*) AS playCount
        FROM listen_history
        WHERE guild_id = ?
        GROUP BY track_url
        ORDER BY playCount DESC
        LIMIT ?
        `,
        [guildId, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve({
            tracks: (rows || []).map((r, idx) => ({
              rank: idx + 1,
              url: r.track_url,
              title: r.title,
              artist: r.artist,
              playCount: Number(r.playCount || 0)
            }))
          });
        }
      );
    });
  }

  getAnalyticsTopListeners(guildId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT
          user_id,
          COUNT(*) AS tracks,
          COALESCE(SUM(listen_duration), 0) AS seconds
        FROM listen_history
        WHERE guild_id = ? AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY seconds DESC
        LIMIT ?
        `,
        [guildId, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve({
            listeners: (rows || []).map((r, idx) => ({
              rank: idx + 1,
              userId: r.user_id,
              tracks: Number(r.tracks || 0),
              hours: Number(r.seconds || 0) / 3600
            }))
          });
        }
      );
    });
  }

  getAnalyticsGenres(guildId, limit = 8) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT track_genre AS genre, COUNT(*) AS count
        FROM listen_history
        WHERE guild_id = ? AND track_genre IS NOT NULL
        GROUP BY track_genre
        ORDER BY count DESC
        LIMIT ?
        `,
        [guildId, limit],
        (err, rows) => {
          if (err) return reject(err);
          const total = (rows || []).reduce((acc, r) => acc + Number(r.count || 0), 0) || 1;
          resolve({
            genres: (rows || []).map((r) => ({
              genre: r.genre,
              count: Number(r.count || 0),
              percent: Number(r.count || 0) / total
            }))
          });
        }
      );
    });
  }

  getAnalyticsHeatmap(guildId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT
          CAST(strftime('%w', listened_at) AS INTEGER) AS dow,
          CAST(strftime('%H', listened_at) AS INTEGER) AS hour,
          COUNT(*) AS count
        FROM listen_history
        WHERE guild_id = ?
        GROUP BY dow, hour
        `,
        [guildId],
        (err, rows) => {
          if (err) return reject(err);
          const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
          (rows || []).forEach((r) => {
            const dow = Number(r.dow);
            const hour = Number(r.hour);
            if (Number.isNaN(dow) || Number.isNaN(hour)) return;
            if (dow < 0 || dow > 6 || hour < 0 || hour > 23) return;
            grid[dow][hour] = Number(r.count || 0);
          });
          resolve({ heatmap: grid });
        }
      );
    });
  }
}

module.exports = { Database };
