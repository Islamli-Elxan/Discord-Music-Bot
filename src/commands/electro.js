const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { useQueue, useMainPlayer, QueryType, QueueRepeatMode } = require("discord-player");
const { requireSameChannel } = require("../music/helpers");
const { safeEdit } = require("../utils/interaction");

const YOUTUBE_COLOR = 0xff0000;
const ERROR_COLOR = 0xe74c3c;

// Paste your YouTube Playlist link here (replace if using a different playlist)
const PLAYLIST_URL = "https://youtube.com/playlist?list=PLWb11GoYI7aEce0WGdajPcmMsCZkxC8l_";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("electro")
    .setDescription("Play the Electro playlist with auto-shuffle (fresh mix every time)")
    .setDMPermission(false),
  cooldown: 3,
  async execute(client, interaction) {
    await interaction.deferReply();

    const existingQueue = client.player?.nodes?.get(interaction.guild.id);
    const voiceCheck = requireSameChannel(interaction, existingQueue);
    if (!voiceCheck.ok) {
      return safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(ERROR_COLOR)
            .setTitle("❌ Error")
            .setDescription(voiceCheck.message)
        ]
      });
    }

    if (PLAYLIST_URL.includes("PASTE_YOUR")) {
      return safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(ERROR_COLOR)
            .setTitle("⚠️ Setup Required")
            .setDescription(
              "Please open `src/commands/electro.js` and paste your YouTube Playlist link!"
            )
        ]
      });
    }

    await safeEdit(client, interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(YOUTUBE_COLOR)
          .setTitle("🔴 Electro")
          .setDescription("Loading YouTube playlist...")
      ]
    });

    try {
      const player = useMainPlayer?.() ?? client.player;
      if (!player) {
        return safeEdit(client, interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(ERROR_COLOR)
              .setTitle("❌ Electro Error")
              .setDescription("Player not available.")
          ]
        });
      }

      const searchResult = await player.search(PLAYLIST_URL, {
        requestedBy: interaction.user,
        searchEngine: QueryType.YOUTUBE_PLAYLIST
      });

      if (!searchResult?.tracks?.length) {
        return safeEdit(client, interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(ERROR_COLOR)
              .setTitle("❌ Electro Error")
              .setDescription("Could not load playlist. Check the YouTube link.")
          ]
        });
      }

      if (searchResult.tracks.length < 2) {
        return safeEdit(client, interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(ERROR_COLOR)
              .setTitle("❌ Electro Error")
              .setDescription("Loaded only 1 track. Please check if the link is a valid public playlist.")
          ]
        });
      }

      const channel = voiceCheck.channel;
      await player.play(channel, searchResult, {
        nodeOptions: {
          metadata: {
            isElectro: true,
            lastChannelId: channel.id,
            textChannelId: interaction.channel?.id
          }
        }
      });

      const queue = useQueue?.(interaction.guild.id) ?? client.player?.nodes?.get(interaction.guild.id);
      if (queue) {
        queue.tracks.shuffle();
        queue.setRepeatMode(QueueRepeatMode.QUEUE);

        const trackCount = (queue.currentTrack ? 1 : 0) + (queue.tracks?.size ?? 0) || searchResult.tracks.length;

        const successEmbed = new EmbedBuilder()
          .setColor(YOUTUBE_COLOR)
          .setTitle("🔀 Electro Mix Active")
          .setDescription("**Playlist Loaded & Shuffled!**\nFresh mix every time.")
          .addFields({ name: "Total Tracks", value: `${trackCount} Songs`, inline: true })
          .setFooter({ text: "Electro Mix" })
          .setTimestamp();

        if (queue.currentTrack?.thumbnail) {
          successEmbed.setThumbnail(queue.currentTrack.thumbnail);
        }

        return safeEdit(client, interaction, {
          embeds: [successEmbed]
        });
      }

      return safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(YOUTUBE_COLOR)
            .setTitle("🔀 Electro Mix Active")
            .setDescription("**Playlist Loaded & Shuffled!**\nFresh mix every time.")
            .addFields({ name: "Total Tracks", value: `${searchResult.tracks.length} Songs`, inline: true })
            .setFooter({ text: "Electro Mix" })
        ]
      });
    } catch (err) {
      client.logger?.error?.("Electro command failed", { message: err?.message });
      return safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(ERROR_COLOR)
            .setTitle("❌ Electro Error")
            .setDescription("Failed to load YouTube playlist. Try again later.")
            .setTimestamp()
        ]
      });
    }
  }
};
