const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a track by position")
    .addIntegerOption((o) => o.setName("position").setDescription("Queue position").setRequired(true)),
  djOnly: true,
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)]});
    }
    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)]});
    }

    const position = interaction.options.getInteger("position", true);
    const index = position - 1;
    const track = queue.tracks.toArray()[index];
    if (!track) {
      return interaction.editReply({ embeds: [errorEmbed(client, "Invalid position.")]});
    }
    queue.removeTrack(index);
    return interaction.editReply({ embeds: [infoEmbed(client, `Removed **${track.title}**.`, "Remove")] });
  }
};
