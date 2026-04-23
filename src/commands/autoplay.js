const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { useQueue, QueueRepeatMode } = require("discord-player");

const ON_COLOR = 0x00ff00;
const OFF_COLOR = 0xff0000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay (related songs & same artist)")
    .setDMPermission(false),
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();

    const queue = useQueue(interaction.guild.id);

    if (!queue) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(OFF_COLOR)
            .setTitle("❌ No Queue")
            .setDescription("Play a song first to use autoplay.")
        ]
      });
    }

    const enabled = !queue.metadata.isAutoplayEnabled;
    queue.metadata.isAutoplayEnabled = enabled;
    queue.setRepeatMode(QueueRepeatMode.OFF);

    const embed = new EmbedBuilder()
      .setColor(enabled ? ON_COLOR : OFF_COLOR)
      .setTitle(enabled ? "✅ Infinite Mix ACTIVATED" : "❌ Infinite Mix DEACTIVATED")
      .setDescription(
        enabled
          ? "**Autoplay is now ON!** 🟢\nBot will automatically play related songs when the queue ends."
          : "**Autoplay is now OFF.** 🔴\nPlayback will stop after the last song."
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
