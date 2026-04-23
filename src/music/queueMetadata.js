function createQueueMetadata(guildId) {
  return {
    guildId,
    votes: new Set(),
    filters: new Set(),
    eqPreset: null,
    lastChannelId: null,
    textChannelId: null,
    /** Custom smart autoplay (do not use QueueRepeatMode.AUTOPLAY). */
    isAutoplayEnabled: false
  };
}

module.exports = { createQueueMetadata };
