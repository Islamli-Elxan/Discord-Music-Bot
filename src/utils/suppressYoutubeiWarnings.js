/**
 * Wraps console.warn to suppress non-fatal YouTube.js parser warnings
 * (e.g. "GridShelfView not found!", "SectionHeaderView not found!").
 * Call once at startup before any YouTube search runs.
 */
function suppressYoutubeiParserWarnings() {
  const originalWarn = console.warn;
  const suppressPatterns = [
    /not found!?\s*$/i,
    /InnertubeError.*not found/i,
    /GridShelfView/i,
    /SectionHeaderView/i,
    /\[YOUTUBEJS\].*Parser/i
  ];

  console.warn = function (...args) {
    const msg = args.map((a) => (typeof a === "string" ? a : a?.message ?? String(a))).join(" ");
    if (suppressPatterns.some((p) => p.test(msg))) return;
    originalWarn.apply(console, args);
  };
}

module.exports = { suppressYoutubeiParserWarnings };
