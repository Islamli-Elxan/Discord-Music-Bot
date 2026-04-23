const { SlashCommandBuilder } = require("discord.js");
const { requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { updateSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription("Toggle 24/7 mode")
    .addBooleanOption((o) => o.setName("enabled").setDescription("Enable or disable").setRequired(true)),
  djOnly: true,
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)]});
    }

    const enabled = interaction.options.getBoolean("enabled", true);
    await updateSettings(client, interaction.guild.id, { stay_247: enabled ? 1 : 0 });
    if (queue && queue.metadata) {
      queue.metadata.lastChannelId = voiceCheck.channel.id;
    }
    return interaction.editReply({
      embeds: [infoEmbed(client, `24/7 mode ${enabled ? "enabled" : "disabled"}.`, "24/7")]
    });
  }
};
