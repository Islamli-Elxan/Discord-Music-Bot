const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { updateSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set playback volume")
    .addIntegerOption((o) => o.setName("value").setDescription("1-100").setRequired(true)),
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

    const value = Math.max(1, Math.min(100, interaction.options.getInteger("value", true)));
    queue.node.setVolume(value);
    await updateSettings(client, interaction.guild.id, { volume: value });
    return interaction.editReply({ embeds: [infoEmbed(client, `Volume set to ${value}.`, "Volume")] });
  }
};
