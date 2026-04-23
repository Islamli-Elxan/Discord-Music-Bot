module.exports = {
  name: "voiceStateUpdate",
  async execute(client, oldState, newState) {
    if (!oldState.guild) return;
    if (oldState.member.id !== client.user.id) return;

    const queue = client.player.nodes.get(oldState.guild.id);
    if (!queue) return;

    if (!newState.channelId) {
      const settings = await client.db.getGuildSettings(oldState.guild.id);
      if (settings && settings.stay_247 && queue.metadata?.lastChannelId) {
        try {
          await queue.connect(oldState.guild.channels.cache.get(queue.metadata.lastChannelId));
        } catch (error) {
          client.logger.warn("Failed to reconnect 24/7", { guildId: oldState.guild.id });
        }
      }
    }
  }
};
