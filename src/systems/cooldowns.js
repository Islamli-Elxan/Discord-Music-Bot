const { Collection } = require("discord.js");

function canRun(client, commandName, userId, cooldownSeconds = 3) {
  if (!client.cooldowns.has(commandName)) {
    client.cooldowns.set(commandName, new Collection());
  }
  const now = Date.now();
  const timestamps = client.cooldowns.get(commandName);
  const cooldownMs = cooldownSeconds * 1000;

  if (timestamps.has(userId)) {
    const expiration = timestamps.get(userId) + cooldownMs;
    if (now < expiration) {
      return { ok: false, remainingMs: expiration - now };
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownMs);
  return { ok: true, remainingMs: 0 };
}

module.exports = { canRun };
