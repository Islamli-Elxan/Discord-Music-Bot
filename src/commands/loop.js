const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { updateSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "off", value: "off" },
          { name: "track", value: "track" },
          { name: "queue", value: "queue" }
        )
    ),
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
    const mode = interaction.options.getString("mode", true);
    queue.setRepeatMode(mode === "track" ? 1 : mode === "queue" ? 2 : 0);
    await updateSettings(client, interaction.guild.id, { loop_mode: mode });
    return interaction.editReply({ embeds: [infoEmbed(client, `Loop mode set to ${mode}.`, "Loop")] });
  }
};
