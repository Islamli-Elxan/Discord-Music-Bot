const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { QueryType } = require("discord-player");
const { createQueueMetadata } = require("../music/queueMetadata");
const { requireSameChannel, getQueue } = require("../music/helpers");
const { infoEmbed, errorEmbed, baseEmbed } = require("../utils/embeds");
const { getSettings } = require("../systems/settings");
const { safeEdit } = require("../utils/interaction");
const sessionMemory = require("../services/sessionMemory");
const { getTrackMoodTags } = require("../services/moodDetection");

function randomId(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function formatDuration(ms) {
  if (!ms || ms === 0 || !Number.isFinite(ms)) return "?";
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTrackDuration(track) {
  const d = track.duration;
  if (d && d !== "0:00") return d;
  const ms = track.durationMS;
  if (ms && ms > 0) return formatDuration(ms);
  return "?";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track or playlist")
    .addStringOption((o) => o.setName("link-or-query").setDescription("Link or search query").setRequired(true)),
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString("link-or-query", true);
      const existingQueue = getQueue(client, interaction.guild.id);
      const voiceCheck = requireSameChannel(interaction, existingQueue);
      if (!voiceCheck.ok) {
        return safeEdit(client, interaction, { embeds: [errorEmbed(client, voiceCheck.message)] });
      }

      const settings = await getSettings(client, interaction.guild.id);
      const metadata = createQueueMetadata(interaction.guild.id);
      metadata.lastChannelId = voiceCheck.channel.id;

      const queue =
        existingQueue ||
        client.player.nodes.create(interaction.guild, {
          metadata,
          leaveOnEnd: false,
          leaveOnEmpty: false,
          leaveOnEmptyCooldown: 300000,
          leaveOnStop: false,
          bufferingTimeout: 15000
        });
      queue.metadata.lastChannelId = voiceCheck.channel.id;
      queue.metadata.textChannelId = interaction.channel?.id;

      await safeEdit(client, interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle("🎵 Play")
            .setDescription("Searching for tracks...")
        ]
      });

      let searchResult;
      try {
        searchResult = await client.player.search(query, {
          requestedBy: interaction.user,
          searchEngine: QueryType.AUTO
        });
      } catch (err) {
        client.logger.error("Search failed", { message: err.message });
        return safeEdit(client, interaction, { embeds: [errorEmbed(client, "Search failed. Try a different query.")] });
      }

      if (!searchResult?.tracks?.length) {
        return safeEdit(client, interaction, { embeds: [errorEmbed(client, "No results found.")] });
      }

      const isPlaylist = !!searchResult.playlist;
      const multipleResults = searchResult.tracks.length > 1 && !isPlaylist;

      if (multipleResults) {
        const topTracks = searchResult.tracks.slice(0, 5);
        const cacheKey = randomId();
        client.cache.setPlaySelection(cacheKey, {
          tracks: topTracks,
          guildId: interaction.guild.id,
          voiceChannelId: voiceCheck.channel.id,
          textChannelId: interaction.channel?.id,
          userId: interaction.user.id,
          settings,
          metadata: createQueueMetadata(interaction.guild.id)
        });

        const list = topTracks
          .map((t, i) => `${i + 1}. **${t.author} - ${t.title}** (${getTrackDuration(t)})`)
          .join("\n");

        const embed = baseEmbed(client, null)
          .setColor(0x5865f2)
          .setDescription(`**Please select a track from the buttons below.**\n\n${list}`);

        const row = new ActionRowBuilder().addComponents(
          topTracks.map((_, i) =>
            new ButtonBuilder()
              .setCustomId(`play_select_${i}_${cacheKey}`)
              .setLabel(String(i + 1))
              .setStyle(ButtonStyle.Secondary)
          )
        );

        return safeEdit(client, interaction, { embeds: [embed], components: [row] });
      }

      try {
        if (!queue.connection) await queue.connect(voiceCheck.channel);
        queue.node.setVolume(settings.volume);
        queue.metadata.isAutoplayEnabled = !!settings.autoplay;
        queue.setRepeatMode(
          settings.loop_mode === "track" ? 1 : settings.loop_mode === "queue" ? 2 : 0
        );
        if (searchResult.playlist) {
          queue.addTrack(searchResult.tracks);
        } else {
          queue.addTrack(searchResult.tracks[0]);
        }
        if (!queue.node.isPlaying()) await queue.node.play();

        // Smart autoplay feedback loop:
        // If the user manually adds a track similar to our last prediction,
        // treat it as an implicit "like" to improve future recommendations.
        if (!searchResult.playlist) {
          const addedTrack = searchResult.tracks?.[0];
          const guildId = interaction.guild.id;
          const session = sessionMemory.getSession(guildId);
          const pred = session?.lastAutoplayPrediction;
          if (pred && queue.metadata?.isAutoplayEnabled && addedTrack) {
            const addedArtist = (addedTrack.author || addedTrack.artist || "").toString();
            const sameArtist = pred.artist && addedArtist && pred.artist.toLowerCase() === addedArtist.toLowerCase();
            const addedMoodTags = getTrackMoodTags(addedTrack);
            const moodOverlap = Array.isArray(pred.moodTags)
              ? pred.moodTags.some((m) => addedMoodTags.includes(m))
              : false;
            if (sameArtist || moodOverlap) {
              void client.db
                .applyTrackFeedback({
                  guildId,
                  trackUrl: addedTrack.url || addedTrack.id,
                  deltaScore: 0.8,
                  addSkipCount: 0
                })
                .catch(() => {});
            }
          }
        }
      } catch (err) {
        client.logger.error("Play failed", { message: err.message, stack: err.stack });
        return safeEdit(client, interaction, {
          embeds: [errorEmbed(client, "Could not start playback. Try a direct YouTube link or different track.")]
        });
      }

      const track = searchResult.tracks[0];
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("🎵 Added to Queue")
        .setDescription(
          searchResult.playlist
            ? `**${searchResult.playlist.title}** (${searchResult.tracks.length} tracks)`
            : `**${track.title}**`
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` });
      if (track?.thumbnail) embed.setThumbnail(track.thumbnail);
      return safeEdit(client, interaction, { embeds: [embed] });
    } catch (err) {
      client.logger.error("Play command error", { message: err.message, stack: err.stack });
      const msg = err?.code === 10062 || err?.message?.includes("Unknown interaction")
        ? "This command took too long. Please try again."
        : "An error occurred. Please try again.";
      try {
        await interaction.editReply({ embeds: [errorEmbed(client, msg)] }).catch(() => {});
      } catch {
        if (interaction.channel?.send) {
          await interaction.channel.send({ embeds: [errorEmbed(client, msg)] }).catch(() => {});
        }
      }
    }
  }
};
