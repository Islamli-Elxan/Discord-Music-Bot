const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the queue")
    .addIntegerOption((o) => o.setName("page").setDescription("Page number").setRequired(false)),
  cooldown: 3,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });
    }

    const page = Math.max(1, interaction.options.getInteger("page") || 1);
    const tracks = queue.tracks.toArray();
    const pageSize = 10;
    const pages = Math.max(1, Math.ceil(tracks.length / pageSize));
    const start = (page - 1) * pageSize;
    const list = tracks.slice(start, start + pageSize);

    const lines = list.map((t, i) => `\`${start + i + 1}.\` ${t.title} (${t.duration})`);
    const desc = [
      `**Now Playing:** ${queue.currentTrack.title} (${queue.currentTrack.duration})`,
      "",
      lines.length ? lines.join("\n") : "*No more tracks in queue.*",
      "",
      `Page ${page}/${pages} • Total: ${tracks.length}`
    ].join("\n");

    return interaction.editReply({ embeds: [infoEmbed(client, desc, "Queue")] });
  }
};
