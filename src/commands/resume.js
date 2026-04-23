const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume playback"),
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
    queue.node.setPaused(false);
    return interaction.editReply({ embeds: [infoEmbed(client, "Resumed playback.", "Resume")] });
  }
};
