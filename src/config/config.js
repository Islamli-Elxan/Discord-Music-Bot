const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env") });

module.exports = {
  token: process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  defaultGuildId: process.env.GUILD_ID || "",
  youtubeCookiesPath: process.env.YOUTUBE_COOKIES_PATH || "",
  dev: process.env.NODE_ENV !== "production",
  defaultVolume: Number(process.env.DEFAULT_VOLUME || 50),
  idleTimeoutMs: Number(process.env.IDLE_TIMEOUT_MS || 300000),
  logLevel: process.env.LOG_LEVEL || "info"
};
