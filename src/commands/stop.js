const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop and clear the queue"),
  djOnly: true,
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
    queue.delete();
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription("🛑 **Playback Stopped.** See you next time!")
      ]
    });
  }
};
