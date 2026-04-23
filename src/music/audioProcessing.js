const { spawn } = require("node:child_process");
const { PassThrough } = require("node:stream");
const ffmpegStatic = require("ffmpeg-static");

const { getFilterValue } = require("./filters");
const { eqPresetToFfmpegFilters } = require("./eqPresetToFilters");

const AUDIO_EXTS = [
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
  ".flac"
];

function isDirectAudioUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.split("?")[0].toLowerCase();
  return AUDIO_EXTS.some((ext) => u.endsWith(ext));
}

function getYtDlpFormatForQualityAttempt(attempt) {
  // attempt:
  // 0 => high
  // 1 => medium
  // 2 => low
  if (attempt <= 0) return "bestaudio/best";
  if (attempt === 1) return "bestaudio[abr<=160K]/bestaudio/best";
  return "bestaudio[abr<=96K]/bestaudio/best";
}

function getOpusBitrateForQualityAttempt(attempt) {
  // Bitrate in bits/sec for discord voice Opus encoder.
  // Discord often clamps to the channel bitrate, but this gives the best chance.
  if (attempt <= 0) return 320e3;
  if (attempt === 1) return 160e3;
  return 96e3;
}

function buildLoudnormFilter(loudnormMeta) {
  // Base 1-pass loudness normalization.
  const base = "loudnorm=I=-16:TP=-1.5:LRA=11";
  if (!loudnormMeta) return base;

  // Two-pass loudnorm uses measured values + offset for more consistent leveling.
  // We store measured_* and target_offset (as `offset`) from ffmpeg loudnorm json output.
  const measured_I = loudnormMeta.measured_I;
  const measured_TP = loudnormMeta.measured_TP;
  const measured_LRA = loudnormMeta.measured_LRA;
  const measured_thresh = loudnormMeta.measured_thresh;
  const target_offset = loudnormMeta.target_offset;

  if (
    typeof measured_I !== "number" ||
    typeof measured_TP !== "number" ||
    typeof measured_LRA !== "number" ||
    typeof measured_thresh !== "number" ||
    typeof target_offset !== "number"
  ) {
    return base;
  }

  return [
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    `:measured_I=${measured_I}`,
    `:measured_TP=${measured_TP}`,
    `:measured_LRA=${measured_LRA}`,
    `:measured_thresh=${measured_thresh}`,
    `:offset=${target_offset}`,
    ":linear=true"
  ].join("");
}

function buildBasePipelineFilters({ loudnormMeta, eqPresetName, echoEnabled }) {
  const { extraEqFilters } = eqPresetToFfmpegFilters(eqPresetName);

  return [
    // Cut muddy sub-bass below 80Hz.
    "highpass=f=80",
    // Discord native sample rate is 48kHz.
    "aresample=48000",
    // EBU R128 loudness normalization (with per-track two-pass when available).
    buildLoudnormFilter(loudnormMeta),
    // Base equalizer defaults (small tasteful boosts).
    // Slight bass boost at 80Hz (+2dB)
    "equalizer=f=80:t=q:w=1:g=2",
    // Clear mids at 2kHz (+1dB)
    "equalizer=f=2000:t=q:w=1:g=1",
    // Crisp highs at 8kHz (+1dB)
    "equalizer=f=8000:t=q:w=1:g=1",
    // Extra equalizer additions from `/eq` presets.
    ...extraEqFilters,
    // Optional echo for depth (toggleable via `/filter echo`).
    ...(echoEnabled ? ["aecho=0.8:0.9:1000:0.3"] : [])
  ];
}

function buildFullFfmpegFilters({ userFilterNames, eqPresetName, loudnormMeta }) {
  const echoEnabled = userFilterNames?.has?.("echo") ?? false;

  const { timeFilters } = eqPresetToFfmpegFilters(eqPresetName);

  // User toggled filters are added before the base pipeline so that
  // loudnorm/equalizer can re-normalize the result.
  const userFilters = Array.from(userFilterNames || [])
    .filter((name) => name !== "echo")
    .map((name) => getFilterValue(name))
    .filter(Boolean);

  const basePipeline = buildBasePipelineFilters({ loudnormMeta, eqPresetName, echoEnabled });
  return [...timeFilters, ...userFilters, ...basePipeline];
}

function parseLoudnormJson(stderr) {
  // loudnorm json output contains a single object with `target_offset`.
  const match = stderr && stderr.match(/\{[\s\S]*?"target_offset"\s*:\s*".*?"[\s\S]*?\}/m);
  if (!match) return null;

  const obj = JSON.parse(match[0]);
  const measured_I = parseFloat(obj.input_i);
  const measured_TP = parseFloat(obj.input_tp);
  const measured_LRA = parseFloat(obj.input_lra);
  const measured_thresh = parseFloat(obj.input_thresh);
  const target_offset = parseFloat(obj.target_offset);

  if ([measured_I, measured_TP, measured_LRA, measured_thresh, target_offset].some((n) => Number.isNaN(n))) {
    return null;
  }

  return { measured_I, measured_TP, measured_LRA, measured_thresh, target_offset };
}

async function analyzeLoudnessViaFfmpeg({ input, ffmpegPath, ytdlpPath, format, cookiePath, userAgent, timeoutMs = 10000, maxSeconds = 45 }) {
  // If input is a direct audio URL, we can feed it to ffmpeg directly.
  if (isDirectAudioUrl(input)) {
    return new Promise((resolve) => {
      const af = buildLoudnormFilter(null).replace("loudnorm=I=-16:TP=-1.5:LRA=11", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json");
      const args = [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "warning",
        "-t",
        String(maxSeconds),
        "-i",
        input,
        "-vn",
        "-sn",
        "-af",
        af,
        "-f",
        "null",
        "-"
      ];

      const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));

      const timer = setTimeout(() => {
        try {
          proc.kill("SIGTERM");
        } catch {}
      }, timeoutMs);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return resolve(null);
        resolve(parseLoudnormJson(stderr));
      });
      proc.on("error", () => resolve(null));
    });
  }

  // Otherwise, use yt-dlp to stream audio to ffmpeg and run loudnorm analysis.
  return new Promise((resolve) => {
    const ffArgs = [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "warning",
      "-t",
      String(maxSeconds),
      "-i",
      "pipe:0",
      "-vn",
      "-sn",
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-"
    ];

    const ytdlArgs = [
      input,
      "-f",
      format,
      "--no-playlist",
      "--force-ipv4",
      "--retries",
      "3",
      "--socket-timeout",
      "30",
      "-o",
      "-"
    ];
    if (cookiePath) ytdlArgs.push("--cookies", cookiePath);
    if (userAgent) {
      // yt-dlp accepts headers via request-options.
      ytdlArgs.push(
        "--user-agent",
        userAgent
      );
    }

    const ytdl = spawn(ytdlpPath, ytdlArgs, { stdio: ["ignore", "pipe", "pipe"] });
    const ff = spawn(ffmpegPath, ffArgs, { stdio: ["pipe", "ignore", "pipe"] });

    ytdl.stdout.pipe(ff.stdin);

    let stderr = "";
    ff.stderr.on("data", (d) => (stderr += d.toString()));

    let finished = false;
    const done = (val) => {
      if (finished) return;
      finished = true;
      resolve(val);
      try {
        ytdl.kill("SIGTERM");
      } catch {}
      try {
        ff.kill("SIGTERM");
      } catch {}
    };

    const timer = setTimeout(() => {
      done(null);
    }, timeoutMs);

    const cleanupOnClose = () => {
      clearTimeout(timer);
      done(parseLoudnormJson(stderr));
    };

    ff.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return done(null);
      cleanupOnClose();
    });

    ff.on("error", () => done(null));
    ytdl.on("error", () => done(null));
  });
}

async function getOrAnalyzeTrackLoudnormMeta({ db, track, input, format, ytdlpPath, cookiePath, userAgent, timeoutMs = 8000, maxSeconds = 45 }) {
  const urlKey = track?.url || track?.id || track?.title;
  if (!urlKey) return null;

  try {
    const existing = await db.getTrackLoudnessGain(urlKey);
    if (existing) {
      return {
        measured_I: existing.measured_I != null ? Number(existing.measured_I) : null,
        measured_TP: existing.measured_TP != null ? Number(existing.measured_TP) : null,
        measured_LRA: existing.measured_LRA != null ? Number(existing.measured_LRA) : null,
        measured_thresh: existing.measured_thresh != null ? Number(existing.measured_thresh) : null,
        target_offset: existing.target_offset != null ? Number(existing.target_offset) : null
      };
    }
  } catch {
    // ignore db errors, fall back to 1-pass loudnorm
  }

  try {
    const meta = await analyzeLoudnessViaFfmpeg({
      input,
      ffmpegPath: ffmpegStatic,
      ytdlpPath: ytdlpPath,
      format,
      cookiePath,
      userAgent,
      timeoutMs,
      maxSeconds
    });
    if (!meta) return null;

    try {
      await db.upsertTrackLoudnessGain(urlKey, {
        measured_I: meta.measured_I,
        measured_TP: meta.measured_TP,
        measured_LRA: meta.measured_LRA,
        measured_thresh: meta.measured_thresh,
        target_offset: meta.target_offset,
        gain_db: meta.target_offset
      });
    } catch {
      // ignore cache write failures
    }
    return meta;
  } catch {
    return null;
  }
}

module.exports = {
  isDirectAudioUrl,
  getYtDlpFormatForQualityAttempt,
  getOpusBitrateForQualityAttempt,
  buildFullFfmpegFilters,
  getOrAnalyzeTrackLoudnormMeta,
  parseLoudnormJson
};

