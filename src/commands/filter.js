const { SlashCommandBuilder } = require("discord.js");
const { requireQueue, requireSameChannel, getQueue } = require("../music/helpers");
const { errorEmbed, infoEmbed } = require("../utils/embeds");
const { getFilterNames, getFilterValue } = require("../music/filters");
const { buildFullFfmpegFilters } = require("../music/audioProcessing");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Toggle audio filters")
    .addStringOption((o) => {
      const opt = o.setName("name").setDescription("Filter name").setRequired(true);
      for (const name of getFilterNames()) {
        opt.addChoices({ name, value: name });
      }
      return opt;
    }),
  djOnly: true,
  cooldown: 2,
  async execute(client, interaction) {
    await interaction.deferReply();
    const queue = getQueue(client, interaction.guild.id);
    const hasQueue = requireQueue(interaction, queue);
    if (!hasQueue.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, hasQueue.message)]});
    }
    const voiceCheck = requireSameChannel(interaction, queue);
    if (!voiceCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed(client, voiceCheck.message)]});
    }

    const name = interaction.options.getString("name", true);
    // Validate filter exists (choices already constrain, but keep safe).
    if (!getFilterValue(name)) {
      return interaction.editReply({ embeds: [errorEmbed(client, "Invalid filter name.")] });
    }
    if (!queue.metadata.filters) queue.metadata.filters = new Set();

    if (queue.metadata.filters.has(name)) {
      queue.metadata.filters.delete(name);
    } else {
      queue.metadata.filters.add(name);
    }

    // Always keep the high-quality base pipeline (highpass + aresample + loudnorm + default EQ),
    // then layer the toggled filters on top.
    const guildId = interaction.guild.id;
    const eqPresetRow = await client.db.getEqPreset(guildId);
    const eqPresetName = eqPresetRow || "flat";

    const currentTrack = queue.currentTrack;
    const trackKey = currentTrack?.url || currentTrack?.id || currentTrack?.title;
    let loudnormMeta = null;
    if (trackKey) {
      const row = await client.db.getTrackLoudnessGain(trackKey);
      if (row) {
        loudnormMeta = {
          measured_I: row.measured_I != null ? Number(row.measured_I) : null,
          measured_TP: row.measured_TP != null ? Number(row.measured_TP) : null,
          measured_LRA: row.measured_LRA != null ? Number(row.measured_LRA) : null,
          measured_thresh: row.measured_thresh != null ? Number(row.measured_thresh) : null,
          target_offset: row.target_offset != null ? Number(row.target_offset) : null
        };
      }
    }

    const ffmpegFilters = buildFullFfmpegFilters({
      userFilterNames: queue.metadata.filters,
      eqPresetName,
      loudnormMeta
    });
    await queue.filters.ffmpeg.setFilters(ffmpegFilters);
    return interaction.editReply({
      embeds: [
        infoEmbed(client, `Filter **${name}** ${queue.metadata.filters.has(name) ? "enabled" : "disabled"}.`, "Filters")
      ]
    });
  }
};
