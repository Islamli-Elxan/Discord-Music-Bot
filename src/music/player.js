const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const ffmpegPath = require("ffmpeg-static");
const { loadYoutubeCookies, cookiesToHeader } = require("../utils/cookies");

async function createPlayer(client, logger) {
  if (ffmpegPath && typeof ffmpegPath === "string") {
    process.env.FFMPEG_PATH = ffmpegPath;
    logger.info("FFmpeg path set", { path: ffmpegPath });
  } else {
    logger.warn("ffmpeg-static did not return a path; playback may fail.");
  }

  const ytdlOpts = {
    quality: "highestaudio",
    highWaterMark: 1 << 25,
    dlChunkSize: 1024 * 1024 * 4,
    requestOptions: {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    }
  };

  const cookiesPath = client.config?.youtubeCookiesPath;
  if (cookiesPath) {
    logger.info("Loading YouTube cookies", { path: cookiesPath });
  }
  const cookies = cookiesPath ? loadYoutubeCookies(cookiesPath, logger) : null;
  const cookieHeader = cookies ? cookiesToHeader(cookies) : "";
  if (cookies) {
    // `yt-dlp` / ytdl-core cookie header expects a single string, not an array.
    ytdlOpts.requestOptions.headers.cookie = cookieHeader;
  }

  const player = new Player(client, {
    ytdlOptions: ytdlOpts,
    ffmpeg: {
      path: ffmpegPath
    },
    skipFFmpeg: false,
    connectionTimeout: 60000,
    probeTimeout: 15000
  });

  // HYBRID: YoutubeiExtractor for search, play-dl for streaming (onBeforeCreateStream in index.js).
  // Register YoutubeiExtractor - fixes "No results found". Streaming bypassed by play-dl.
  try {
    const { YoutubeiExtractor } = require("discord-player-youtubei");
    await player.extractors.register(YoutubeiExtractor, {
      cookie: cookieHeader || undefined
    });
    logger.info("Registered extractor", { name: "YoutubeiExtractor (search)" });
  } catch (error) {
    logger.warn("YoutubeiExtractor not available", { message: error.message });
  }

  // Load default extractors (Spotify, SoundCloud, Attachment, etc.) — no YouTube (we use YoutubeiExtractor).
  try {
    const result = await player.extractors.loadMulti(DefaultExtractors);
    if (result?.success) {
      logger.info("Loaded default extractors (loadMulti)");
    }
  } catch (error) {
    logger.warn("loadMulti failed", { message: error.message });
  }

  return player;
}

module.exports = { createPlayer };
