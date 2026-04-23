const levels = ["debug", "info", "warn", "error"];

function format(level, message, meta) {
  const time = new Date().toISOString();
  const base = `[${time}] [${level.toUpperCase()}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
}

class Logger {
  constructor(level = "info") {
    this.level = level;
  }

  shouldLog(level) {
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message, meta) {
    if (this.shouldLog("debug")) console.log(format("debug", message, meta));
  }

  info(message, meta) {
    if (this.shouldLog("info")) console.log(format("info", message, meta));
  }

  warn(message, meta) {
    if (this.shouldLog("warn")) console.warn(format("warn", message, meta));
  }

  error(message, meta) {
    if (this.shouldLog("error")) console.error(format("error", message, meta));
  }
}

module.exports = { Logger };
