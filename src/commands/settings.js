const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { QueueRepeatMode } = require("discord-player");
const { getQueue, requireSameChannel } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { updateSettings } = require("../systems/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Smart autoplay and bot settings")
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("autoplay")
        .setDescription("Configure smart autoplay behavior")
        .addBooleanOption((o) => o.setName("enabled").setDescription("Enable/disable smart autoplay").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("mode")
            .setDescription("Autoplay mode")
            .setRequired(false)
            .addChoices(
              { name: "smart", value: "smart" },
              { name: "similar_artist", value: "similar_artist" },
              { name: "same_genre", value: "same_genre" },
              { name: "random (fallback)", value: "random" }
            )
        )
        .addIntegerOption((o) => o.setName("exploration_rate").setDescription("0-100 (try new artists)").setRequired(false))
        .addBooleanOption((o) => o.setName("block_explicit").setDescription("Block explicit tracks").setRequired(false))
        .addStringOption((o) =>
          o
            .setName("preferred_sources")
            .setDescription("Preferred sources")
            .setRequired(false)
            .addChoices(
              { name: "youtube", value: "youtube" },
              { name: "soundcloud", value: "soundcloud" },
              { name: "both", value: "both" }
            )
        )
    ),
  cooldown: 3,
  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub !== "autoplay") return;

    const enabled = interaction.options.getBoolean("enabled", true);
    const mode = interaction.options.getString("mode", false) || "smart";
    const explorationRateRaw = interaction.options.getInteger("exploration_rate", false);
    const explorationRate =
      explorationRateRaw == null ? 20 : Math.max(0, Math.min(100, Number(explorationRateRaw)));
    const blockExplicit = interaction.options.getBoolean("block_explicit", false);
    const blockExplicitFinal = blockExplicit == null ? 1 : blockExplicit ? 1 : 0;
    const preferredSources = interaction.options.getString("preferred_sources", false) || "both";

    // Persist autoplay enabled flag in the existing guild_settings table.
    await updateSettings(client, interaction.guild.id, { autoplay: enabled ? 1 : 0 });

    // Persist smart autoplay tuning.
    await client.db.upsertAutoplaySettings(interaction.guild.id, {
      mode,
      exploration_rate: explorationRate,
      block_explicit: blockExplicitFinal,
      preferred_sources: preferredSources
    });

    // Best-effort: update active queue metadata so the change applies immediately.
    const queue = getQueue(client, interaction.guild.id);
    if (queue && queue.metadata) {
      // Keep existing /autoplay behavior: autoplay only when queue ends.
      const voiceCheck = requireSameChannel(interaction, queue);
      if (voiceCheck.ok) {
        queue.metadata.isAutoplayEnabled = enabled;
        queue.setRepeatMode(QueueRepeatMode.OFF);
      }
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(enabled ? 0x00ff00 : 0xff0000)
          .setTitle(`Smart Autoplay ${enabled ? "Enabled" : "Disabled"}`)
          .setDescription(
            `Mode: \`${mode}\`\nExploration: \`${explorationRate}%\`\nBlock explicit: \`${blockExplicitFinal ? "on" : "off"}\`\nPreferred sources: \`${preferredSources}\``
          )
      ]
    });
  }
};

