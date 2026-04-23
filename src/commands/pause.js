const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed } = require("../utils/embeds");

const RESUME_COLOR = 0x00ff00;
const PAUSE_COLOR = 0xffa500;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause or resume the current track"),
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

    const isPaused = queue.node.isPaused();
    queue.node.setPaused(!isPaused);

    const resuming = isPaused;
    const embed = new EmbedBuilder()
      .setColor(resuming ? RESUME_COLOR : PAUSE_COLOR)
      .setTitle(resuming ? "▶️ Resumed" : "⏸️ Paused")
      .setDescription(
        resuming
          ? "**Playback has continued!** 🎵"
          : "**Playback paused.** ⏸️\nUse `/pause` again to resume."
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
