const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { useQueue, useMainPlayer, QueryType, QueueRepeatMode } = require("discord-player");
const { requireSameChannel } = require("../../music/helpers");
const { safeEdit } = require("../../utils/interaction");

const ROCK_COLOR = 0x8b0000;
const ERROR_COLOR = 0xe74c3c;

const PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLWb11GoYI7aGxBVz6o9LpxtAxLMXeHDhH&si=ohLq0N1bBaIMuGH3";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rock")
    .setDescription("🎸 Ən yaxşı Rock mahnılarını oxudur (Mix)")
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

    await safeEdit(client, interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(ROCK_COLOR)
          .setTitle("🎸 Rock")
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
              .setTitle("❌ Rock Error")
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
              .setTitle("❌ Rock Error")
              .setDescription("Could not load playlist. Check the YouTube link.")
          ]
        });
      }

      if (searchResult.tracks.length < 2) {
        return safeEdit(client, interaction, {
          embeds: [
            new EmbedBuilder()
              .setColor(ERROR_COLOR)
              .setTitle("❌ Rock Error")
              .setDescription("Loaded only 1 track. Please check if the link is a valid public playlist.")
          ]
        });
      }

      const channel = voiceCheck.channel;
      await player.play(channel, searchResult, {
        nodeOptions: {
          metadata: {
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
          .setColor(ROCK_COLOR)
          .setTitle("🎸 Rock Mix yükləndi!")
          .setDescription("**Playlist Loaded & Shuffled!**\nFresh mix every time.")
          .addFields({ name: "Total Tracks", value: `${trackCount} Songs`, inline: true })
          .setFooter({ text: "Rock Mix" })
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
            .setColor(ROCK_COLOR)
            .setTitle("🎸 Rock Mix yükləndi!")
            .setDescription("**Playlist Loaded & Shuffled!**\nFresh mix every time.")
            .addFields({ name: "Total Tracks", value: `${searchResult.tracks.length} Songs`, inline: true })
            .setFooter({ text: "Rock Mix" })
        ]
      });
    } catch (err) {
      client.logger?.error?.("Rock command failed", { message: err?.message });
      return safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(ERROR_COLOR)
            .setTitle("❌ Rock Error")
            .setDescription("Failed to load YouTube playlist. Try again later.")
            .setTimestamp()
        ]
      });
    }
  }
};
