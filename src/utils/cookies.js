const fs = require("node:fs");
const path = require("node:path");

const VALID_DOMAINS = [".youtube.com", "youtube.com", ".google.com", "google.com"];

function isAllowedDomain(domain) {
  if (!domain || typeof domain !== "string") return false;
  return VALID_DOMAINS.some((d) => domain === d || domain.endsWith("." + d));
}

/**
 * Parse Netscape HTTP Cookie File format (YouTube/Google only)
 * Format: domain\tflag\tpath\tsecure\texpiration\tname\tvalue
 * @returns {{ cookies: Array, totalEntries: number, filteredCount: number }}
 */
function parseNetscapeCookies(content) {
  const cookies = [];
  let totalEntries = 0;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 7) continue;
    totalEntries++;
    const [domain, , pathVal, secure, expiration, name, value] = parts;
    if (!name || !value) continue;
    if (!isAllowedDomain(domain)) continue;
    cookies.push({
      domain: domain || ".youtube.com",
      path: pathVal || "/",
      secure: secure === "TRUE" || secure === "1",
      httpOnly: false,
      sameSite: "none",
      hostOnly: !domain.startsWith("."),
      expirationDate: parseInt(expiration, 10) || undefined,
      name,
      value
    });
  }
  return { cookies, totalEntries, filteredCount: cookies.length };
}

function loadYoutubeCookies(cookiesPath, logger) {
  if (!cookiesPath) return null;
  const resolved = path.isAbsolute(cookiesPath) ? cookiesPath : path.join(process.cwd(), cookiesPath);
  try {
    const content = fs.readFileSync(resolved, "utf8");
    const { cookies, totalEntries, filteredCount } = parseNetscapeCookies(content);
    if (totalEntries > 0) {
      const msg = `Loaded ${filteredCount} valid YouTube/Google cookies out of ${totalEntries} entries`;
      if (logger?.info) {
        logger.info("YouTube cookies", { filtered: filteredCount, total: totalEntries, message: msg });
      } else {
        console.log(`[Cookies] ${msg}`);
      }
    }
    return cookies.length > 0 ? cookies : null;
  } catch {
    return null;
  }
}

function cookiesToHeader(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return "";
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

module.exports = { parseNetscapeCookies, loadYoutubeCookies, cookiesToHeader };
