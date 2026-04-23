const MOOD_KEYWORDS = {
  chill: ["lofi", "chill", "relax", "calm", "sleep", "study"],
  hype: ["trap", "bass", "hype", "fire", "lit", "rage"],
  sad: ["sad", "cry", "heartbreak", "alone", "miss"],
  party: ["party", "dance", "club", "edm", "remix"],
  // Azerbaijani keywords:
  az_sad: ["kədər", "ağla", "həsrət", "ayrılıq"],
  az_hype: ["oyna", "zurna", "toy"]
};

const TAGGED_GENRE_BY_MOOD = {
  chill: ["lofi", "chill", "chillhop", "ambient", "study"],
  hype: ["trap", "bass", "hype", "uk drill", "drill", "hip hop"],
  sad: ["sad", "ballad", "emotional"],
  party: ["party", "edm", "club"],
  az_sad: ["kədər", "ağla", "həsrət", "ayrılıq"],
  az_hype: ["oyna", "zurna", "toy"]
};

function normalizeText(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function extractMoodTagsFromText(text) {
  const raw = normalizeText(text);
  const tags = new Set();

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const kw of keywords) {
      const k = normalizeText(kw);
      if (!k) continue;
      if (raw.includes(k)) {
        tags.add(mood);
        break;
      }
    }
  }

  return Array.from(tags);
}

function getTrackMoodTags(track) {
  const title = track?.title || "";
  const artist = track?.author || track?.artist || "";
  const genreHint = track?.genre || track?.track_genre || "";

  // Put title first (usually contains lofi/trap tags).
  return extractMoodTagsFromText(`${title} ${artist} ${genreHint}`);
}

function getSessionMood(session, lastN = 5) {
  if (!session) return [];
  const last = Array.isArray(session.recentMoodTags) ? session.recentMoodTags.slice(0, lastN) : [];
  const counts = new Map();
  for (const tags of last) {
    if (!Array.isArray(tags)) continue;
    for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 2).map((x) => x[0]);
}

function moodOverlap(aTags, bTags) {
  if (!Array.isArray(aTags) || !Array.isArray(bTags) || !aTags.length || !bTags.length) return 0;
  const set = new Set(aTags);
  let count = 0;
  for (const t of bTags) if (set.has(t)) count++;
  return count;
}

function pickGenreFromMoodTags(moodTags) {
  if (!Array.isArray(moodTags) || moodTags.length === 0) return null;
  // Pick the first matched mood label as a cheap "genre/mood" marker.
  return moodTags[0];
}

module.exports = {
  MOOD_KEYWORDS,
  TAGGED_GENRE_BY_MOOD,
  extractMoodTagsFromText,
  getTrackMoodTags,
  getSessionMood,
  moodOverlap,
  pickGenreFromMoodTags
};

