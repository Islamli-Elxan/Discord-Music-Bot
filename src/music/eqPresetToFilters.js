const { EQ_PRESETS } = require("../config/eqPresets");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert an EQ preset (from config) into FFmpeg filter expressions.
 *
 * We only generate preset-specific additions. Your base pipeline still
 * applies highpass/loudnorm/equalizer defaults.
 */
function eqPresetToFfmpegFilters(presetName) {
  const preset = EQ_PRESETS[presetName] ?? EQ_PRESETS.flat;
  const timeFilters = [];
  const extraEqFilters = [];

  // Map config `gain` (0..0.3-ish) into dB-ish boosts.
  // This is intentionally conservative; the base pipeline already boosts.
  const toDb = (gain) => clamp(gain * 8, -6, 6);

  // Tempo/pitch effects (atempo) are controlled by `band` 2 and 0 in the config comments.
  for (const item of preset) {
    if (!item || typeof item.band !== "number") continue;

    // Nightcore: band 2 => speed up
    if (presetName === "nightcore" && item.band === 2) {
      const factor = 1 + clamp(item.gain, 0, 0.9);
      timeFilters.push(`atempo=${factor.toFixed(3)}`);
      continue;
    }

    // Vaporwave: band 0 => slow down
    if (presetName === "vaporwave" && item.band === 0) {
      const factor = 1 - clamp(item.gain, 0, 0.5);
      timeFilters.push(`atempo=${factor.toFixed(3)}`);
      continue;
    }

    // Podcast: band 2 => slight speed up (speech clarity)
    if (presetName === "podcast" && item.band === 2) {
      const factor = 1 + clamp(item.gain, 0, 0.5);
      timeFilters.push(`atempo=${factor.toFixed(3)}`);
      continue;
    }

    // Frequency EQ additions.
    // - band 0 => 80Hz bass
    // - band 1 => 2kHz mids
    // - band 3 => 8kHz highs
    if (item.band === 0) {
      extraEqFilters.push(`equalizer=f=80:t=q:w=1:g=${toDb(item.gain).toFixed(2)}`);
    } else if (item.band === 1) {
      extraEqFilters.push(`equalizer=f=2000:t=q:w=1:g=${toDb(item.gain).toFixed(2)}`);
    } else if (item.band === 3) {
      extraEqFilters.push(`equalizer=f=8000:t=q:w=1:g=${toDb(item.gain).toFixed(2)}`);
    }
  }

  return { timeFilters, extraEqFilters };
}

function isValidPreset(presetName) {
  return Object.prototype.hasOwnProperty.call(EQ_PRESETS, presetName);
}

function getAvailablePresets() {
  return Object.keys(EQ_PRESETS);
}

module.exports = { eqPresetToFfmpegFilters, isValidPreset, getAvailablePresets };

