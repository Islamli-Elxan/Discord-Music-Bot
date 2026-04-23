const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const sessionMemory = require("../services/sessionMemory");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Provide explicit feedback to improve smart autoplay")
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("like")
        .setDescription("Like a track to boost its recommendations")
        .addStringOption((o) => o.setName("track_url").setDescription("Track URL (optional)").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("dislike")
        .setDescription("Dislike a track to reduce its recommendations")
        .addStringOption((o) => o.setName("track_url").setDescription("Track URL (optional)").setRequired(false))
    ),
  cooldown: 3,
  async execute(client, interaction) {
    await interaction.deferReply({ ephemeral: true });

    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)] });

    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)] });

    const sub = interaction.options.getSubcommand();
    const urlOpt = interaction.options.getString("track_url", false);
    const current = queue.currentTrack;
    const trackUrl = urlOpt || current?.url || current?.id;
    if (!trackUrl) return interaction.editReply({ embeds: [errorEmbed(client, "No track URL available.")] });

    const deltaScore = sub === "like" ? 1.2 : -1.2;
    const addSkipCount = sub === "dislike" ? 1 : 0;

    try {
      await client.db.applyTrackFeedback({
        guildId: interaction.guild.id,
        trackUrl,
        deltaScore,
        addSkipCount
      });

      if (sub === "dislike") {
        // Soft blacklist for the rest of the session.
        sessionMemory.addSkipToBlacklist(interaction.guild.id, trackUrl, 60 * 15);
      }

      return interaction.editReply({
        embeds: [
          infoEmbed(client, `Feedback received: **${sub}** for \`${String(trackUrl).slice(0, 40)}...\`.`, "Feedback")
        ]
      });
    } catch (e) {
      return interaction.editReply({ embeds: [errorEmbed(client, "Failed to save feedback.")] });
    }
  }
};

