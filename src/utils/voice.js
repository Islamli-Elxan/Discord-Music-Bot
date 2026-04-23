function getMemberVoiceChannel(interaction) {
  const member = interaction.member;
  if (!member || !member.voice) return null;
  return member.voice.channel;
}

function ensureSameChannel(interaction, queue) {
  const memberChannel = getMemberVoiceChannel(interaction);
  if (!memberChannel) return { ok: false, message: "Join a voice channel first." };
  if (queue && queue.channelId && queue.channelId !== memberChannel.id) {
    return { ok: false, message: "You must be in the same voice channel as the bot." };
  }
  return { ok: true, channel: memberChannel };
}

module.exports = { getMemberVoiceChannel, ensureSameChannel };
