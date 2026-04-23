const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { addVote, clearVotes } = require("../music/votes");
const { errorEmbed } = require("../utils/embeds");
const { isDJ } = require("../systems/permissions");
const { getSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current track"),
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });
    }
    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)] });
    }

    const settings = await getSettings(client, interaction.guild.id);
    const current = queue.currentTrack;
    const member = interaction.member;
    const isDj = isDJ(member, settings);
    const isRequester = current && current.requestedBy && current.requestedBy.id === interaction.user.id;

    const skippedTrack = queue.currentTrack?.title || "Unknown";
    const nextTrack = queue.tracks.toArray()[0]?.title;

    if (isDj || isRequester) {
      clearVotes(interaction.guild.id);
      queue.node.skip();
      const desc = nextTrack
        ? `⏭️ **Skipped:** ${skippedTrack} -> **${nextTrack}**`
        : `⏭️ **Skipped:** ${skippedTrack}`;
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription(desc)]
      });
    }

    const channelMembers = voiceCheck.channel.members.filter((m) => !m.user.bot).size;
    const requiredVotes = Math.max(2, Math.ceil(channelMembers / 2));
    const votes = addVote(interaction.guild.id, interaction.user.id);

    if (votes >= requiredVotes) {
      clearVotes(interaction.guild.id);
      queue.node.skip();
      const desc = nextTrack
        ? `⏭️ **Skipped:** ${skippedTrack} -> **${nextTrack}** (Vote: ${votes}/${requiredVotes})`
        : `⏭️ **Skipped:** ${skippedTrack} (Vote: ${votes}/${requiredVotes})`;
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x2b2d31).setDescription(desc)]
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription(`🗳️ Vote added (${votes}/${requiredVotes}).`)
      ]
    });
  }
};
