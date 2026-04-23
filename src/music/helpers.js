const { ensureSameChannel } = require("../utils/voice");

function getQueue(client, guildId) {
  return client.player.nodes.get(guildId);
}

function requireQueue(interaction, queue) {
  if (!queue || !queue.currentTrack) {
    return { ok: false, message: "No music is playing. Use /play to add tracks first." };
  }
  return { ok: true };
}

function requireSameChannel(interaction, queue) {
  const check = ensureSameChannel(interaction, queue);
  if (!check.ok) return { ok: false, message: check.message };
  return { ok: true, channel: check.channel };
}

module.exports = { getQueue, requireQueue, requireSameChannel };
