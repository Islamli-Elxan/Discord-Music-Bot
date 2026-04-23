const { canRun } = require("../systems/cooldowns");
const { errorEmbed } = require("../utils/embeds");
const { isDJ } = require("../systems/permissions");
const { getSettings } = require("../systems/settings");
const sessionMemory = require("../services/sessionMemory");
const { getTrackMoodTags } = require("../services/moodDetection");

module.exports = {
  name: "interactionCreate",
  async execute(client, interaction) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        const cooldown = canRun(client, command.data.name, interaction.user.id, command.cooldown || 3);
        if (!cooldown.ok) {
          const payload = {
            embeds: [errorEmbed(client, `Cooldown active. Try again in ${(cooldown.remainingMs / 1000).toFixed(1)}s.`)],
            ephemeral: true
          };
          return interaction.deferred ? interaction.editReply(payload) : interaction.reply(payload);
        }

        if (command.djOnly) {
          const settings = await getSettings(client, interaction.guild.id);
          if (!isDJ(interaction.member, settings)) {
            const payload = { embeds: [errorEmbed(client, "DJ role required for this command.")], ephemeral: true };
            return interaction.deferred ? interaction.editReply(payload) : interaction.reply(payload);
          }
        }
        await command.execute(client, interaction);
      } catch (error) {
        if (error?.code === 10062 || error?.message?.includes("Unknown interaction")) {
          client.logger.warn("Interaction expired before response", { name: command.data.name });
          try {
            if (interaction.channel?.send) {
              await interaction.channel.send({
                embeds: [errorEmbed(client, "This command took too long. Please try again.")]
              });
            }
          } catch (_) {}
          return;
        }
        if (error?.code === 40060 || error?.message?.includes("already been acknowledged")) {
          return;
        }
        client.logger.error("Command execution failed", { name: command.data.name, error: error.message });
        const payload = { embeds: [errorEmbed(client, "Command failed. Please try again.")], ephemeral: true };
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload);
          } else {
            await interaction.reply(payload);
          }
        } catch (_) {}
      }
    }

    if (interaction.isButton()) {
      const customId = interaction.customId;
      if (customId?.startsWith("play_select_")) {
        const { infoEmbed, errorEmbed } = require("../utils/embeds");

        try {
          await interaction.deferUpdate();
        } catch (deferErr) {
          if (deferErr?.code === 10062 || deferErr?.code === 40060 || deferErr?.message?.includes("Unknown interaction") || deferErr?.message?.includes("already been acknowledged")) {
            return;
          }
          throw deferErr;
        }

        try {
          const parts = customId.split("_");
          const index = parseInt(parts[2], 10);
          const cacheKey = parts[3];
          const data = client.cache?.getPlaySelection(cacheKey);

          if (!data || data.userId !== interaction.user.id) {
            return interaction.editReply({
              embeds: [errorEmbed(client, "Selection expired or you are not the user who ran this command.")],
              components: []
            }).catch(() => {});
          }

          const track = data.tracks[index];
          if (!track) {
            return interaction.editReply({
              embeds: [errorEmbed(client, "Invalid selection.")],
              components: []
            }).catch(() => {});
          }

          const { getQueue } = require("../music/helpers");
          const { createQueueMetadata } = require("../music/queueMetadata");

          const queue =
            getQueue(client, interaction.guild.id) ||
            client.player.nodes.create(interaction.guild, {
              metadata: data.metadata,
              leaveOnEnd: false,
              leaveOnEmpty: false,
              leaveOnEmptyCooldown: 300000,
              leaveOnStop: false,
              bufferingTimeout: 15000
            });
          queue.metadata.lastChannelId = data.voiceChannelId;
          queue.metadata.textChannelId = data.textChannelId;

          const voiceChannel = interaction.guild.channels.cache.get(data.voiceChannelId);
          if (!voiceChannel) {
            return interaction.editReply({
              embeds: [errorEmbed(client, "Voice channel no longer available.")],
              components: []
            }).catch(() => {});
          }

          const memberChannel = interaction.member?.voice?.channel;
          if (!memberChannel || memberChannel.id !== data.voiceChannelId) {
            return interaction.editReply({
              embeds: [errorEmbed(client, "You must be in the same voice channel.")],
              components: []
            }).catch(() => {});
          }

          if (!queue.connection) await queue.connect(voiceChannel);
          queue.node.setVolume(data.settings.volume);
          queue.metadata.isAutoplayEnabled = !!data.settings.autoplay;
          queue.setRepeatMode(
            data.settings.loop_mode === "track" ? 1 : data.settings.loop_mode === "queue" ? 2 : 0
          );
          queue.addTrack(track);

          // Implicit feedback for "manual similar add":
          // If autoplay is enabled and the user selected a track matching the last prediction,
          // treat it as a like to boost future similar recommendations.
          try {
            const guildId = interaction.guild.id;
            const session = sessionMemory.getSession(guildId);
            const pred = session?.lastAutoplayPrediction;
            if (pred && queue.metadata?.isAutoplayEnabled) {
              const addedArtist = (track?.author || track?.artist || "").toString();
              const sameArtist =
                pred.artist && addedArtist && pred.artist.toLowerCase() === addedArtist.toLowerCase();
              const addedMoodTags = getTrackMoodTags(track);
              const moodOverlap = Array.isArray(pred.moodTags) ? pred.moodTags.some((m) => addedMoodTags.includes(m)) : false;
              if (sameArtist || moodOverlap) {
                void client.db
                  .applyTrackFeedback({
                    guildId,
                    trackUrl: track?.url || track?.id,
                    deltaScore: 0.8,
                    addSkipCount: 0
                  })
                  .catch(() => {});
              }
            }
          } catch (_) {}

          if (!queue.node.isPlaying()) await queue.node.play();

          return interaction.editReply({
            embeds: [infoEmbed(client, `Queued **${track.title}**.`, "Queued")],
            components: []
          });
        } catch (err) {
          if (err?.code === 10062 || err?.code === 40060 || err?.message?.includes("Unknown interaction") || err?.message?.includes("already been acknowledged")) {
            return;
          }
          client.logger.error("Play select failed", { message: err.message, stack: err.stack });
          const msg =
            err?.message?.includes("connection") || err?.message?.includes("Connection")
              ? "Could not connect to voice. Check permissions and try again."
              : "Could not start playback. Try a direct YouTube link or different track.";
          return interaction.editReply({
            embeds: [errorEmbed(client, msg)],
            components: []
          }).catch(() => {});
        }
      }

      const command = client.commands.get("playercontrols");
      if (command) {
        try {
          await command.execute(client, interaction);
        } catch (btnErr) {
          if (btnErr?.code === 10062 || btnErr?.code === 40060 || btnErr?.message?.includes("Unknown interaction") || btnErr?.message?.includes("already been acknowledged")) {
            return;
          }
          client.logger.error("Button command failed", { name: "playercontrols", message: btnErr?.message });
        }
      }
    }
  }
};
