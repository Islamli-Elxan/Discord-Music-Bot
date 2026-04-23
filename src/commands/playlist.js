const { SlashCommandBuilder } = require("discord.js");
const { QueryType } = require("discord-player");
const { createQueueMetadata } = require("../music/queueMetadata");
const { getSettings } = require("../systems/settings");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { safeEdit } = require("../utils/interaction");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Manage playlists")
    .addSubcommand((s) =>
      s
        .setName("save")
        .setDescription("Save current queue as a playlist")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("play")
        .setDescription("Play a saved playlist")
        .addStringOption((o) => o.setName("name").setDescription("Playlist name").setRequired(true))
    )
    .addSubcommand((s) => s.setName("list").setDescription("List saved playlists")),
  cooldown: 4,
  async execute(client, interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    if (sub === "list") {
      const list = await client.db.listPlaylists(interaction.guild.id);
      const desc = list.length ? list.map((n) => `• ${n}`).join("\n") : "No saved playlists.";
      return interaction.editReply({ embeds: [infoEmbed(client, desc, "Playlists")] });
    }

    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (sub === "save") {
      if (!hasQueue.ok) {
        return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });
      }
    }
    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)] });
    }

    const name = interaction.options.getString("name", true);
    if (sub === "save") {
      const tracks = [queue.currentTrack, ...queue.tracks.toArray()].map((t) => ({
        title: t.title,
        url: t.url
      }));
      await client.db.savePlaylist(interaction.guild.id, name, tracks);
      return interaction.editReply({ embeds: [infoEmbed(client, `Playlist **${name}** saved.`, "Playlist")] });
    }

    if (sub === "play") {
      const saved = await client.db.getPlaylist(interaction.guild.id, name);
      if (!saved || !saved.length) {
        return safeEdit(client, interaction, { embeds: [errorEmbed(client, "Playlist not found.")] });
      }
      const settings = await getSettings(client, interaction.guild.id);
      const metadata = createQueueMetadata(interaction.guild.id);
      const targetQueue =
        queue ||
        client.player.nodes.create(interaction.guild, {
          metadata,
          leaveOnEnd: false,
          leaveOnEmpty: false,
          leaveOnEmptyCooldown: 300000,
          leaveOnStop: false,
          bufferingTimeout: 15000
        });
      targetQueue.metadata.lastChannelId = voiceCheck.channel.id;
      targetQueue.metadata.textChannelId = interaction.channel?.id;
      try {
        if (!targetQueue.connection) await targetQueue.connect(voiceCheck.channel);
        targetQueue.node.setVolume(settings.volume);
        for (const item of saved) {
          const result = await client.player.search(item.url, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO
          });
          if (result.tracks[0]) await targetQueue.addTrack(result.tracks[0]);
        }
        if (!targetQueue.isPlaying()) await targetQueue.node.play();
      } catch (error) {
        client.logger.error("Playlist play failed", { message: error.message });
        return safeEdit(client, interaction, {
          embeds: [errorEmbed(client, "Could not load playlist. Some tracks may be unavailable.")]
        });
      }
      return safeEdit(client, interaction, {
        embeds: [infoEmbed(client, `Queued playlist **${name}** (${saved.length} tracks).`, "Playlist")]
      });
    }
  }
};
