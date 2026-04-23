/**
 * EQ preset definitions used by the `/eq` slash command and dashboard API.
 *
 * Bands mapping (used by `src/music/eqPresetToFilters.js`):
 * - band 0 => bass (80Hz)
 * - band 1 => mids (2kHz)
 * - band 2 => tempo/pitch effect via `atempo` (nightcore/podcast)
 * - band 3 => high (8kHz)
 */
const EQ_PRESETS = {
  flat: [],
  bassboost: [
    // Slight boost in bass and mids.
    { band: 0, gain: 0.25 },
    { band: 1, gain: 0.2 }
  ],
  nightcore: [
    // Pitch up via FFmpeg atempo.
    { band: 2, gain: 0.3 }
  ],
  vaporwave: [
    // Slightly slowed.
    { band: 0, gain: 0.15 }
  ],
  podcast: [
    // Slight speed-up + clearer highs for speech.
    { band: 2, gain: 0.15 },
    { band: 3, gain: 0.1 }
  ]
};

module.exports = { EQ_PRESETS };

