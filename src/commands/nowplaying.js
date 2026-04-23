const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { requireQueue, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { progressBar } = require("../utils/progress");

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show current track"),
  cooldown: 3,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });
    }

    const track = queue.currentTrack;
    const position = queue.node.getTimestamp()?.current?.value || 0;
    const duration = queue.node.getTimestamp()?.total?.value || track.durationMS || 0;
    const bar = progressBar(position, duration);

    const embed = infoEmbed(
      client,
      `**${track.title}**\n${bar}\n${queue.node.getTimestamp()?.current?.label || "0:00"} / ${
        queue.node.getTimestamp()?.total?.label || track.duration
      }`,
      "Now Playing"
    ).setThumbnail(track.thumbnail || null);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("control_skip").setLabel("Skip").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("control_pause").setLabel("Pause").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("control_resume").setLabel("Resume").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("control_stop").setLabel("Stop").setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }
};
