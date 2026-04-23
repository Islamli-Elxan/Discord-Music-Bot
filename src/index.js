const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { PassThrough } = require("stream");
const YTDlpWrap = require("yt-dlp-wrap").default;

const ffmpegStatic = require("ffmpeg-static");
if (ffmpegStatic && typeof ffmpegStatic === "string") {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

const { onBeforeCreateStream } = require("discord-player");

const {
  buildFullFfmpegFilters,
  getOrAnalyzeTrackLoudnormMeta,
  getYtDlpFormatForQualityAttempt,
  getOpusBitrateForQualityAttempt,
  isDirectAudioUrl
} = require("./music/audioProcessing");

const ytDlpBinaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpBinaryPath = path.join(__dirname, ytDlpBinaryName);

let globalCookiePath = "";
const cookieNames = ["youtube-cookies.txt", "cookies.txt"];
for (const name of cookieNames) {
  const rootP = path.join(process.cwd(), name);
  const srcP = path.join(__dirname, name);
  if (fs.existsSync(rootP)) { globalCookiePath = rootP; break; }
  if (fs.existsSync(srcP)) { globalCookiePath = srcP; break; }
}

let dbInstance = null;
let loggerInstance = null;

onBeforeCreateStream(async (track, source, _queue) => {
  try {
    if (!fs.existsSync(ytDlpBinaryPath)) {
      console.log("[yt-dlp] Binary not found. Downloading latest version...");
      await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
      console.log("[yt-dlp] Download complete.");
    }

    const url = track?.url || "";
    let input = url;
    const title = track?.title || "Unknown";
    const author = track?.author || "";

    // Choose yt-dlp input:
    // - YouTube links => direct
    // - Direct audio URLs (mp3/webm/ogg/etc) => direct
    // - Everything else (Spotify, SoundCloud, etc) => YouTube search bridge
    const isYouTube =
      typeof url === "string" && (url.includes("youtube.com") || url.includes("youtu.be"));
    if (!isYouTube && !isDirectAudioUrl(url)) {
      input = `ytsearch1:${title} ${author}`.trim();
      console.log(`[Stream] Bridging: "${title}" -> YouTube Search`);
    } else {
      console.log(`[Stream] Direct input: ${url}`);
    }

    const qualityAttempt = track?.metadata?.qualityAttempt ?? 0;
    const format = getYtDlpFormatForQualityAttempt(qualityAttempt);

    const args = [
      input,
      "-f",
      format,
      "--no-playlist",
      "--force-ipv4",
      "--retries",
      "5",
      "--socket-timeout",
      "30",
      "-o",
      "-"
    ];

    if (globalCookiePath && fs.existsSync(globalCookiePath)) {
      args.push("--cookies", globalCookiePath);
    }

    const child = spawn(ytDlpBinaryPath, args);

    const stream = new PassThrough({ highWaterMark: 1 << 24 });
    child.stdout.pipe(stream);

    const killChild = () => {
      try {
        if (child.exitCode === null) child.kill("SIGTERM");
      } catch (_) {}
    };
    stream.once("close", killChild);
    stream.once("end", killChild);
    stream.once("error", killChild);

    child.stderr.on("data", (data) => {
      const msg = data.toString();
      if (msg.toLowerCase().includes("error")) {
        console.error(`[yt-dlp Error] ${msg}`);
      }
    });

    child.on("close", (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(
          `[Stream] yt-dlp exited abnormally | code=${code} | signal=${signal || "none"} | track="${track?.title || "unknown"}"`
        );
      }
    });

    // Audio processing pipeline:
    // - Loudness normalization (EBU R128 via loudnorm)
    // - EQ defaults + selected `/eq` preset
    // - Optional echo depth when `/filter echo` is enabled
    // - Sub-bass cut + sample-rate normalization
    if (_queue?.filters?.ffmpeg?.setFilters && dbInstance && track) {
      try {
        const guildId = _queue?.guild?.id;
        const eqPresetName = _queue?.metadata?.eqPreset || (guildId ? await dbInstance.getEqPreset(guildId) : null) || "flat";
        const userFilterNames = _queue?.metadata?.filters || new Set();

        const loudnormMeta = await getOrAnalyzeTrackLoudnormMeta({
          db: dbInstance,
          track,
          input,
          format,
          ytdlpPath: ytDlpBinaryPath,
          cookiePath:
            globalCookiePath && fs.existsSync(globalCookiePath) ? globalCookiePath : null,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          timeoutMs: 4500,
          maxSeconds: 25
        });

        const filters = buildFullFfmpegFilters({
          userFilterNames,
          eqPresetName,
          loudnormMeta
        });

        await _queue.filters.ffmpeg.setFilters(filters);
      } catch (e) {
        loggerInstance?.warn?.("Audio pipeline setup failed; continuing with base defaults.", {
          message: e?.message
        });
      }
    }

    // Force Opus bitrate based on quality attempt tier.
    // This affects the Opus encoder in discord-player/discord-voip.
    if (_queue?.node?.setBitrate) {
      try {
        const bitrate = getOpusBitrateForQualityAttempt(qualityAttempt);
        _queue.node.setBitrate(bitrate);
      } catch (_) {}
    }

    // Minimal wait so FFmpeg gets stream quickly (long wait = voice timeout / AbortError). Do not consume data.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 5000);
      const onReadable = () => {
        clearTimeout(timeout);
        stream.removeListener("readable", onReadable);
        stream.removeListener("error", onError);
        resolve();
      };
      const onError = (err) => {
        clearTimeout(timeout);
        stream.removeListener("readable", onReadable);
        reject(err);
      };
      stream.once("readable", onReadable);
      stream.once("error", onError);
      if (stream.readableLength > 0) {
        clearTimeout(timeout);
        stream.removeListener("readable", onReadable);
        stream.removeListener("error", onError);
        return resolve();
      }
    });

    return stream;
  } catch (error) {
    console.error("[Stream] Critical Error:", error);
    return null;
  }
});

const { createClient } = require("./core/client");
const { loadCommands, loadEvents } = require("./core/loader");
const { createPlayer } = require("./music/player");
const { QueryType } = require("discord-player");
const { clearVotes } = require("./music/votes");
const { incrementRetry, clearRetry } = require("./music/retry");
const { getSettings } = require("./systems/settings");
const { Database } = require("./database/db");
const { Cache } = require("./systems/cache");
const { setupAntiCrash } = require("./systems/antiCrash");
const { Logger } = require("./utils/logger");
const { suppressYoutubeiParserWarnings } = require("./utils/suppressYoutubeiWarnings");
const config = require("./config/config");
const { createDashboard } = require("../server.js");
const dashboardBridge = require("../dashboard-bridge");

const recommendationEngine = require("./services/recommendationEngine");
const sessionMemory = require("./services/sessionMemory");
const { getTrackMoodTags, pickGenreFromMoodTags } = require("./services/moodDetection");

suppressYoutubeiParserWarnings();

async function bootstrap() {
  const logger = new Logger(config.logLevel);
  const client = createClient();

  try {
    const mediaplex = require("mediaplex");
    if (mediaplex && typeof mediaplex.OpusEncoder === "function") {
      logger.info("Opus encoder available (mediaplex)");
    } else {
      throw new Error("mediaplex.OpusEncoder not found");
    }
  } catch (e) {
    try {
      const opus = require("@discordjs/opus");
      if (opus && typeof opus.OpusEncoder === "function") {
        logger.info("Opus encoder available (@discordjs/opus)");
      } else {
        throw new Error("@discordjs/opus.OpusEncoder not found");
      }
    } catch (e2) {
      logger.warn("Opus module not loaded - voice playback may crash. Install mediaplex or @discordjs/opus.");
    }
  }

  client.config = config;
  client.logger = logger;
  client.cache = new Cache();
  client.db = new Database(logger);
  dbInstance = client.db;
  loggerInstance = logger;

  // Resolve cookie path: env var, then root, then src (youtube-cookies.txt or cookies.txt)
  const cookieFilenames = ["youtube-cookies.txt", "cookies.txt"];
  let cookiePath = "";
  const envPath = config.youtubeCookiesPath
    ? path.isAbsolute(config.youtubeCookiesPath)
      ? config.youtubeCookiesPath
      : path.join(process.cwd(), config.youtubeCookiesPath)
    : "";
  if (envPath && fs.existsSync(envPath)) {
    cookiePath = envPath;
    console.log(`[Cookies] Found file at ENV path: ${cookiePath}`);
    globalCookiePath = envPath; // keep yt-dlp (--cookies) in sync with env-provided path
  } else {
    for (const name of cookieFilenames) {
      const rootPath = path.join(process.cwd(), name);
      const srcPath = path.join(__dirname, name);
      if (fs.existsSync(rootPath)) {
        cookiePath = rootPath;
        console.log(`[Cookies] Found file at ROOT: ${rootPath}`);
        globalCookiePath = rootPath;
        break;
      }
      if (fs.existsSync(srcPath)) {
        cookiePath = srcPath;
        console.log(`[Cookies] Found file at SRC: ${srcPath}`);
        globalCookiePath = srcPath;
        break;
      }
    }
    if (!cookiePath) {
      console.warn(
        `[Cookies] ⚠️ Cookie file NOT FOUND. Checked: ${process.cwd()} and ${__dirname} for youtube-cookies.txt, cookies.txt`
      );
    }
  }
  client.config.youtubeCookiesPath = cookiePath || config.youtubeCookiesPath;

  client.player = await createPlayer(client, logger);
  client.player.events.on("debug", (queue, message) => console.log(`[DEBUG] ${message}`));

  recommendationEngine.initRecommendationContext({
    client,
    player: client.player,
    logger
  });

  if (typeof client.player.scanDeps === "function") {
    const deps = client.player.scanDeps();
    logger.info("Player dependencies", { report: deps?.replace(/\n/g, " | ") || "N/A" });
  }

  setupAntiCrash(logger);
  await client.db.init();

  // Load all bot modules before login
  loadEvents(client, `${__dirname}/events`);
  await loadCommands(client, `${__dirname}/commands`, config, logger);

  client.once("clientReady", async () => {
    const commands = client._slashCommandsJSON || [];
    await client.application.commands.set(commands);
    if (process.env.GUILD_ID) {
      await client.application.commands.set([], process.env.GUILD_ID);
    }
    console.log(
      "[INFO] ✅ Registered Global commands. 🗑️ Deleted old Guild-specific commands to fix duplicates."
    );
  });

  const reconnect = async (queue) => {
    const settings = await getSettings(client, queue.guild.id);
    const isLikelyPlaying = !!(queue?.node?.isPlaying?.() || queue?.node?.isPaused?.());
    // Reconnect when:
    // - user explicitly enabled `stay_247`, OR
    // - we were actively playing (stream dropped mid-song).
    if (!settings.stay_247 && !isLikelyPlaying) return;

    const now = Date.now();
    if (queue?.metadata) {
      const last = queue.metadata._lastReconnectAt || 0;
      if (now - last < 5000) return; // prevent reconnect storms
      queue.metadata._lastReconnectAt = now;
    }
    const channelId = queue.metadata?.lastChannelId;
    if (!channelId) return;
    const channel = queue.guild.channels.cache.get(channelId);
    if (!channel) return;
    try {
      await queue.connect(channel);
    } catch (error) {
      logger.warn("Reconnect failed", { guildId: queue.guild.id, message: error.message });
    }
  };

  const retryTrack = async (queue, track) => {
    if (!track) return false;
    const attempts = incrementRetry(queue.guild.id, track);
    // Quality tiers:
    // - initial attempt uses `attempt=0` (high)
    // - first retry => `attempt=1` (medium)
    // - second retry => `attempt=2` (low)
    if (attempts > 2) return false;
    try {
      const nextQualityAttempt = Math.min(attempts, 2);
      if (!track.metadata) track.metadata = {};
      track.metadata.qualityAttempt = nextQualityAttempt;

      if (typeof queue.insertTrack === "function") {
        queue.insertTrack(track, 0);
      } else if (queue.tracks && typeof queue.tracks.add === "function") {
        queue.tracks.add(track, 0);
      } else {
        queue.addTrack(track);
      }
      queue.node.skip();
      return true;
    } catch (error) {
      logger.warn("Retry failed", { guildId: queue.guild.id, message: error.message });
      return false;
    }
  };

  /** Keyword ban list for smart autoplay. */
  const AUTOPLAY_BANNED_KEYWORDS = ["karaoke", "lyrics", "sözləri", "remix", "slowed", "reverb", "instrumental"];
  /** Max duration for autoplay (7 minutes) — eliminates compilations, podcasts, etc. */
  const AUTOPLAY_MAX_DURATION_MS = 7 * 60 * 1000;

  /**
   * Extract the real artist name from a track title like "Artist - Song Title".
   * Splits on " - ", " | ", or " — " and takes the first segment.
   * Falls back to track.author if no separator is found.
   */
  const extractArtistFromTrack = (track) => {
    const title = (track.title || "").trim();
    const separators = [" - ", " — ", " | ", " – "];
    for (const sep of separators) {
      const idx = title.indexOf(sep);
      if (idx > 0) {
        const part = title.slice(0, idx).trim();
        if (part.length >= 2) return part;
      }
    }
    return (track.author || "").trim();
  };

  /**
   * Build keyword tokens from a string for relevance matching.
   * Returns lowercase words with 3+ characters, stripping punctuation.
   */
  const tokenize = (str) =>
    (str || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 3);

  /**
   * Custom smart autoplay: use getRelatedTracks(), then fallback to artist-name search.
   * Strictly filters history, duration, banned keywords, and relevance to the current artist.
   */
  const fetchNextSmartAutoplayTrack = async (queue, currentTrack) => {
    if (!currentTrack || !queue?.player) return null;
    const guildId = queue.guild.id;

    // --- History guard ---
    const recentHistory = dashboardBridge.getHistory(guildId, 15);
    const recentUrls = new Set((recentHistory || []).map((h) => (h.url || "").trim()).filter(Boolean));
    const recentTitles = new Set(
      (recentHistory || []).map((h) => (h.title || "").replace(/[\(\[].*?[\)\]]/g, "").trim().toLowerCase()).filter(Boolean)
    );
    const isRecentlyPlayed = (t) => {
      const url = (t.url || "").trim();
      const title = (t.title || "").replace(/[\(\[].*?[\)\]]/g, "").trim().toLowerCase();
      if (recentUrls.has(url)) return true;
      if (recentTitles.has(title)) return true;
      return false;
    };

    // --- Base filters ---
    const hasBannedKeyword = (t) => {
      const raw = `${(t.title || "").toLowerCase()} ${(t.author || "").toLowerCase()}`;
      return AUTOPLAY_BANNED_KEYWORDS.some((kw) => raw.includes(kw));
    };
    const durationOk = (t) => {
      const d = t.durationMS || 0;
      return d >= 30000 && d <= AUTOPLAY_MAX_DURATION_MS;
    };
    const currentTitle = (currentTrack.title || "").replace(/[\(\[].*?[\)\]]/g, "").trim().toLowerCase();
    const baseFilter = (t) => {
      if (hasBannedKeyword(t)) return false;
      if (isRecentlyPlayed(t)) return false;
      if (!durationOk(t)) return false;
      const candidate = (t.title || "").replace(/[\(\[].*?[\)\]]/g, "").trim().toLowerCase();
      if (candidate === currentTitle) return false;
      return true;
    };

    // --- Artist relevance filter (strict) ---
    // Extract the real artist from the title (e.g. "Şebnem Ferah" from "Şebnem Ferah - Sigara")
    const realArtist = extractArtistFromTrack(currentTrack);
    const artistTokens = tokenize(realArtist);

    const isArtistRelevant = (t) => {
      if (artistTokens.length === 0) return true; // no tokens to check, allow
      const haystack = `${(t.title || "").toLowerCase()} ${(t.author || "").toLowerCase()}`;
      // At least one token from the real artist name must appear in the candidate's title or author
      return artistTokens.some((tok) => haystack.includes(tok));
    };

    const strictFilter = (t) => baseFilter(t) && isArtistRelevant(t);
    // Loose filter used only as last resort (no relevance check, but still base rules)
    const looseFilter = (t) => baseFilter(t);

    let pool = [];

    // 1. Try extractor's getRelatedTracks (best quality — algorithmic)
    try {
      const related = await currentTrack.extractor?.getRelatedTracks?.(currentTrack, queue.history);
      const relatedTracks = related?.tracks;
      if (Array.isArray(relatedTracks) && relatedTracks.length > 0) {
        pool = relatedTracks.filter(strictFilter);
        // If nothing passes strict, allow any base-filtered related track
        if (pool.length === 0) pool = relatedTracks.filter(looseFilter);
      }
    } catch (_) { }

    // 2. Try all extractors via run()
    if (pool.length === 0 && queue.player.extractors?.run) {
      try {
        const runResult = await queue.player.extractors.run(async (ext) => {
          const res = await ext.getRelatedTracks(currentTrack, queue.history);
          return res?.tracks?.length ? res.tracks : false;
        });
        const runTracks = runResult?.result;
        if (Array.isArray(runTracks) && runTracks.length > 0) {
          pool = runTracks.filter(strictFilter);
          if (pool.length === 0) pool = runTracks.filter(looseFilter);
        }
      } catch (_) { }
    }

    // 3. Fallback: YouTube search using the REAL artist name extracted from the title
    if (pool.length === 0) {
      if (!realArtist) return null;
      const queries = [
        `${realArtist} official audio`,
        `${realArtist} mix`
      ];
      for (const fallbackQuery of queries) {
        if (pool.length >= 3) break;
        try {
          const searchResult = await queue.player.search(fallbackQuery, {
            requestedBy: currentTrack.requestedBy || null,
            searchEngine: QueryType.YOUTUBE_SEARCH
          });
          if (searchResult?.tracks?.length) {
            const strict = searchResult.tracks.filter(strictFilter);
            pool = [...pool, ...strict];
          }
        } catch (_) { }
      }
    }

    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * Math.min(5, pool.length))];
  };

  client.player.events.on("error", (queue, error) => {
    logger.error("Player error", {
      guildId: queue?.guild?.id,
      message: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack
    });
  });

  client.player.events.on("playerError", async (queue, error, track) => {
    logger.error("Player track error (stream may have aborted)", {
      guildId: queue?.guild?.id,
      message: error?.message,
      name: error?.name,
      code: error?.code,
      trackTitle: track?.title,
      trackUrl: track?.url,
      stack: error?.stack
    });
    console.log("[playerError] FULL ERROR (why stream aborted):", error);
    if (error?.stack) console.log("[playerError] STACK:", error.stack);
    const channelId = queue.metadata?.textChannelId;
    if (channelId) {
      const ch = queue.guild.channels.cache.get(channelId);
      if (ch?.send) {
        ch.send({
          embeds: [
            {
              color: 0xe74c3c,
              title: "Playback Error",
              description: `**${track?.title || "Track"}** could not be played (stream extraction failed). Skipping to next. Try a different link or search.`
            }
          ]
        }).catch(() => { });
      }
    }
    try {
      // If the stream dropped mid-song, attempt to reconnect before retrying.
      await reconnect(queue);
    } catch (_) {}

    const retried = await retryTrack(queue, track);
    if (!retried) {
      try {
        queue.node.skip();
        if (!queue.node.isPlaying()) await queue.node.play();
      } catch (_) { }
    }
  });

  client.player.events.on("connectionError", async (queue, error) => {
    logger.warn("Connection error", { guildId: queue.guild.id, message: error.message });
    await reconnect(queue);
    try {
      if (queue && !queue.deleted && (queue.tracks?.size > 0 || (queue.tracks?.length ?? 0) > 0) && !queue.node.isPlaying()) {
        await queue.node.play();
      }
    } catch (e) {
      logger.warn("Resume after connectionError failed", { guildId: queue?.guild?.id, message: e?.message });
    }
  });

  client.player.events.on("disconnect", async (queue) => {
    logger.warn("Disconnected from voice", { guildId: queue.guild.id });
    await reconnect(queue);
    // After reconnect, resume playback if queue has tracks (fix: 2nd track not starting)
    try {
      if (queue && !queue.deleted) {
        const hasTracks = queue.tracks?.size > 0 || (queue.tracks?.length ?? 0) > 0;
        if (hasTracks && !queue.node.isPlaying()) {
          await queue.node.play();
        }
      }
    } catch (e) {
      logger.warn("Resume after disconnect failed", { guildId: queue?.guild?.id, message: e?.message });
    }
  });

  client.player.events.on("emptyQueue", async (queue) => {
    const guildId = queue.guild.id;
    if (progressIntervals.has(guildId)) {
      clearInterval(progressIntervals.get(guildId));
      progressIntervals.delete(guildId);
    }
    dashboardBridge.pushCurrentToHistoryOnly(guildId);

    const isAutoplayEnabled = !!queue.metadata?.isAutoplayEnabled;
    if (!isAutoplayEnabled) {
      dashboardBridge.pushCurrentToHistoryThenClear(guildId);
      if (queue.options.leaveOnEmpty !== false) queue.delete();
      return;
    }

    const lastTrack = queue.history?.previousTrack;
    if (!lastTrack) {
      if (queue.options.leaveOnEmpty !== false) queue.delete();
      return;
    }

    let nextTrack = null;
    try {
        nextTrack = await recommendationEngine.getNextAutoplayTrack(guildId, lastTrack, queue.history);
    } catch (e) {
      logger.warn("Recommendation engine failed; using fallback search.", { guildId, message: e?.message });
    }

    // Graceful fallback: "[artist] official audio" search.
    if (!nextTrack) {
      try {
        const artist = (lastTrack?.author || lastTrack?.artist || "").toString().trim();
        if (artist) {
          const res = await queue.player.search(`${artist} official audio`, {
            requestedBy: lastTrack?.requestedBy || null,
            searchEngine: QueryType.YOUTUBE_SEARCH
          });
          const session = sessionMemory.getSession(guildId);
          const recent20 = new Set(session.recentTracks.slice(0, 20));
          nextTrack =
            res?.tracks?.find((t) => {
              const u = t?.url || t?.id;
              return u && !recent20.has(String(u));
            }) || res?.tracks?.[0] || null;
        }
      } catch (_) {}
    }
    if (!nextTrack) {
      if (queue.options.leaveOnEmpty !== false) queue.delete();
      return;
    }
    queue.addTrack(nextTrack);
    await queue.node.play();
    console.log(`[Autoplay] Fallback ✓ ${nextTrack.title}`);
    const channelId = queue.metadata?.textChannelId;
    if (channelId) {
      const ch = queue.guild.channels.cache.get(channelId);
      if (ch?.send) {
        ch.send({
          embeds: [
            {
              color: 0x9b59b6,
              title: "♾️ Autoplay",
              description: `🎵 **${nextTrack.title}**\nBy ${nextTrack.author}`
            }
          ]
        }).catch(() => { });
      }
    }
  });

  const progressIntervals = new Map();

  client.player.events.on("playerStart", async (queue, track) => {
    clearVotes(queue.guild.id);
    clearRetry(queue.guild.id, track);
    const guildId = queue.guild.id;

    // Force Opus bitrate at the moment audio resources are ready.
    try {
      const qualityAttempt = track?.metadata?.qualityAttempt ?? 0;
      queue.node?.setBitrate?.(getOpusBitrateForQualityAttempt(qualityAttempt));
    } catch (_) {}

    // ==============================
    // Smart autoplay telemetry
    // ==============================
    try {
      const startedAt = Date.now();
      const trackUrl = track?.url || track?.id || "";
      queue.metadata._trackStartedAt = startedAt;
      queue.metadata._trackUrl = trackUrl;

      // Record session-based signals for diversity/mood.
      sessionMemory.markCandidatePlayed(guildId, track);

      // DB: track play counter baseline.
      // Don't await to keep this handler fast.
      if (!trackUrl) {
        // If the extractor didn't provide a stable URL/id, avoid polluting DB keys.
        // Session-memory still gets updated via markCandidatePlayed().
      } else {
        void client.db.upsertTrackPlay({ guildId, trackUrl }).catch(() => {});
      }

      // Prediction accuracy: check if the played track matches the last prediction.
      const session = sessionMemory.getSession(guildId);
      if (session?.lastAutoplayPrediction?.trackUrl) {
        const isHit = session.lastAutoplayPrediction.trackUrl === trackUrl;
        sessionMemory.updatePredictionOutcome(guildId, isHit);
        session.lastAutoplayPrediction = null;
      }

      // If autoplay is enabled, schedule "next predicted" event before song ends.
      if (queue.metadata?.isAutoplayEnabled) {
        const durationMs = track?.durationMS ?? 0;
        const delay = durationMs
          ? Math.max(5000, durationMs - 20000)
          : 60000; // fallback if duration missing

        if (queue.metadata._autoplayPredictionTimer) {
          clearTimeout(queue.metadata._autoplayPredictionTimer);
        }
        const predictingUrl = trackUrl;
        queue.metadata._autoplayPredictionTimer = setTimeout(async () => {
          try {
            const q = client.player.nodes.get(guildId);
            if (!q || q.deleted) return;
            if (!q.metadata?.isAutoplayEnabled) return;
            // Ensure we are still playing the same track.
            const cur = q.currentTrack;
            const curUrl = cur?.url || cur?.id || "";
            if (!curUrl || curUrl !== predictingUrl) return;

            const top = await recommendationEngine.getTopRecommendations(guildId, cur, 1, q.history);
            const predicted = top?.[0]?.track || null;
            if (!predicted) return;
            dashboardBridge.pushAutoplayPrediction(guildId, {
              title: predicted.title,
              artist: predicted.author,
              url: predicted.url || predicted.id || "",
              score: top?.[0]?.score ?? 0,
              why: top?.[0]?.why || {}
            });
          } catch (_) {}
        }, delay);
      }
    } catch (e) {
      logger.warn("Smart autoplay telemetry error", { guildId, message: e?.message });
    }
    if (progressIntervals.has(guildId)) {
      clearInterval(progressIntervals.get(guildId));
      progressIntervals.delete(guildId);
    }
    dashboardBridge.updateTrack(guildId, {
      title: track.title,
      author: track.author,
      thumbnail: track.thumbnail,
      duration: track.durationMS ? Math.floor(track.durationMS / 1000) : 0,
      durationMS: track.durationMS,
      url: track.url
    });

    const isAutoplayEnabled = !!queue.metadata?.isAutoplayEnabled;
    const trackCount = queue.tracks?.size ?? (queue.tracks?.length ?? 0);
    if (isAutoplayEnabled && trackCount === 0) {
      let nextTrack = null;
      try {
        nextTrack = await recommendationEngine.getNextAutoplayTrack(guildId, track, queue.history);
      } catch (e) {
        logger.warn("Autoplay prefetch failed; using fallback search.", { guildId, message: e?.message });
      }

      if (!nextTrack) {
        try {
          const artist = (track?.author || track?.artist || "").toString().trim();
          if (artist) {
            const res = await queue.player.search(`${artist} official audio`, {
              requestedBy: track?.requestedBy || null,
              searchEngine: QueryType.YOUTUBE_SEARCH
            });
              const session = sessionMemory.getSession(guildId);
              const recent20 = new Set(session.recentTracks.slice(0, 20));
              nextTrack =
                res?.tracks?.find((t) => {
                  const u = t?.url || t?.id;
                  return u && !recent20.has(String(u));
                }) || res?.tracks?.[0] || null;
          }
        } catch (_) {}
      }

      if (nextTrack) {
        queue.addTrack(nextTrack);
        console.log(`[Autoplay] Pre-fetched ⏭️ ${nextTrack.title}`);
      }
    }

    const tracks = queue.tracks.toArray ? queue.tracks.toArray() : [];
    dashboardBridge.updateQueue(guildId, tracks);

    const channelId = queue.metadata?.textChannelId;
    if (channelId) {
      const ch = queue.guild.channels.cache.get(channelId);
      const upNext = tracks[0];
      const embed = {
        color: 0x5865f2,
        title: "🎵 Now Playing",
        description: `**${track.title}**\n${track.author || "—"}`,
        thumbnail: track.thumbnail ? { url: track.thumbnail } : undefined,
        fields: upNext
          ? [{ name: "⏭️ Up Next:", value: `${upNext.title}\n${upNext.author || "—"}`, inline: false }]
          : []
      };
      if (ch?.send) {
        ch.send({ embeds: [embed] }).catch(() => { });
      }
    }
    progressIntervals.set(
      guildId,
      setInterval(() => {
        dashboardBridge.pushProgress(guildId);
        dashboardBridge.pushAudioStatus(guildId);
      }, 1000)
    );
  });

  client.player.events.on("playerFinish", async (queue, track) => {
    const guildId = queue.guild.id;
    if (queue.metadata?._autoplayPredictionTimer) {
      clearTimeout(queue.metadata._autoplayPredictionTimer);
      queue.metadata._autoplayPredictionTimer = null;
    }
    const startedAt = queue.metadata?._trackStartedAt;
    const trackUrl = track?.url || track?.id || "";
    if (!trackUrl) return;

    const listenSecondsRaw = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    const listenSeconds = track?.durationMS
      ? Math.max(0, Math.min(Math.floor(track.durationMS / 1000), Math.floor(listenSecondsRaw)))
      : Math.max(0, Math.floor(listenSecondsRaw));

    const moodTags = getTrackMoodTags(track);
    const trackGenre = pickGenreFromMoodTags(moodTags) || null;

    // DB telemetry (best-effort, non-blocking).
    void client.db
      .addListenHistory({
        guildId,
        userId: track?.requestedBy?.id || null,
        trackUrl,
        trackTitle: track?.title || null,
        trackArtist: track?.author || track?.artist || null,
        trackGenre,
        listenDuration: listenSeconds,
        completed: 1
      })
      .catch(() => {});

    void client.db
      .updateTrackOnComplete({
        guildId,
        trackUrl,
        deltaScore: 2
      })
      .catch(() => {});
  });

  client.player.events.on("playerSkip", async (queue, track) => {
    const guildId = queue.guild.id;
    if (queue.metadata?._autoplayPredictionTimer) {
      clearTimeout(queue.metadata._autoplayPredictionTimer);
      queue.metadata._autoplayPredictionTimer = null;
    }
    const startedAt = queue.metadata?._trackStartedAt;
    const trackUrl = track?.url || track?.id || "";
    if (!trackUrl) return;

    const listenSecondsRaw = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    const totalSeconds = track?.durationMS ? Math.floor(track.durationMS / 1000) : 0;
    const listenedSeconds = totalSeconds
      ? Math.max(0, Math.min(totalSeconds, Math.floor(listenSecondsRaw)))
      : Math.max(0, Math.floor(listenSecondsRaw));

    const playedPercent = totalSeconds > 0 ? listenedSeconds / totalSeconds : 0;

    // Scoring penalties:
    // - within 15s: score -=2 and blacklist for session
    // - after 50% played: score -=0.5
    let deltaScore = 0;
    if (listenedSeconds <= 15) {
      deltaScore = -2;
      sessionMemory.addSkipToBlacklist(guildId, trackUrl, 60 * 60 * 12); // ~12h (until process restart)
    } else if (playedPercent >= 0.5) {
      deltaScore = -0.5;
    }

    if (listenedSeconds <= 30) {
      sessionMemory.markSkipWithinFirst30(guildId, trackUrl);
    }
    if (playedPercent >= 0.5) {
      sessionMemory.markSkipAfter50Percent(guildId, trackUrl);
    }

    void client.db
      .addListenHistory({
        guildId,
        userId: track?.requestedBy?.id || null,
        trackUrl,
        trackTitle: track?.title || null,
        trackArtist: track?.author || track?.artist || null,
        trackGenre: pickGenreFromMoodTags(getTrackMoodTags(track)) || null,
        listenDuration: listenedSeconds,
        completed: 0
      })
      .catch(() => {});

    void client.db
      .updateTrackOnSkip({
        guildId,
        trackUrl,
        deltaScore,
        deltaSkip: 1
      })
      .catch(() => {});
  });

  client.player.events.on("audioTrackAdd", (queue) => {
    const tracks = queue.tracks.toArray ? queue.tracks.toArray() : [];
    dashboardBridge.updateQueue(queue.guild.id, tracks);
  });

  client.player.events.on("disconnect", (queue) => {
    const guildId = queue.guild.id;
    if (progressIntervals.has(guildId)) {
      clearInterval(progressIntervals.get(guildId));
      progressIntervals.delete(guildId);
    }
    dashboardBridge.clearState(guildId);
  });


  client.player.events.on("emptyChannel", async (queue) => {
    const settings = await getSettings(client, queue.guild.id);
    if (settings.stay_247) return;
    queue.delete();
  });

  if (!config.token) {
    throw new Error("Missing DISCORD_TOKEN in .env");
  }

  createDashboard(client);
  await client.login(config.token);
}

bootstrap().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
