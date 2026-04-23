function randomId(len = 12) {
  return Math.random().toString(36).slice(2, 2 + len);
}

class Cache {
  constructor() {
    this.guildSettings = new Map();
    this.playSelections = new Map();
  }

  getSettings(guildId) {
    return this.guildSettings.get(guildId) || null;
  }

  setSettings(guildId, settings) {
    this.guildSettings.set(guildId, settings);
  }

  clearSettings(guildId) {
    this.guildSettings.delete(guildId);
  }

  setPlaySelection(key, data) {
    this.playSelections.set(key, data);
    setTimeout(() => this.playSelections.delete(key), 60_000);
  }

  getPlaySelection(key) {
    return this.playSelections.get(key) || null;
  }
}

module.exports = { Cache };
